"""Verify input switching without writing to physical monitors."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location(
    "inputs", Path(__file__).resolve().parents[1] / "luis.monitor/input-control.py"
)
inputs = importlib.util.module_from_spec(spec)
spec.loader.exec_module(inputs)


class InputTests(unittest.TestCase):
    def run_main(self, *args):
        output = io.StringIO()
        with patch.object(sys, "argv", ["input-control.py", *args]), contextlib.redirect_stdout(output):
            inputs.main()
        return json.loads(output.getvalue())

    def test_status_never_switches_inputs(self):
        with patch.object(inputs, "ddc", return_value=(True, "VCP 60 SNC x0f")) as ddc:
            self.assertEqual(self.run_main("status")["inputs"], {"dell": "pc", "tcl": "pc"})
        self.assertTrue(all(call.args[1:] == ("--terse", "getvcp", "60") for call in ddc.call_args_list))

    def test_unknown_or_unreadable_input_is_not_shown_as_pc(self):
        for value in [(True, "VCP 60 SNC x12"), (False, "VCP 60 SNC x0f"), (True, "malformed")]:
            with self.subTest(value=value), patch.object(inputs, "ddc", return_value=value):
                self.assertEqual(inputs.read_input("tcl"), "unknown")

    def test_laptop_input_is_recognized(self):
        with patch.object(inputs, "ddc", return_value=(True, "VCP 60 SNC x11")):
            self.assertEqual(inputs.read_input("dell"), "laptop")

    def test_both_attempted_when_one_fails(self):
        def fake_ddc(display, *args):
            if args[0] == "setvcp":
                return display != "dell", ""
            return True, "VCP 60 SNC x11"
        with patch.object(inputs, "ddc", side_effect=fake_ddc) as ddc:
            result = self.run_main("set", "both", "laptop")
        self.assertEqual(result["errors"], ["dell"])
        writes = {call.args for call in ddc.call_args_list if call.args[1] == "setvcp"}
        self.assertEqual(writes, {("tcl", "setvcp", "60", "0x11"), ("dell", "setvcp", "60", "0x11")})

    def test_invalid_target_never_runs_ddc(self):
        with patch.object(inputs, "ddc") as ddc:
            with self.assertRaises(SystemExit):
                self.run_main("set", "other", "pc")
            ddc.assert_not_called()

    def test_timeout_becomes_unknown(self):
        with patch.object(inputs.subprocess, "run", side_effect=subprocess.TimeoutExpired("ddcutil", 10)):
            self.assertEqual(inputs.read_input("tcl"), "unknown")


if __name__ == "__main__":
    unittest.main()
