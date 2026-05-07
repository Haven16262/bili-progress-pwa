#!/bin/bash
set -euo pipefail
# Bili Progress PWA — database backup script
# Run daily via cron: backs up data.db, keeps last 7 copies
#
# Usage:
#   SRC=/path/to/server/data.db BACKUP_DIR=/path/to/backups ./backup.sh
# Or edit the defaults below to match your deployment.

SRC="${SRC:-/path/to/your/server/data.db}"
BACKUP_DIR="${BACKUP_DIR:-/path/to/your/backups}"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

if [ -f "$SRC" ]; then
  cp "$SRC" "$BACKUP_DIR/data.$(date +%Y%m%d).db"
  chmod 600 "$BACKUP_DIR/data.$(date +%Y%m%d).db"
  find "$BACKUP_DIR" -name "data.*.db" -mtime +7 -delete
fi
