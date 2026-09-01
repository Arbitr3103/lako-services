#!/usr/bin/env bash
set -euo pipefail
umask 077

if [ "$(id -u)" -ne 0 ]; then
  echo "This installer must run as root" >&2
  exit 1
fi

source_directory=${1:-/tmp/lako-daily-analytics}
source_wrapper=${source_directory}/daily-analytics.sh
source_reporter=${source_directory}/report.mjs
source_chat_id_migration=${source_directory}/migrate-monitor-chat-id.sh
production_wrapper=/usr/local/bin/daily-analytics.sh
production_library=/usr/local/lib/lako-analytics
environment_file=/root/.env
backup_directory=/var/backups/lako-analytics
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_file=${backup_directory}/daily-analytics.${timestamp}.sh

for source_file in "$source_wrapper" "$source_reporter" "$source_chat_id_migration"; do
  if [ ! -r "$source_file" ]; then
    echo "Missing deployment source: $source_file" >&2
    exit 1
  fi
done

bash -n "$source_wrapper"
bash -n "$source_chat_id_migration"
node --check "$source_reporter"

install -d -m 0700 "$backup_directory"
install -m 0600 "$production_wrapper" "$backup_file"

extract_assignment() {
  local variable_name=$1
  sed -nE "s/^${variable_name}=[\"']?([^\"']+)[\"']?$/\\1/p" "$backup_file" | head -1
}

extract_database_password() {
  local database_name=$1 user_name=$2
  sed -nE "s/.*query_db ${database_name} ${user_name} \"([^\"]+)\".*/\\1/p" "$backup_file" | head -1
}

append_environment_value() {
  local variable_name=$1 value=$2
  if grep -q "^${variable_name}=" "$environment_file"; then
    return
  fi
  if [ -z "$value" ]; then
    echo "Cannot migrate missing value for ${variable_name}" >&2
    exit 1
  fi
  printf '\n%s=%q\n' "$variable_name" "$value" >> "$environment_file"
}

touch "$environment_file"
chmod 0600 "$environment_file"

append_environment_value LAKO_ZONE "$(extract_assignment LAKO_ZONE)"
append_environment_value ECHAIN_ZONE "$(extract_assignment ECHAIN_ZONE)"
append_environment_value ECHAIN_DB_PASSWORD "$(extract_database_password echain echain)"
append_environment_value LAKO_BOT_DB_PASSWORD "$(extract_database_password lako_bot lako_bot)"
bash "$source_chat_id_migration" "$backup_file"

# shellcheck disable=SC1090
source "$environment_file"
if ! grep -q '^CF_ACCOUNT_ID=' "$environment_file"; then
  account_id=$(
    curl --silent --show-error --fail-with-body \
      -H "Authorization: Bearer ${CF_API_TOKEN}" \
      "https://api.cloudflare.com/client/v4/zones/${LAKO_ZONE}" \
      | jq -r '.result.account.id // empty' \
      || true
  )
  if [ -n "$account_id" ]; then
    append_environment_value CF_ACCOUNT_ID "$account_id"
  else
    echo "Warning: CF_ACCOUNT_ID could not be derived; Worker check will report ATTENTION" >&2
  fi
fi

install -d -m 0750 "$production_library"
install -m 0640 "$source_reporter" "$production_library/report.mjs"
install -m 0750 "$source_wrapper" "$production_wrapper"
install -d -m 0700 /var/lib/lako-analytics /var/log/monitoring
touch /var/log/monitoring/analytics.log
chmod 0600 /var/log/monitoring/analytics.log

bash -n "$production_wrapper"
node --check "$production_library/report.mjs"

echo "Installed daily analytics reporter"
echo "Backup: $backup_file"
