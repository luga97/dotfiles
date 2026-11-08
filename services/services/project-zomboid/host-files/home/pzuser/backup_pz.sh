#!/bin/bash
set -euo pipefail
cd /home/pzuser/Zomboid
backup_dir=/home/pzuser/backups
mkdir -p "$backup_dir"
backup="$backup_dir/pz_backup_$(date +%Y%m%d_%H%M%S).zip"
tmp="$backup.partial"
trap 'rm -f "$tmp"' EXIT
zip -qr "$tmp" Saves Server db
unzip -tq "$tmp" >/dev/null
mv "$tmp" "$backup"
echo "Verified local backup: $backup"
rclone copy "$backup" drive:ZomboidBackups
echo "Uploaded backup: $backup"
