#!/bin/sh
set -eu

if [ -z "${CRON_SECRET:-}" ]; then
  echo "[task-archive-cron] CRON_SECRET is not set"
  exit 1
fi

TARGET_URL="${APP_INTERNAL_URL:-http://app:3000}/api/cron/archive"
TIMESTAMP="$(date -Iseconds)"

echo "[task-archive-cron] ${TIMESTAMP} POST ${TARGET_URL}"

curl \
  --silent \
  --show-error \
  --fail \
  --request POST \
  --header "x-cron-secret: ${CRON_SECRET}" \
  "${TARGET_URL}"

echo
echo "[task-archive-cron] ${TIMESTAMP} completed"
