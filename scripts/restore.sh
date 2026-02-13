#!/bin/bash
# scripts/restore.sh — 還原 PostgreSQL 資料庫
set -e

if [ -z "$1" ]; then
  echo "用法: ./restore.sh <備份檔案路徑>"
  echo "範例: ./restore.sh backups/backup_20260201_020000.dump"
  exit 1
fi

if [ ! -f "$1" ]; then
  echo "錯誤: 備份檔案不存在: $1"
  exit 1
fi

echo "即將還原資料庫，此操作會覆蓋現有資料！"
read -p "確認繼續？(y/N) " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
  echo "已取消"
  exit 0
fi

echo "開始還原..."
docker exec -i db pg_restore -U postgres -d recycle_db --clean < "$1"
echo "還原完成: $1"
