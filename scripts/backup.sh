#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/home/jbirky/backups/revealjs"
KEEP=14   # number of daily backups to retain
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)

mkdir -p "$BACKUP_DIR"

# Tar both volumes directly from inside a container.
# --user ensures the output file is owned by jbirky, not root.
docker run --rm \
  --user 1000:1000 \
  -v revealjs_gui_revealjs-data:/src/data:ro \
  -v revealjs_gui_revealjs-uploads:/src/uploads:ro \
  -v "$BACKUP_DIR":/backup \
  alpine tar czf "/backup/$TIMESTAMP.tar.gz" -C /src data uploads

# Prune old backups beyond KEEP most recent
ls -1t "$BACKUP_DIR"/*.tar.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm --

echo "$(date '+%Y-%m-%d %H:%M:%S')  backup OK -> $BACKUP_DIR/$TIMESTAMP.tar.gz"
