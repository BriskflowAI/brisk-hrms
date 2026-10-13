#!/usr/bin/env bash
# Check the production sites from outside, over HTTPS with full certificate checks.
# The deploy workflow runs this on the runner. A person can run it from any machine.
#
# Usage: verify-sites.sh [--flow-site <host>] <host> [<host>...]
#
# For each host: the home page answers, and /api/method/ping returns "pong".
# For the flow site: /flow answers, and the first script it links to also loads.
# A stale script link is the cause of "Invalid Request" on /flow after a deploy.
# A user can still need a hard reload to drop a cached copy; this script cannot check that.
#
# Environment: VERIFY_DEADLINE (UTC epoch); otherwise VERIFY_ATTEMPTS (20).
# VERIFY_DELAY defaults to 10 seconds. Deadline mode retries until its deadline.

set -euo pipefail

attempts="${VERIFY_ATTEMPTS:-20}"
delay="${VERIFY_DELAY:-10}"
deadline="${VERIFY_DEADLINE:-0}"
[[ "$deadline" =~ ^[0-9]+$ && "$delay" =~ ^[0-9]+$ && "$attempts" =~ ^[1-9][0-9]*$ ]] || exit 2
flow_site=""
hosts=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --flow-site) flow_site="${2:?--flow-site needs a host}"; shift 2 ;;
    -*) echo "unknown option: $1" >&2; exit 2 ;;
    *) hosts+=("$1"); shift ;;
  esac
done
[[ ${#hosts[@]} -gt 0 ]] || { echo "usage: $0 [--flow-site <host>] <host>..." >&2; exit 2; }

remaining() { printf '%s\n' "$((deadline - $(date +%s)))"; }
# shellcheck disable=SC2329 # called through the readiness callbacks
bounded_curl() {
  local max=20 left
  if (( deadline > 0 )); then
    left=$(remaining)
    (( left > 0 )) || return 1
    (( left >= max )) || max=$left
  fi
  curl --connect-timeout "$max" --max-time "$max" "$@"
}
retry() {
  local what="$1" n=1 wait_time left
  shift
  until "$@"; do
    wait_time=$delay
    if (( deadline > 0 )); then
      left=$(remaining)
      if (( left <= 0 )); then echo "FAIL at readiness deadline: $what"; return 1; fi
      (( left >= wait_time )) || wait_time=$left
    elif (( n >= attempts )); then echo "FAIL: $what"; return 1; fi
    n=$((n + 1)); sleep "$wait_time"
  done
  echo "ok: $what"
}

# shellcheck disable=SC2329  # called through retry
http_ok() { bounded_curl -fsS -o /dev/null "$1"; }
# shellcheck disable=SC2329
ping_ok() { bounded_curl -fsS "https://$1/api/method/ping" | grep pong >/dev/null; }

# shellcheck disable=SC2329
flow_ok() {
  local host="$1" page asset
  page="$(bounded_curl -fsSL "https://${host}/flow")" || return 1
  asset="$(printf '%s' "$page" | grep -oE '(src|href)="[^"]*/assets/hrms/flow/[^"]*\.js"' | head -1 | cut -d'"' -f2)"
  [[ -n "$asset" ]] || { echo "no flow script link found on /flow"; return 1; }
  case "$asset" in
    http*) ;;
    *) asset="https://${host}${asset}" ;;
  esac
  bounded_curl -fsS -o /dev/null "$asset"
}

status=0
for host in "${hosts[@]}"; do
  retry "${host} home page over HTTPS" http_ok "https://${host}/" || status=1
  retry "${host} /api/method/ping" ping_ok "$host" || status=1
done
if [[ -n "$flow_site" ]]; then
  retry "${flow_site} /flow and its script" flow_ok "$flow_site" || status=1
fi
exit "$status"
