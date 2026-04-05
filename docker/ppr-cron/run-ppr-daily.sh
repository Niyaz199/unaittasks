#!/bin/sh
set -eu

if [ -z "${CRON_SECRET:-}" ]; then
  echo "[ppr-cron] CRON_SECRET is not set"
  exit 1
fi

TARGET_URL="${APP_INTERNAL_URL:-http://app:3000}/api/ppr/cron/run"
TODAY="$(date '+%Y-%m-%d')"
RUN_ID="$(cat /proc/sys/kernel/random/uuid)"
TIMESTAMP="$(date '+%Y-%m-%dT%H:%M:%S%z')"
PAYLOAD="{\"date_from\":\"${TODAY}\",\"date_to\":\"${TODAY}\",\"run_id\":\"${RUN_ID}\"}"

echo "[ppr-cron] ${TIMESTAMP} POST ${TARGET_URL} ${PAYLOAD}"

curl \
  --silent \
  --show-error \
  --fail \
  --request POST \
  --header "Content-Type: application/json" \
  --header "x-cron-secret: ${CRON_SECRET}" \
  --data "${PAYLOAD}" \
  "${TARGET_URL}"

echo
echo "[ppr-cron] ${TIMESTAMP} daily run completed"
