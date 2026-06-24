#!/bin/bash
set -euo pipefail
# Bili Progress PWA — database backup script
# Run daily via cron: backs up data.db including WAL, keeps last 7 copies.
# Uses sqlite3 Online Backup API (.backup) which is WAL-safe.

SRC="/root/workspace/projects/bili-progress-pwa/server/data.db"
BACKUP_DIR="/root/workspace/projects/bili-progress-pwa/server/backups"
DEST="$BACKUP_DIR/data.$(date +%Y%m%d).db"
LOG_TAG="bili-backup"

if [ ! -f "$SRC" ]; then
  echo "$LOG_TAG ERROR: source not found: $SRC" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

# WAL-safe: sqlite3 .backup reads main db + WAL via Online Backup API
sqlite3 "$SRC" ".backup '$DEST'"
chmod 600 "$DEST"

# Validate: must be > 32KB (empty WAL-mode db is 4KB)
SIZE=$(stat -c%s "$DEST")
if [ "$SIZE" -lt 32768 ]; then
  echo "$LOG_TAG ERROR: backup ${SIZE}B < 32KB — looks empty, aborting" >&2
  rm -f "$DEST"
  exit 1
fi

# Validate: videos table must have rows
ROWS=$(sqlite3 "$DEST" "SELECT COUNT(*) FROM videos;" 2>/dev/null || echo "0")
if [ "$ROWS" -eq 0 ]; then
  echo "$LOG_TAG ERROR: videos table empty in backup — aborting" >&2
  rm -f "$DEST"
  exit 1
fi

echo "$LOG_TAG OK: $DEST (${SIZE}B, ${ROWS} videos)"

# Keep last 7 days
find "$BACKUP_DIR" -name "data.*.db" -mtime +7 -delete
