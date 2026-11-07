#!/usr/bin/env python3
"""Read/switch this desktop's video inputs. No shell, no persistent polling."""
import concurrent.futures
import json
import re
import subprocess
import sys

DISPLAYS = {"dell": ("DELL P2722H", "DHMDXT3"), "tcl": ("27G64", "00001")}
INPUTS = {"pc": "0x0f", "laptop": "0x11"}


def ddc(display, *args):
    model, serial = DISPLAYS[display]
    try:
        result = subprocess.run(
            ["ddcutil", "--model", model, "--sn", serial, *args],
            capture_output=True, text=True, timeout=10,
        )
        return result.returncode == 0, result.stdout[:4096]
    except (OSError, subprocess.TimeoutExpired):
        return False, ""


def read_input(display):
    ok, output = ddc(display, "--terse", "getvcp", "60")
    # Terse non-continuous feature: VCP 60 SNC x0f (or 0x0f).
    match = re.search(r"\bVCP\s+60\s+SNC\s+(?:0x|x)?([0-9a-fA-F]+)\b", output)
    value = int(match[1], 16) if ok and match else None
    return next((name for name, code in INPUTS.items() if int(code, 16) == value), "unknown")


def main():
    args = sys.argv[1:]
    if args != ["status"] and not (
        len(args) == 3 and args[0] == "set"
        and args[1] in (*DISPLAYS, "both") and args[2] in INPUTS
    ):
        raise SystemExit("Usage: input-control.py status | set <dell|tcl|both> <pc|laptop>")
    errors = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        if args[0] == "set":
            targets = list(DISPLAYS) if args[1] == "both" else [args[1]]
            jobs = {name: pool.submit(ddc, name, "setvcp", "60", INPUTS[args[2]]) for name in targets}
            errors = [name for name, job in jobs.items() if not job.result()[0]]
        jobs = {name: pool.submit(read_input, name) for name in DISPLAYS}
        status = {name: job.result() for name, job in jobs.items()}
    print(json.dumps({"inputs": status, "errors": errors}))


if __name__ == "__main__":
    main()
