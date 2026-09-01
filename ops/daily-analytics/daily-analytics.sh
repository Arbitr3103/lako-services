#!/usr/bin/env bash
set -euo pipefail
umask 077

ENV_FILE=${ANALYTICS_ENV_FILE:-/root/.env}
LIB_DIR=${ANALYTICS_LIB_DIR:-/usr/local/lib/lako-analytics}
REPORTER=${ANALYTICS_REPORTER:-${LIB_DIR}/report.mjs}
STATE_FILE=${ANALYTICS_STATE_FILE:-/var/lib/lako-analytics/state.json}
LOG_FILE=${ANALYTICS_LOG_FILE:-/var/log/monitoring/analytics.log}
CF_API=https://api.cloudflare.com/client/v4/graphql
CURL_TIMEOUT=20
LAKO_POST_HOST=lako.services
SEND_REPORT=true
PRINT_REPORT=false
COMMIT_STATE=true
REPORT_DATE=$(date -u -d yesterday +%Y-%m-%d)

usage() {
  echo "Usage: daily-analytics.sh [--dry-run | --send-test] [--date YYYY-MM-DD]" >&2
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run)
      SEND_REPORT=false
      PRINT_REPORT=true
      COMMIT_STATE=false
      ;;
    --send-test)
      SEND_REPORT=true
      PRINT_REPORT=true
      COMMIT_STATE=true
      ;;
    --date)
      [ "$#" -ge 2 ] || { usage; exit 2; }
      REPORT_DATE=$2
      shift
      ;;
    *)
      usage
      exit 2
      ;;
  esac
  shift
done

if ! [[ "$REPORT_DATE" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
  echo "Invalid report date: $REPORT_DATE" >&2
  exit 2
fi

if [ ! -r "$ENV_FILE" ]; then
  echo "Analytics environment file is not readable: $ENV_FILE" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

required_variables=(
  CF_API_TOKEN
  MONITOR_BOT_TOKEN
  MONITOR_CHAT_ID
  LAKO_ZONE
  ECHAIN_ZONE
  ECHAIN_DB_PASSWORD
  LAKO_BOT_DB_PASSWORD
)
for variable_name in "${required_variables[@]}"; do
  if [ -z "${!variable_name:-}" ]; then
    echo "Missing required environment variable: $variable_name" >&2
    exit 1
  fi
done

if [ ! -r "$REPORTER" ]; then
  echo "Analytics reporter is not readable: $REPORTER" >&2
  exit 1
fi

mkdir -p "$(dirname "$STATE_FILE")" "$(dirname "$LOG_FILE")"
temporary_directory=$(mktemp -d)
trap 'rm -rf "$temporary_directory"' EXIT

log_event() {
  printf '%s %s\n' "$(date -u '+%Y-%m-%d %H:%M:%S UTC')" "$1" >> "$LOG_FILE"
}

capture_query() {
  local output_file=$1
  local component=$2
  shift 2
  if ! "$@" > "$output_file" 2> "$temporary_directory/query-error"; then
    jq -n --arg component "$component" '{monitorError:"query_failed", component:$component}' > "$output_file"
    log_event "Analytics query failed: ${component}"
  fi
}

post_graphql() {
  local payload=$1
  curl --silent --show-error --fail-with-body "$CF_API" \
    -H "Authorization: Bearer ${CF_API_TOKEN}" \
    -H "Content-Type: application/json" \
    --max-time "$CURL_TIMEOUT" \
    --data "$payload"
}

query_zone_metrics() {
  local zone=$1
  local query payload
  query='query DailyZone($zoneTag: string, $date: Date) { viewer { zones(filter: {zoneTag: $zoneTag}) { httpRequests1dGroups(limit: 1, filter: {date: $date}) { sum { requests pageViews threats bytes browserMap { pageViews uaBrowserFamily } responseStatusMap { edgeResponseStatus requests } countryMap { clientCountryName requests } } uniq { uniques } } } } }'
  payload=$(jq -cn --arg query "$query" --arg zoneTag "$zone" --arg date "$REPORT_DATE" \
    '{query:$query, variables:{zoneTag:$zoneTag, date:$date}}')
  post_graphql "$payload"
}

query_lako_firewall() {
  local query payload start_time end_time
  start_time=$(date -u -d '23 hours 50 minutes ago' +%Y-%m-%dT%H:%M:%SZ)
  end_time=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  query='query FirewallEvents($zoneTag: string, $start: Time, $end: Time) { viewer { zones(filter: {zoneTag: $zoneTag}) { firewallEventsAdaptive(filter: {datetime_geq: $start, datetime_lt: $end}, limit: 1000, orderBy: [datetime_DESC]) { action clientIP clientRequestPath datetime source } } } }'
  payload=$(jq -cn --arg query "$query" --arg zoneTag "$LAKO_ZONE" --arg start "$start_time" --arg end "$end_time" \
    '{query:$query, variables:{zoneTag:$zoneTag, start:$start, end:$end}}')
  post_graphql "$payload"
}

query_lako_posts() {
  local query payload start_time end_time
  start_time=$(date -u -d "${REPORT_DATE} 00:00:00" +%Y-%m-%dT%H:%M:%SZ)
  end_time=$(date -u -d "${REPORT_DATE} 00:00:00 + 1 day" +%Y-%m-%dT%H:%M:%SZ)
  query='query PostRequests($zoneTag: string, $start: Time, $end: Time, $host: string) { viewer { zones(filter: {zoneTag: $zoneTag}) { httpRequestsAdaptiveGroups(filter: {datetime_geq: $start, datetime_lt: $end, clientRequestHTTPHost: $host}, limit: 10000, orderBy: [count_DESC]) { count dimensions { clientRequestHTTPHost clientRequestHTTPMethodName clientRequestPath edgeResponseStatus } } } } }'
  payload=$(jq -cn --arg query "$query" --arg zoneTag "$LAKO_ZONE" --arg start "$start_time" --arg end "$end_time" \
    --arg host "$LAKO_POST_HOST" \
    '{query:$query, variables:{zoneTag:$zoneTag, start:$start, end:$end, host:$host}}')
  post_graphql "$payload"
}

query_lako_worker() {
  if [ -z "${CF_ACCOUNT_ID:-}" ]; then
    jq -n '{monitorError:"account_id_unavailable", component:"lako-worker"}'
    return
  fi

  local query payload start_time end_time
  start_time=$(date -u -d "${REPORT_DATE} 00:00:00" +%Y-%m-%dT%H:%M:%SZ)
  end_time=$(date -u -d "${REPORT_DATE} 00:00:00 + 1 day" +%Y-%m-%dT%H:%M:%SZ)
  query='query WorkerErrors($accountTag: string, $start: string, $end: string, $scriptName: string) { viewer { accounts(filter: {accountTag: $accountTag}) { workersInvocationsAdaptive(limit: 1000, filter: {scriptName: $scriptName, datetime_geq: $start, datetime_lt: $end}) { sum { requests errors } dimensions { status scriptName } } } } }'
  payload=$(jq -cn --arg query "$query" --arg accountTag "$CF_ACCOUNT_ID" \
    --arg start "$start_time" --arg end "$end_time" --arg scriptName "${LAKO_WORKER_NAME:-lako-services}" \
    '{query:$query, variables:{accountTag:$accountTag, start:$start, end:$end, scriptName:$scriptName}}')
  post_graphql "$payload"
}

query_db() {
  local database=$1 user=$2 password=$3 sql=$4
  PGPASSWORD="$password" psql -h localhost -p 5433 -U "$user" -d "$database" -t -A -c "$sql" 2>/dev/null || echo ERR
}

send_telegram() {
  local message=$1 response_file=$2
  if ! curl --silent --show-error --fail-with-body -X POST \
    "https://api.telegram.org/bot${MONITOR_BOT_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${MONITOR_CHAT_ID}" \
    --data-urlencode 'parse_mode=HTML' \
    --data-urlencode 'disable_web_page_preview=true' \
    --data-urlencode "text=${message}" \
    --max-time "$CURL_TIMEOUT" > "$response_file"; then
    return 1
  fi
  jq -e '.ok == true' "$response_file" > /dev/null
}

capture_query "$temporary_directory/lako-metrics.json" lako-metrics query_zone_metrics "$LAKO_ZONE"
capture_query "$temporary_directory/echain-metrics.json" echain-metrics query_zone_metrics "$ECHAIN_ZONE"
capture_query "$temporary_directory/lako-firewall.json" lako-firewall query_lako_firewall
capture_query "$temporary_directory/lako-posts.json" lako-posts query_lako_posts
capture_query "$temporary_directory/lako-worker.json" lako-worker query_lako_worker

echain_new_users=$(query_db echain echain "$ECHAIN_DB_PASSWORD" \
  "SELECT count(*) FROM \"User\" WHERE \"createdAt\"::date = '${REPORT_DATE}'")
echain_new_docs=$(query_db echain echain "$ECHAIN_DB_PASSWORD" \
  "SELECT count(*) FROM \"Document\" WHERE \"createdAt\"::date = '${REPORT_DATE}'")
echain_new_trips=$(query_db echain echain "$ECHAIN_DB_PASSWORD" \
  "SELECT count(*) FROM \"Trip\" WHERE \"createdAt\"::date = '${REPORT_DATE}'")
echain_total_users=$(query_db echain echain "$ECHAIN_DB_PASSWORD" 'SELECT count(*) FROM "User"')
echain_total_docs=$(query_db echain echain "$ECHAIN_DB_PASSWORD" 'SELECT count(*) FROM "Document"')
efaktura_new=$(query_db lako_bot lako_bot "$LAKO_BOT_DB_PASSWORD" \
  "SELECT count(*) FROM \"EfakturaInvoice\" WHERE \"createdAt\"::date = '${REPORT_DATE}'")
efaktura_audit=$(query_db lako_bot lako_bot "$LAKO_BOT_DB_PASSWORD" \
  "SELECT count(*) FROM \"EfakturaAuditLog\" WHERE \"createdAt\"::date = '${REPORT_DATE}'")

jq -n \
  --arg date "$REPORT_DATE" \
  --arg generatedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --slurpfile lakoMetrics "$temporary_directory/lako-metrics.json" \
  --slurpfile echainMetrics "$temporary_directory/echain-metrics.json" \
  --slurpfile lakoFirewall "$temporary_directory/lako-firewall.json" \
  --slurpfile lakoPosts "$temporary_directory/lako-posts.json" \
  --slurpfile lakoWorker "$temporary_directory/lako-worker.json" \
  --arg echainNewUsers "$echain_new_users" \
  --arg echainNewDocs "$echain_new_docs" \
  --arg echainNewTrips "$echain_new_trips" \
  --arg echainTotalUsers "$echain_total_users" \
  --arg echainTotalDocs "$echain_total_docs" \
  --arg efakturaNew "$efaktura_new" \
  --arg efakturaAudit "$efaktura_audit" \
  '{
    date:$date,
    generatedAt:$generatedAt,
    sites:[
      {
        name:"lako.services",
        securityMonitored:true,
        allowedPostPaths:["/api/contact", "/api/register-business", "/cdn-cgi/"],
        metricsRaw:$lakoMetrics[0],
        firewallRaw:$lakoFirewall[0],
        postsRaw:$lakoPosts[0],
        workerRaw:$lakoWorker[0]
      },
      {name:"app.echain.world", securityMonitored:false, metricsRaw:$echainMetrics[0]}
    ],
    database:{
      echainNewUsers:$echainNewUsers,
      echainNewDocs:$echainNewDocs,
      echainNewTrips:$echainNewTrips,
      echainTotalUsers:$echainTotalUsers,
      echainTotalDocs:$echainTotalDocs,
      efakturaNew:$efakturaNew,
      efakturaAudit:$efakturaAudit
    }
  }' > "$temporary_directory/input.json"

node "$REPORTER" render \
  --input "$temporary_directory/input.json" \
  --state-file "$STATE_FILE" \
  --output "$temporary_directory/result.json"

message=$(jq -r '.message' "$temporary_directory/result.json")
status=$(jq -r '.summary.status' "$temporary_directory/result.json")

if [ "$PRINT_REPORT" = true ]; then
  printf '%s\n' "$message"
fi

if [ "$SEND_REPORT" = true ]; then
  if ! send_telegram "$message" "$temporary_directory/telegram-response.json"; then
    log_event "Analytics Telegram delivery failed for ${REPORT_DATE} status=${status}"
    echo "Telegram delivery failed" >&2
    exit 1
  fi
  if [ "$COMMIT_STATE" = true ]; then
    node "$REPORTER" commit \
      --result "$temporary_directory/result.json" \
      --state-file "$STATE_FILE"
  fi
  log_event "Analytics sent for ${REPORT_DATE} status=${status}"
fi
