#!/usr/bin/env python3
"""Retain 10 newest Zomboid ZIPs after verifying the new remote backup."""
import argparse
import datetime
import hashlib
import json
import os
import re
import subprocess
from pathlib import Path

LIMIT = 10
BACKUPS = Path('/home/pzuser/backups')
REMOTE = 'drive:ZomboidBackups'
NAME = re.compile(r'^pz_backup[^/]*\.zip$')

def run(*args):
    return subprocess.run(args, check=True, text=True, stdout=subprocess.PIPE).stdout

def choose(items, protected):
    # Each tuple is (mtime, name). Stable ordering for equal timestamps.
    ordered = sorted(items, key=lambda item: (item[0], item[1]), reverse=True)
    if len({name for _, name in ordered}) != len(ordered):
        raise ValueError('Duplicate backup names: refusing retention')
    keep = ordered[:LIMIT]
    if protected not in {name for _, name in keep}:
        raise ValueError('Current backup is not among newest: refusing retention')
    return ordered[LIMIT:]

def remote_items():
    entries = json.loads(run('rclone', 'lsjson', REMOTE, '--files-only', '--no-mimetype', '--hash'))
    items = []
    for item in entries:
        name = item['Name']
        if NAME.fullmatch(name):
            dt = datetime.datetime.fromisoformat(item['ModTime'].replace('Z', '+00:00'))
            items.append((dt.timestamp(), name, item))
    if len({x[1] for x in items}) != len(items):
        raise ValueError('Duplicate remote names: refusing retention')
    return items

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('backup')
    ap.add_argument('--apply', action='store_true')
    a = ap.parse_args()
    p = Path(a.backup)
    if p.parent != BACKUPS or not NAME.fullmatch(p.name) or p.is_symlink() or not p.is_file():
        raise ValueError('Invalid current backup')
    local = [(x.stat().st_mtime, x.name) for x in BACKUPS.iterdir() if NAME.fullmatch(x.name) and x.is_file() and not x.is_symlink()]
    remote = remote_items()
    matches = [x[2] for x in remote if x[1] == p.name]
    if len(matches) != 1:
        raise ValueError('Current remote backup absent or ambiguous')
    md5 = hashlib.md5(usedforsecurity=False)
    with p.open('rb') as f:
        for chunk in iter(lambda: f.read(1024*1024), b''):
            md5.update(chunk)
    obj = matches[0]
    if obj['Size'] != p.stat().st_size or obj.get('Hashes', {}).get('md5', '').lower() != md5.hexdigest():
        raise ValueError('Current remote backup size/checksum mismatch')
    remote_delete = choose([(t,n) for t,n,_ in remote], p.name)
    local_delete = choose(local, p.name)
    print('Mode:', 'apply' if a.apply else 'dry-run', flush=True)
    for _, name in remote_delete: print('REMOTE:', name, flush=True)
    for _, name in local_delete: print('LOCAL:', name, flush=True)
    if not a.apply:
        return
    for _, name in remote_delete:
        run('rclone', 'deletefile', REMOTE + '/' + name)
    # Only prune local after remote pruning completes; retain copy if any remote error.
    for _, name in local_delete:
        (BACKUPS / name).unlink()
    after = remote_items()
    if len(after) > LIMIT:
        raise ValueError('Remote retention verification failed')
    remaining = [x for x in BACKUPS.iterdir() if NAME.fullmatch(x.name) and x.is_file() and not x.is_symlink()]
    if len(remaining) > LIMIT:
        raise ValueError('Local retention verification failed')
    print(f'Retention verified: local={len(remaining)} remote={len(after)}', flush=True)

if __name__ == '__main__':
    main()
