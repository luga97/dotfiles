import importlib.util
import subprocess
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('omarchy_ready', Path(__file__).with_name('omarchy-ready.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def card():
    return {'task': {'id': 't_ab12', 'status': 'blocked', 'tenant': 'omarchy-pre-envio',
                     'assignee': 'default', 'max_retries': 1},
            'events': [{'kind': 'created', 'payload': {'status': 'blocked'}},
                       {'kind': 'blocked', 'payload': {'reason': 'initial_status'}}],
            'runs': []}


class RecoverySafety(unittest.TestCase):
    def test_only_never_run_initial_blocks_are_eligible(self):
        self.assertTrue(module.eligible(card()))
        for change in ('run', 'comment', 'unblock', 'retry', 'tenant', 'status', 'assignee'):
            x = card()
            if change == 'run': x['runs'] = [{'id': 1}]
            if change == 'comment': x['events'].append({'kind': 'commented'})
            if change == 'unblock': x['events'].append({'kind': 'unblocked'})
            if change == 'retry': x['task']['max_retries'] = 2
            if change == 'tenant': x['task']['tenant'] = 'other'
            if change == 'status': x['task']['status'] = 'ready'
            if change == 'assignee': x['task']['assignee'] = 'other'
            with self.subTest(change=change): self.assertFalse(module.eligible(x))

    def test_invalid_task_id_does_not_pass(self):
        x = card()
        x['task']['id'] = 't_ab12;whoami'
        self.assertFalse(module.eligible(x))

    def test_requires_owner_telegram_subscription(self):
        import json
        for subscriptions, expected in [
            ([], False),
            ([{'platform': 'telegram', 'chat_id': '999', 'delivery_mode': 'notify'}], False),
            ([{'platform': 'telegram', 'chat_id': '123', 'delivery_mode': 'wake'}], False),
            ([{'platform': 'telegram', 'chat_id': '123', 'delivery_mode': 'notify'}], True),
        ]:
            result = subprocess.CompletedProcess([], 0, json.dumps(subscriptions), '')
            with self.subTest(subscriptions=subscriptions), patch.object(module, 'command', return_value=result):
                self.assertEqual(module.subscribed('t_ab12', '123'), expected)


if __name__ == '__main__':
    unittest.main()
