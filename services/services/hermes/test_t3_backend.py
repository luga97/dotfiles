"""Protocol checks without creating T3 conversations or invoking providers."""

import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

import t3_backend


class T3ProtocolTest(unittest.TestCase):
    def view(self, **changes):
        thread = {"status": "completed", "latestRunId": "run-new", "activeRunId": None,
                  "pendingRequestCount": 0, "link": "https://example.invalid/thread"}
        thread.update(changes)
        return {"thread": thread, "messages": [
            {"role": "assistant", "runId": "run-old", "text": "old answer"},
            {"role": "assistant", "runId": "run-new", "text": "new answer"}]}

    def test_new_run_answer_and_pending_approval(self):
        task = {"thread_id": "thread", "run_id": "run-new", "status": "running"}
        with patch.object(t3_backend, "thread_view", return_value=self.view()):
            result = t3_backend.refresh(dict(task))
        self.assertEqual((result["status"], result["answer"]), ("completed", "new answer"))
        with patch.object(t3_backend, "thread_view", return_value=self.view(pendingRequestCount=1)):
            self.assertEqual(t3_backend.refresh(dict(task))["status"], "waiting")

    def test_never_treat_another_run_as_success(self):
        task = {"thread_id": "thread", "run_id": "run-other", "status": "running"}
        with patch.object(t3_backend, "thread_view", return_value=self.view()):
            result = t3_backend.refresh(task)
        self.assertEqual(result["status"], "unknown")
        self.assertNotIn("answer", result)

    def test_read_failure_does_not_claim_provider_stopped(self):
        task = {"thread_id": "thread", "run_id": "run-new", "status": "running"}
        with patch.object(t3_backend, "thread_view", side_effect=RuntimeError("offline")):
            result = t3_backend.refresh(task)
        self.assertEqual(result["status"], "running")
        self.assertIn("read_error", result)

    def test_dispatch_literal_stdin_and_project_defaults(self):
        prompt = 'Do not execute this: $(touch /tmp/should-not-exist) `id`\nsecond line'
        task = {"cwd": "/home/luis/dotfiles", "title": "Hermes test", "prompt": prompt}
        response = subprocess.CompletedProcess([], 0, json.dumps({"threadId": "thread", "runId": "run-new"}), "")
        with tempfile.TemporaryDirectory() as tmp, patch.object(t3_backend, "cli", return_value=response) as run:
            result = t3_backend.dispatch(task, Path(tmp)/"out", Path(tmp)/"err")
            self.assertEqual(run.call_args.kwargs["prompt"], prompt)
            self.assertNotIn("--provider", run.call_args.args[0])
            self.assertNotIn(prompt, run.call_args.args[0])
            self.assertEqual(result["run_id"], "run-new")

    def test_mutation_timeout_is_unknown_and_not_retried(self):
        task = {"cwd": "/home/luis/dotfiles", "title": "Hermes test", "prompt": "test"}
        with tempfile.TemporaryDirectory() as tmp, patch.object(t3_backend, "cli", side_effect=subprocess.TimeoutExpired("t3",20)) as run:
            result = t3_backend.dispatch(task, Path(tmp)/"out", Path(tmp)/"err")
        self.assertEqual(result["status"], "unknown")
        self.assertEqual(run.call_count, 1)

    def test_busy_thread_is_not_sent_a_followup(self):
        task = {"thread_id": "thread", "cwd": "/home/luis/dotfiles", "prompt": "test"}
        with tempfile.TemporaryDirectory() as tmp, patch.object(t3_backend,"thread_view",return_value=self.view(activeRunId="busy")), patch.object(t3_backend,"cli") as run:
            result = t3_backend.dispatch(task, Path(tmp)/"out", Path(tmp)/"err")
        run.assert_not_called()
        self.assertEqual(result["status"], "failed")

    def test_existing_thread_read_does_not_race_dispatch_worker(self):
        spec = importlib.util.spec_from_file_location("bridge", Path(__file__).with_name("agent-bridge.py"))
        bridge = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(bridge)
        with tempfile.TemporaryDirectory() as tmp:
            bridge.STATE = Path(tmp)
            bridge.prepare_state()
            task_id = "11111111-1111-4111-8111-111111111111"
            bridge.save(bridge.task_path(task_id), {"backend":"t3", "thread_id":"thread", "status":"queued", "created_at":1e20})
            with patch.object(t3_backend,"refresh") as refresh:
                self.assertEqual(bridge.status(task_id)["status"], "queued")
                refresh.assert_not_called()

    def test_continuation_reuses_persisted_thread_and_new_run(self):
        spec = importlib.util.spec_from_file_location("bridge", Path(__file__).with_name("agent-bridge.py"))
        bridge = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(bridge)
        launch = subprocess.CompletedProcess([], 0, json.dumps({"threadId":"thread", "runId":"run-new"}), "")
        followup = subprocess.CompletedProcess([], 0, json.dumps({"threadId":"thread", "runId":"run-next", "delivery":"sent"}), "")
        with tempfile.TemporaryDirectory() as tmp:
            bridge.STATE = Path(tmp)
            bridge.prepare_state()
            with patch.object(bridge.subprocess, "run", return_value=subprocess.CompletedProcess([],0,"","")):
                first = bridge.submit({"backend":"t3", "new_thread":True, "cwd":str(Path.home()), "prompt":"first"})
            with patch.object(t3_backend,"cli",return_value=launch):
                self.assertEqual(bridge.worker(first["task_id"]),0)
            with patch.object(t3_backend,"thread_view",return_value=self.view()):
                self.assertEqual(bridge.status(first["task_id"])["status"],"completed")
            with patch.object(bridge.subprocess, "run", return_value=subprocess.CompletedProcess([],0,"","")):
                second = bridge.submit({"session_id":first["session_id"], "prompt":"second"})
            self.assertEqual(second["status"],"queued")
            with patch.object(t3_backend,"thread_view",return_value=self.view()), patch.object(t3_backend,"cli",return_value=followup) as run:
                self.assertEqual(bridge.worker(second["task_id"]),0)
                self.assertEqual(run.call_args.args[0],["send","thread","-"])
            self.assertEqual(bridge.load(bridge.task_path(second["task_id"]))["run_id"],"run-next")

    def test_list_ignores_private_dispatch_artifacts(self):
        spec = importlib.util.spec_from_file_location("bridge", Path(__file__).with_name("agent-bridge.py"))
        bridge = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(bridge)
        with tempfile.TemporaryDirectory() as tmp:
            bridge.STATE = Path(tmp)
            bridge.prepare_state()
            task_id = "11111111-1111-4111-8111-111111111111"
            bridge.save(bridge.task_path(task_id), {"task_id":task_id,"status":"completed","prompt":"private"})
            bridge.save(bridge.STATE/"tasks"/f"{task_id}.t3-dispatch.json", {"private":"artifact"})
            tasks = bridge.dispatch({"action":"list"})
            self.assertEqual([t["task_id"] for t in tasks],[task_id])
            self.assertNotIn("prompt",tasks[0])


if __name__ == "__main__":
    unittest.main()
