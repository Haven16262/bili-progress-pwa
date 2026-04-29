#!/bin/bash
set -euo pipefail
# Bili Progress PWA — database backup script
# Run daily via cron: backs up data.db, keeps last 7 copies

SRC="/root/workspace/projects/bili-progress-pwa/server/data.db"
BACKUP_DIR="/root/workspace/projects/bili-progress-pwa/server/backups"

mkdir -p "$BACKUP_DIR"

if [ -f "$SRC" ]; then
  cp "$SRC" "$BACKUP_DIR/data.$(date +%Y%m%d).db"
  find "$BACKUP_DIR" -name "data.*.db" -mtime +7 -delete
fi
