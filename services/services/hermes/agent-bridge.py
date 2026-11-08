#!/usr/bin/env python3
"""Submit persistent Pi jobs to Omarchy over SSH; continue sessions by ID."""

import argparse
import fcntl
import json
import os
from pathlib import Path
import shlex
import subprocess
import sys
import time
import uuid


STATE = Path(os.environ.get("HERMES_AGENT_STATE", Path.home() / ".local/state/hermes-omarchy-agents"))
HOST = os.environ.get("HERMES_OMARCHY_HOST", "luis@omarchy")
REMOTE_SCRIPT = os.environ.get("HERMES_OMARCHY_SCRIPT", "/home/luis/services/hermes/agent-bridge.py")
TERMINAL = {"completed", "failed"}


def identifier(value):
    if not isinstance(value, str):
        raise ValueError("Expected a canonical UUID")
    parsed = str(uuid.UUID(value))
    if parsed != value:
        raise ValueError("Expected a canonical UUID")
    return parsed


def prepare_state():
    os.umask(0o077)
    STATE.mkdir(parents=True, exist_ok=True, mode=0o700)
    for name in ("tasks", "sessions"):
        (STATE / name).mkdir(exist_ok=True, mode=0o700)


def save(path, value):
    temporary = path.with_suffix(f".tmp-{os.getpid()}")
    with temporary.open("w") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    temporary.replace(path)


def load(path):
    return json.loads(path.read_text())


def task_path(task_id):
    return STATE / "tasks" / f"{identifier(task_id)}.json"


def status(task_id):
    path = task_path(task_id)
    task = load(path)
    if task["status"] not in TERMINAL and time.time() - task["created_at"] > 10:
        active = subprocess.run(
            ["systemctl", "--user", "is-active", f"hermes-agent-{task_id}.service"],
            capture_output=True, text=True, check=False,
        ).stdout.strip()
        if active not in {"active", "activating", "deactivating", "reloading"}:
            task.update(status="failed", error="Worker stopped before recording a result", finished_at=time.time())
            save(path, task)
    # Prompts remain on disk, but status/list should not echo them.
    return {key: value for key, value in task.items() if key != "prompt"}


def submit(request):
    prompt = request.get("prompt")
    if not isinstance(prompt, str) or not prompt.strip() or len(prompt) > 65536:
        raise ValueError("prompt must contain 1–65536 characters")
    if request.get("provider", "pi") != "pi":
        raise ValueError("This first bridge supports Pi; other providers are not configured")
    with (STATE / ".submit.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        session_id = request.get("session_id")
        if session_id:
            session_id = identifier(session_id)
            session = load(STATE / "sessions" / f"{session_id}.json")
            if request.get("cwd") and str(Path(request["cwd"]).resolve()) != session["cwd"]:
                raise ValueError("A continued session must keep its original working directory")
            previous = session.get("last_task")
            if previous and status(previous)["status"] not in TERMINAL:
                raise ValueError("This session already has a running task; wait before continuing it")
        else:
            raw_cwd = request.get("cwd")
            if not isinstance(raw_cwd, str) or not Path(raw_cwd).is_absolute():
                raise ValueError("A new session requires an absolute cwd on Omarchy")
            cwd = Path(raw_cwd).resolve()
            if not cwd.is_dir() or not cwd.is_relative_to(Path.home()):
                raise ValueError("cwd must be an existing directory under the Omarchy user's home")
            session_id = str(uuid.uuid4())
            session = {"session_id": session_id, "provider": "pi", "cwd": str(cwd)}
        task_id = str(uuid.uuid4())
        task = {**session, "task_id": task_id, "prompt": prompt, "status": "queued", "created_at": time.time()}
        task.pop("last_task", None)
        save(task_path(task_id), task)
        session["last_task"] = task_id
        save(STATE / "sessions" / f"{session_id}.json", session)
        unit = f"hermes-agent-{task_id}"
        launch = subprocess.run([
            "systemd-run", "--user", "--collect", f"--unit={unit}",
            "--property=RuntimeMaxSec=1900", "--property=TimeoutStopSec=20",
            "--property=KillMode=control-group", "/usr/bin/python3",
            str(Path(__file__).resolve()), "worker", task_id,
        ], capture_output=True, text=True, check=False)
        if launch.returncode:
            task.update(status="failed", error=launch.stderr.strip(), finished_at=time.time())
            save(task_path(task_id), task)
            raise RuntimeError(f"Could not start worker: {launch.stderr.strip()}")
        return status(task_id)


def worker(task_id):
    path = task_path(task_id)
    task = load(path)
    task.update(status="running", started_at=time.time())
    save(path, task)
    session_dir = STATE / "sessions" / task["session_id"]
    session_dir.mkdir(exist_ok=True)
    output_path = STATE / "tasks" / f"{task_id}.events.jsonl"
    error_path = STATE / "tasks" / f"{task_id}.stderr.log"
    task.update(events_path=str(output_path), stderr_path=str(error_path))
    save(path, task)
    pi = Path(os.environ.get("HERMES_PI_BINARY", Path.home() / ".local/share/mise/shims/pi"))
    command = [str(pi), "--offline", "--mode", "json", "--print",
               "--session-dir", str(session_dir), "--session-id", task["session_id"], "--", task["prompt"]]
    try:
        with output_path.open("w") as output, error_path.open("w") as errors:
            finished = subprocess.run(command, cwd=task["cwd"], stdout=output, stderr=errors, timeout=1800, check=False)
        answer = ""
        model_error = None
        with output_path.open() as events:
            for line in events:
                try:
                    event = json.loads(line)
                except json.JSONDecodeError:
                    continue
                message = event.get("message", {})
                if event.get("type") == "message_end" and message.get("role") == "assistant":
                    text = "\n".join(part["text"] for part in message.get("content", []) if part.get("type") == "text")
                    if text:
                        answer = text
                    if message.get("stopReason") in {"error", "aborted"}:
                        model_error = message.get("errorMessage", message["stopReason"])
        if finished.returncode or model_error or not answer:
            task.update(status="failed", returncode=finished.returncode,
                        error=model_error or "Pi failed or produced no assistant response; inspect its private logs")
        else:
            task.update(status="completed", returncode=0)
        task["answer"] = answer
    except Exception as exc:
        task.update(status="failed", error=f"{type(exc).__name__}: {exc}")
    task["finished_at"] = time.time()
    save(path, task)
    return 0 if task["status"] == "completed" else 1


def dispatch(request):
    action = request.get("action")
    if action == "submit":
        return submit(request)
    if action in {"status", "result"}:
        result = status(request["task_id"])
        if action == "result" and result["status"] not in TERMINAL:
            raise ValueError("Task has not finished")
        return result
    if action == "list":
        paths = sorted((STATE / "tasks").glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True)[:20]
        return [status(path.stem) for path in paths]
    raise ValueError("Unknown action")


def remote(request):
    command = ["ssh", "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=yes", "-o", "ConnectTimeout=5",
               HOST, shlex.join(["/usr/bin/python3", REMOTE_SCRIPT, "rpc"])]
    result = subprocess.run(command, input=json.dumps(request, ensure_ascii=False), text=True, capture_output=True, timeout=30, check=False)
    if result.returncode:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip() or "Remote request failed")
    response = json.loads(result.stdout)
    if not response["ok"]:
        raise RuntimeError(response["error"])
    return response["result"]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("rpc")
    run = commands.add_parser("worker")
    run.add_argument("task_id")
    start = commands.add_parser("submit")
    start.add_argument("--cwd")
    start.add_argument("--session-id")
    start.add_argument("--prompt-file", required=True, help="UTF-8 prompt path; '-' reads stdin")
    for name in ("status", "result", "wait"):
        command = commands.add_parser(name)
        command.add_argument("task_id")
        if name == "wait":
            command.add_argument("--timeout", type=int, default=120)
    commands.add_parser("list")
    args = parser.parse_args()
    try:
        if args.command in {"rpc", "worker"}:
            prepare_state()
            if args.command == "worker":
                return worker(identifier(args.task_id))
            raw = sys.stdin.read(131073)
            if len(raw) > 131072:
                raise ValueError("Request too large")
            request = json.loads(raw)
            if not isinstance(request, dict):
                raise ValueError("Request must be a JSON object")
            result = {"ok": True, "result": dispatch(request)}
        else:
            request = {"action": args.command}
            if args.command == "submit":
                prompt = sys.stdin.read() if args.prompt_file == "-" else Path(args.prompt_file).read_text()
                request.update(prompt=prompt, cwd=args.cwd, session_id=args.session_id)
            elif args.command != "list":
                request["task_id"] = args.task_id
            if args.command == "wait":
                request["action"] = "status"
                deadline = time.monotonic() + max(1, args.timeout)
                while True:
                    result = remote(request)
                    if result["status"] in TERMINAL or time.monotonic() >= deadline:
                        break
                    time.sleep(3)
            else:
                result = remote(request)
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except (OSError, ValueError, KeyError, RuntimeError, subprocess.SubprocessError) as exc:
        result = {"ok": False, "error": str(exc)}
        print(json.dumps(result, ensure_ascii=False), file=sys.stdout if args.command == "rpc" else sys.stderr)
        return 0 if args.command == "rpc" else 1


if __name__ == "__main__":
    sys.exit(main())
