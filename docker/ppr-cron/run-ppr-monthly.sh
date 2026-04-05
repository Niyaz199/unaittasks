#!/bin/sh
set -eu

if [ -z "${CRON_SECRET:-}" ]; then
  echo "[ppr-cron] CRON_SECRET is not set"
  exit 1
fi

TARGET_URL="${APP_INTERNAL_URL:-http://app:3000}/api/ppr/cron/monthly"
TIMESTAMP="$(date '+%Y-%m-%dT%H:%M:%S%z')"

echo "[ppr-cron] ${TIMESTAMP} POST ${TARGET_URL}"

curl \
  --silent \
  --show-error \
  --fail \
  --request POST \
  --header "x-cron-secret: ${CRON_SECRET}" \
  "${TARGET_URL}"

echo
echo "[ppr-cron] ${TIMESTAMP} monthly cycle completed"
