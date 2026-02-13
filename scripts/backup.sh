#!/bin/bash
# scripts/backup.sh — 手動備份 PostgreSQL 資料庫
set -e

BACKUP_DIR="backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.dump"

mkdir -p "${BACKUP_DIR}"

echo "開始備份..."
docker exec db pg_dump -Fc -U postgres recycle_db > "${BACKUP_FILE}"
echo "備份完成: ${BACKUP_FILE}"

# 清理 30 天前的備份
find "${BACKUP_DIR}" -name "backup_*.dump" -mtime +30 -delete 2>/dev/null || true
echo "已清理 30 天前的備份"
