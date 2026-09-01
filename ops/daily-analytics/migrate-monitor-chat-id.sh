#!/usr/bin/env bash
set -euo pipefail
umask 077

if [ "$(id -u)" -ne 0 ]; then
  echo "This migration must run as root" >&2
  exit 1
fi

backup_file=${1:?Usage: migrate-monitor-chat-id.sh /path/to/legacy-backup}
environment_file=/root/.env

if grep -q '^MONITOR_CHAT_ID=' "$environment_file"; then
  echo "MONITOR_CHAT_ID already present"
  exit 0
fi

chat_id_line=$(grep -m1 -E 'chat_id=' "$backup_file" || true)
chat_id=$(printf '%s\n' "$chat_id_line" | grep -oE "chat_id=[\"']?-?[0-9]+" | head -1 | sed -E "s/^chat_id=[\"']?//" || true)

if [ -z "$chat_id" ]; then
  referenced_variable=$(printf '%s\n' "$chat_id_line" \
    | grep -oE '\$\{?(MONITOR_CHAT_ID|TELEGRAM_CHAT_ID)\}?' \
    | head -1 \
    | tr -d '${}' \
    || true)
  if [ -n "$referenced_variable" ]; then
    # shellcheck disable=SC1090
    source "$environment_file"
    chat_id=${!referenced_variable:-}
  fi
fi

if [ -z "$chat_id" ] || ! [[ "$chat_id" =~ ^-?[0-9]+$ ]]; then
  echo "Could not migrate MONITOR_CHAT_ID from legacy backup" >&2
  exit 1
fi

printf '\nMONITOR_CHAT_ID=%q\n' "$chat_id" >> "$environment_file"
chmod 0600 "$environment_file"
echo "MONITOR_CHAT_ID migrated"
