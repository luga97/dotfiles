#!/usr/bin/env python3
"""Read-only stable state for Hermes cron's change detector."""
import os
import subprocess


def main():
    print('monitor=infra-discos-respaldos-v2')
    try:
        stat = os.statvfs('/')
        used = 100 * (stat.f_blocks - stat.f_bfree) / (stat.f_blocks - stat.f_bfree + stat.f_bavail)
        disk = 'critical >= 90%' if used >= 90 else 'warning 85–89%' if used >= 85 else 'normal < 85%'
    except (OSError, ZeroDivisionError) as exc:
        disk = 'unknown: ' + type(exc).__name__
    print('home_server_root_disk=' + disk)
    for name in ('pz-backup.timer', 'pz-backup.service'):
        try:
            p = subprocess.run(['systemctl', 'show', name, '--property=LoadState,ActiveState,Result', '--value'], capture_output=True, text=True, timeout=10)
            if p.returncode != 0:
                print(name + '=unknown:systemctl_failed')
            else:
                print(name + '=' + '|'.join(p.stdout.strip().splitlines()))
        except (OSError, subprocess.TimeoutExpired) as exc:
            print(name + '=unknown:' + type(exc).__name__)


if __name__ == '__main__':
    main()
