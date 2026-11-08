"""T3 CLI adapter. Dispatch once; read status without owning the T3 process."""

import json
import os
from pathlib import Path
import subprocess
import time


def cli(arguments, *, prompt=None, cwd=None):
    binary = os.environ.get("HERMES_T3_BINARY", str(Path.home() / ".local/bin/t3"))
    return subprocess.run([binary, "thread", *arguments, "--json"], input=prompt,
                          capture_output=True, text=True, timeout=20, cwd=cwd, check=False)


def thread_view(thread_id):
    result = cli(["show", thread_id, "--messages", "50"])
    if result.returncode:
        raise RuntimeError("T3 could not read the thread; check T3 on Omarchy")
    value = json.loads(result.stdout)
    if not isinstance(value.get("thread"), dict) or not isinstance(value.get("messages"), list):
        raise ValueError("Unrecognized T3 thread JSON")
    return value


def refresh(task):
    """A transient read failure is not proof that the provider stopped."""
    if not task.get("thread_id"):
        return task
    try:
        view = thread_view(task["thread_id"])
        thread = view["thread"]
        run_id = task.get("run_id")
        task.update(thread_status=thread["status"], link=thread.get("link"),
                    pending_requests=thread.get("pendingRequestCount", 0), checked_at=time.time())
        task.pop("read_error", None)
        answers = [m["text"] for m in view["messages"]
                   if m.get("role") == "assistant" and m.get("runId") == run_id and m.get("text")]
        if answers:
            task["answer"] = answers[-1]
        if thread.get("latestRunId") != run_id:
            task.update(status="unknown", error="The thread advanced to another run; inspect its T3 link before retrying")
        elif task["pending_requests"] or thread["status"] == "waiting":
            task.update(status="waiting", error="T3 needs an answer or approval; open its link in T3")
        elif thread.get("activeRunId") or thread["status"] in {"running", "queued", "compacting"}:
            task.update(status="running")
            task.pop("error", None)
        elif thread["status"] == "completed" and answers:
            task.update(status="completed", finished_at=time.time())
            task.pop("error", None)
        elif thread["status"] in {"failed", "error", "cancelled", "interrupted"}:
            task.update(status="failed", error=f"T3 run ended with status {thread['status']}", finished_at=time.time())
        else:
            task.update(status="unknown", error="T3 run state is inconclusive; inspect its link before retrying")
    except (OSError, ValueError, KeyError, RuntimeError, subprocess.SubprocessError):
        task["read_error"] = "Could not refresh T3; the run may still be active. Do not resubmit."
    return task


def dispatch(task, output_path, error_path):
    """Never retry a mutation: a timeout may follow a successful server dispatch."""
    if task.get("thread_id"):
        before = thread_view(task["thread_id"])["thread"]
        if before.get("activeRunId") or before.get("pendingRequestCount") or before["status"] in {"running", "waiting", "queued"}:
            task.update(status="failed", error="T3 thread is busy or waiting; continue it in T3 first", finished_at=time.time())
            return task
        arguments = ["send", task["thread_id"], "-"]
    else:
        arguments = ["start", task["cwd"], "-", "--title", task["title"]]
        if task.get("provider"):
            arguments += ["--provider", task["provider"], "--model", task["model"]]
        if task.get("worktree"):
            arguments += ["--worktree", task["worktree"]]
    try:
        sent = cli(arguments, prompt=task["prompt"], cwd=task["cwd"])
        output_path.write_text(sent.stdout)
        error_path.write_text(sent.stderr)
        if sent.returncode:
            # The CLI can fail after creating a thread; don't claim nothing was sent.
            task.update(status="unknown", error="T3 dispatch did not confirm success; inspect private logs and T3 before retrying")
            return task
        result = json.loads(sent.stdout)
        thread_id = result.get("threadId") or task.get("thread_id")
        run_id = result.get("runId")
        if isinstance(thread_id, str):
            task.update(thread_id=thread_id, link=result.get("link") or task.get("link"))
        if not isinstance(thread_id, str) or not isinstance(run_id, str):
            raise ValueError("T3 did not return thread/run identity")
        task.update(thread_id=thread_id, run_id=run_id, link=result.get("link") or task.get("link"), status="running")
        if result.get("delivery") == "queued":
            task.update(status="unknown", error="T3 queued the message during a concurrent turn; inspect its link before continuing")
    except (OSError, ValueError, KeyError, subprocess.SubprocessError):
        task.update(status="unknown", error="T3 dispatch is unconfirmed; do not automatically resubmit")
    return task


def info(cwd):
    """Project reachability plus cached provider health; no session creation."""
    result = cli(["list", "--project", cwd], cwd=cwd)
    if result.returncode:
        raise RuntimeError("T3 is unavailable or this directory is not a registered T3 project")
    providers = []
    root = Path(os.environ.get("T3CODE_HOME", Path.home() / ".t3")) / "caches"
    for filename in ("codex", "pi", "claudeAgent"):
        path = root / f"{filename}.json"
        if not path.exists():
            continue
        value = json.loads(path.read_text())
        providers.append({key: value.get(key) for key in
                          ("instanceId", "displayName", "enabled", "installed", "status", "checkedAt")})
    return {"reachable": True, "project": cwd, "thread_count": len(json.loads(result.stdout)),
            "providers_source": "local cache; T3 validates current availability at dispatch", "providers": providers}
