#!/usr/bin/env python3
"""Wake only never-run Kanban cards created blocked while Omarchy was offline."""
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

HERMES = str(Path.home() / '.local/bin/hermes')
TENANT = 'omarchy-pre-envio'


def command(argv, timeout=20):
    return subprocess.run(argv, text=True, capture_output=True, timeout=timeout, check=True)


def eligible(item):
    task = item.get('task', {})
    events = item.get('events', [])
    if task.get('status') != 'blocked' or task.get('tenant') != TENANT:
        return False
    if not re.fullmatch(r't_[0-9a-f]+', task.get('id', '')) or item.get('runs'):
        return False
    # Only initial creation and its initial block are allowed: any subsequent
    # event requires human review, including manual changes and earlier unblocks.
    if [e.get('kind') for e in events] != ['created', 'blocked']:
        return False
    created, blocked = (e.get('payload') or {} for e in events)
    return (created.get('status') == 'blocked' and
            blocked.get('reason') == 'initial_status' and
            task.get('assignee') == 'default' and task.get('max_retries') == 1)


def subscribed(ident, owner):
    subscriptions = json.loads(command([HERMES, 'kanban', 'notify-list', ident, '--json']).stdout)
    return any(s.get('platform') == 'telegram' and str(s.get('chat_id')) == owner
               and s.get('delivery_mode') in ('notify', 'notify+wake') for s in subscriptions)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--host', default='luis@omarchy', help=argparse.SUPPRESS)
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    try:
        cards = json.loads(command([HERMES, 'kanban', 'list', '--status', 'blocked',
                                    '--tenant', TENANT, '--json']).stdout)
        if not cards:
            return 0
        candidates = []
        owner_file = Path.home() / '.hermes/telegram-bot-info.json'
        owner = str(json.loads(owner_file.read_text())['owner_user_id'])
        for card in cards:
            ident = card.get('id', '')
            if re.fullmatch(r't_[0-9a-f]+', ident):
                detail = json.loads(command([HERMES, 'kanban', 'show', ident, '--json']).stdout)
                if eligible(detail) and subscribed(ident, owner):
                    candidates.append(ident)
        if not candidates:
            return 0
        probe = command(['ssh', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
                         '-o', 'ConnectTimeout=5', args.host, '/home/luis/.local/bin/t3',
                         'thread', 'list', '--project', '/home/luis/dotfiles', '--json'], timeout=15)
        if not isinstance(json.loads(probe.stdout), list):
            raise ValueError('T3 no devolvió una lista de conversaciones')
        awakened = []
        for ident in candidates:
            detail = json.loads(command([HERMES, 'kanban', 'show', ident, '--json']).stdout)
            if not eligible(detail) or not subscribed(ident, owner):
                continue
            if not args.dry_run:
                result = command([HERMES, 'kanban', 'unblock', ident,
                                  '--reason', 'Omarchy y T3 vuelven a responder'])
                if 'Unblocked ' + ident not in result.stdout:
                    raise RuntimeError('No se confirmó el desbloqueo')
            awakened.append(ident)
        if awakened:
            action = 'Se desbloquearon' if not args.dry_run else 'Se desbloquearían'
            print(f'{action} {len(awakened)} tareas de Omarchy en Kanban: {", ".join(awakened)}.')
        return 0
    except (OSError, subprocess.SubprocessError, ValueError, KeyError, TypeError) as exc:
        # A failed probe is normally an offline host; remain quiet and keep cards blocked.
        if isinstance(exc, subprocess.CalledProcessError) and exc.cmd and exc.cmd[0] == 'ssh':
            return 0
        if isinstance(exc, subprocess.TimeoutExpired) and exc.cmd and exc.cmd[0] == 'ssh':
            return 0
        print('No se pudo comprobar el Kanban o T3; las tareas restantes siguen bloqueadas.', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
