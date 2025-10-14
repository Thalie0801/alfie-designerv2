#!/usr/bin/env bash
set -euo pipefail
# Purge des rendus > retention_days (défaut 30)
RETENTION_DAYS="${RETENTION_DAYS:-30}"
echo "[cleanup] purging assets older than ${RETENTION_DAYS} days..."
# Implémenter selon votre storage (S3/GCS) en filtrant par prefix YYYY-MM/Marque
echo "[cleanup] done."
