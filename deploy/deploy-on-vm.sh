#!/usr/bin/env bash
# Root-only supervised transaction. start <request.json>; status <id>;
# verdict <id> pass|fail; recover <id> (OWNER: access recovery before mutation;
# full data restore after mutation can lose new writes).
# Requests come from deploy.yml. No password enters the request or deployment record.
# Persistent state/scripts: /var/lib/brisk-deploy; journal: brisk-deploy-<id>.service.
set -Eeuo pipefail
umask 077
ROOT=/var/lib/brisk-deploy
LOCK=/var/lock/brisk-deploy.lock
PHASE=queued PREVIOUS_IMAGE='' BACKUP_FOLDER='' SNAPSHOT='' OPENED=false CHANGED=false
ACTIVE_CONTAINER='' COMMAND_IMAGE='' RUN_DIR='' IMAGE='' ID='' DEPLOY_DIR='' BACKUP_BUCKET=''
RECOVERY_OF='' RECOVERY_VERIFIED=false WORKERS_DRAINED=false QUEUES_SUSPENDED=false
SITE_STATES='{}' VERDICT_DEADLINE=0 STOP_CLIENTS=() PENDING_STOPS='[]' CLOSURE_STARTED=false
BENCH_PYTHON=/home/frappe/frappe-bench/env/bin/python
SITES_DIR=/home/frappe/frappe-bench/sites
SITES=() WORKERS=(queue-short queue-long) WEB_WRITERS=(frontend backend websocket scheduler) WRITERS=(frontend backend websocket scheduler queue-short queue-long)

fail() { echo "ERROR: $*" >&2; return 1; }
valid_id() { [[ "$1" =~ ^[0-9]+-[0-9]+(-recover-[0-9]+)?$ ]]; }
valid_image() { [[ "$1" =~ ^[a-zA-Z0-9./:_-]+@sha256:[0-9a-f]{64}$ ]]; }
compose() {
  # One-off commands use inspected runtime history even when .env has a stale IMAGE.
  if [[ -n "$COMMAND_IMAGE" ]]; then
    (cd "$DEPLOY_DIR" && IMAGE="$COMMAND_IMAGE" docker compose "$@")
  else
    (cd "$DEPLOY_DIR" && docker compose "$@")
  fi
}

# All replacements check errors explicitly, including calls inside an if/&& list.
set_image() {
  local image="$1" tmp
  valid_image "$image" || return 1
  [[ $(grep -c '^IMAGE=' "$DEPLOY_DIR/.env") == 1 ]] || return 1
  tmp=$(mktemp "$DEPLOY_DIR/.env.XXXXXX") || return 1
  if ! sed "s|^IMAGE=.*|IMAGE=$image|" "$DEPLOY_DIR/.env" > "$tmp" \
      || ! chown --reference="$DEPLOY_DIR/.env" "$tmp" \
      || ! chmod --reference="$DEPLOY_DIR/.env" "$tmp" \
      || ! sync -f "$tmp"; then
    rm -f "$tmp"; return 1
  fi
  mv -f "$tmp" "$DEPLOY_DIR/.env" || { rm -f "$tmp"; return 1; }
  sync -f "$DEPLOY_DIR"
}

# Read-only retention inventory. Include owner recovery records and serialize it
# against the same transaction lock; never infer an outcome from cloud labels.
retention_records() {
  exec 7<"$LOCK"
  flock --shared --timeout 30 7 || fail 'VM transaction still active; retain snapshots.'
  local file id files=()
  for file in "$ROOT"/*/record.json; do
    [[ -f "$file" ]] || continue
    id=$(jq -er '.id' "$file") || return 1
    valid_id "$id" || return 1
    [[ "$file" == "$ROOT/$id/record.json" ]] || return 1
    jq -e 'type=="object" and (.phase|type)=="string"' "$file" >/dev/null || return 1
    files+=("$file")
  done
  if (( ${#files[@]} == 0 )); then printf '[]\n'; return; fi
  jq -s 'map({id,phase,snapshot,project,zone,disk,opened,changed,pending_stops,
              recovery_of,recovery_verified,owner_recovery,recovery_changed,
              recovery_image,restore_folder,previous_image,backup_folder})' "${files[@]}"
}

record() {
  PHASE=$1
  local tmp="$RUN_DIR/record.tmp" restore_id="$ID"
  if [[ -n "$RECOVERY_OF" && "$RECOVERY_VERIFIED" == false ]]; then restore_id=$RECOVERY_OF; fi
  jq --arg phase "$PHASE" --arg previous_image "$PREVIOUS_IMAGE" \
     --arg backup_folder "$BACKUP_FOLDER" --arg snapshot "$SNAPSHOT" --arg command_image "$COMMAND_IMAGE" \
     --argjson opened "$OPENED" --argjson changed "$CHANGED" \
     --arg recovery_of "$RECOVERY_OF" --argjson recovery_verified "$RECOVERY_VERIFIED" \
     --argjson workers_drained "$WORKERS_DRAINED" --argjson queues_suspended "$QUEUES_SUSPENDED" \
     --argjson site_states "$SITE_STATES" --argjson verdict_deadline "$VERDICT_DEADLINE" \
     --argjson pending_stops "$PENDING_STOPS" --argjson closure_started "$CLOSURE_STARTED" \
     --arg restore_command "sudo $ROOT/$restore_id/deploy-on-vm.sh recover $restore_id" \
     '. + {phase:$phase,previous_image:$previous_image,backup_folder:$backup_folder,
           snapshot:$snapshot,command_image:$command_image,opened:$opened,changed:$changed,
           recovery_of:$recovery_of,recovery_verified:$recovery_verified,workers_drained:$workers_drained,
           queues_suspended:$queues_suspended,site_states:$site_states,verdict_deadline:$verdict_deadline,
           pending_stops:$pending_stops,closure_started:$closure_started,
           manual_restore_command:$restore_command}' \
     "$RUN_DIR/request.json" > "$tmp" || return 1
  sync -f "$tmp" || return 1
  mv -f "$tmp" "$RUN_DIR/record.json" || return 1
  # A failed recovery attempt cannot clear the original unresolved transaction.
  if [[ -n "$RECOVERY_OF" && "$RECOVERY_VERIFIED" == false ]]; then
    echo "PHASE=$PHASE (original recovery barrier retained)"
    return 0
  fi
  cp "$RUN_DIR/record.json" "$ROOT/current.tmp" || return 1
  sync -f "$ROOT/current.tmp" || return 1
  mv -f "$ROOT/current.tmp" "$ROOT/current.json" || return 1
  sync -f "$ROOT" || return 1
  echo "PHASE=$PHASE"
}

# Background only the Docker client so signals interrupt wait immediately. Stop the
# named container before recovery: killing the SSH/Docker client alone is insufficient.
run_backend() {
  ACTIVE_CONTAINER="brisk-cd-$ID-command"
  compose run --no-deps -T --entrypoint /usr/bin/env ${RUN_WORKDIR:+--workdir "$RUN_WORKDIR"} \
    --name "$ACTIVE_CONTAINER" backend "$@" <&0 &
  local child=$! code=0
  wait "$child" || code=$?
  # Keep a failed command's stopped container until the trap proves termination.
  (( code == 0 )) || return "$code"
  docker rm "$ACTIVE_CONTAINER" >/dev/null || return 1
  ACTIVE_CONTAINER=''
}
# Frappe helpers run from sites/, as bench runs them; its loggers use paths relative to it.
run_frappe() {
  RUN_WORKDIR="$SITES_DIR" run_backend "$@"
}
stop_active() {
  [[ -n "$ID" ]] || return 0
  local name="brisk-cd-$ID-command" cid
  cid=$(docker ps -aq --filter "name=^/$name$") || return 1
  if [[ -n "$cid" ]]; then
    docker stop --time 300 "$cid" >/dev/null || return 1
    cid=$(docker ps -q --filter "name=^/$name$") || return 1
    [[ -z "$cid" ]] || return 1
    docker rm "$name" >/dev/null || return 1
  elif [[ -n "$ACTIVE_CONTAINER" ]]; then
    # Signal during container creation: do not restore without proof it stopped.
    return 1
  fi
  ACTIVE_CONTAINER=''
}
stop_clients() {
  (( ${#STOP_CLIENTS[@]} > 0 )) || return 0
  local pid
  for pid in "${STOP_CLIENTS[@]}"; do kill -TERM "$pid" 2>/dev/null || true; wait "$pid" 2>/dev/null || true; done
  STOP_CLIENTS=()
}
worker_ids() { compose ps -aq "${WORKERS[@]}"; }
bounded_docker() {
  local deadline="$1" left
  shift
  left=$((deadline - SECONDS)); (( left > 0 )) || return 124
  timeout "$left" docker "$@"
}
bounded_compose() {
  local deadline="$1" left
  shift
  left=$((deadline - SECONDS)); (( left > 0 )) || return 124
  (cd "$DEPLOY_DIR" && IMAGE="$COMMAND_IMAGE" timeout "$left" docker compose "$@")
}
# Emergency closure never kills a running job. Pause workers; an owner recovery
# suspends queue pickup, then unpauses them to finish before any data restoration.
stop_writers() {
  compose stop --timeout 300 "${WEB_WRITERS[@]}" || return 1
  local cid state ids
  ids=$(worker_ids) || return 1
  while read -r cid; do
    [[ -n "$cid" ]] || continue
    state=$(docker inspect --format '{{json .State}}' "$cid") || return 1
    if jq -e '.Running and (.Paused|not)' <<< "$state" >/dev/null; then docker pause "$cid" >/dev/null || return 1; fi
  done <<< "$ids"
}
queue_control() {
  run_frappe timeout 30 "$BENCH_PYTHON" -c 'import sys,frappe
from frappe.utils.background_jobs import get_redis_conn
from rq.suspension import suspend,resume,is_suspended
frappe.init(site=sys.argv[1],sites_path="/home/frappe/frappe-bench/sites")
c=get_redis_conn()
if sys.argv[2]=="suspend": suspend(c)
elif sys.argv[2]=="resume": resume(c)
else: assert not is_suspended(c)' "${SITES[0]}" "$1"
}
worker_status() {
  run_frappe timeout "$1" "$BENCH_PYTHON" -c 'import json,sys,frappe
from frappe.utils.background_jobs import get_redis_conn
from rq import Worker
frappe.init(site=sys.argv[1],sites_path="/home/frappe/frappe-bench/sites")
print(json.dumps([{"host":w.hostname,"state":w.get_state(),"job":w.get_current_job_id()} for w in Worker.all(connection=get_redis_conn())]))' "${SITES[0]}"
}
# RQ suspension prevents new dequeue without stopping active jobs. Require every
# running container to acknowledge suspended state after its job/callbacks finish.
# The common deadline is ten minutes, below Frappe long-job's 1500s timeout.
drain_workers() {
  local deadline=$((SECONDS + 600)) cid state host statuses ready remaining pid
  local ids=() hosts=() id_list
  QUEUES_SUSPENDED=true
  queue_control suspend || return 1
  record draining || return 1
  id_list=$(bounded_compose "$deadline" ps -aq "${WORKERS[@]}") || return 2
  while read -r cid; do
    [[ -n "$cid" ]] || continue
    ids+=("$cid")
    state=$(bounded_docker "$deadline" inspect --format '{{json .State}}' "$cid") || return 1
    if jq -e '.Running' <<< "$state" >/dev/null; then
      if jq -e '.Paused' <<< "$state" >/dev/null; then bounded_docker "$deadline" unpause "$cid" >/dev/null || return 1; fi
      host=$(bounded_docker "$deadline" inspect --format '{{.Config.Hostname}}' "$cid") || return 1
      hosts+=("$host")
    else
      jq -e '.ExitCode == 0 and (.OOMKilled|not)' <<< "$state" >/dev/null || return 2
    fi
  done <<< "$id_list"
  [[ ${#ids[@]} == 2 ]] || return 1
  while :; do
    remaining=$((deadline - SECONDS))
    (( remaining > 0 )) || return 2
    if worker_status "$remaining" > "$RUN_DIR/workers.json"; then :; else
      # This helper only reads RQ metadata. It has exited before returning failure.
      ACTIVE_CONTAINER=''
      return 2
    fi
    statuses=$(cat "$RUN_DIR/workers.json") || return 1
    ready=true
    # Missing worker registration is not proof of completion; neither is a busy
    # worker's stale/idle sibling. Unknown busy workers also prevent backup.
    jq -e 'all(.[]; .state != "busy" and .job == null)' <<< "$statuses" >/dev/null || ready=false
    if (( ${#hosts[@]} > 0 )); then
      for host in "${hosts[@]}"; do
        jq -e --arg host "$host" '[.[]|select(.host==$host)] | length>0 and all(.[]; .state=="suspended" and .job==null)'           <<< "$statuses" >/dev/null || ready=false
      done
    fi
    [[ "$ready" == true ]] && break
    (( SECONDS < deadline )) || return 2
    remaining=$((deadline - SECONDS))
    (( remaining <= 0 )) || sleep "$((remaining < 2 ? remaining : 2))"
  done
  # No busy worker receives TERM. -1 expressly disables Docker's forced kill.
  (( SECONDS < deadline )) || return 2
  # Persist every possible stop before issuing it. Client cancellation cannot
  # cancel Docker daemon shutdown; recovery must see and resolve these IDs.
  PENDING_STOPS=$(printf '%s\n' "${ids[@]}" | jq -R . | jq -s .)
  record stopping_workers || return 1
  for cid in "${ids[@]}"; do
    docker stop --signal SIGTERM --timeout -1 "$cid" >/dev/null &
    STOP_CLIENTS+=("$!")
  done
  while :; do
    ready=true
    for cid in "${ids[@]}"; do
      state=$(bounded_docker "$deadline" inspect --format '{{json .State}}' "$cid") || { stop_clients; return 3; }
      if jq -e '.Running' <<< "$state" >/dev/null; then ready=false
      else jq -e '.ExitCode == 0 and (.OOMKilled|not)' <<< "$state" >/dev/null || { stop_clients; return 3; }; fi
    done
    [[ "$ready" == true ]] && break
    if (( SECONDS >= deadline )); then stop_clients; return 3; fi
    remaining=$((deadline - SECONDS))
    (( remaining <= 0 )) || sleep "$((remaining < 2 ? remaining : 2))"
  done
  for pid in "${STOP_CLIENTS[@]}"; do wait "$pid" || { stop_clients; return 3; }; done
  STOP_CLIENTS=()
  PENDING_STOPS='[]'
  WORKERS_DRAINED=true
  record drained
}
close_sites() {
  local site rc
  for site in "${SITES[@]}"; do
    run_backend bench --site "$site" set-maintenance-mode on
    run_backend bench --site "$site" scheduler pause
  done
  if drain_workers; then :; else
    rc=$?
    echo "Worker drain failed ($rc); no backup or switch is allowed." >&2
    return "$rc"
  fi
  stop_writers
  if [[ -z "$RECOVERY_OF" ]]; then refresh_scheduler_states; fi
}
capture_site_states() {
  local site state
  SITE_STATES='{}'
  for site in "${SITES[@]}"; do
    run_frappe "$BENCH_PYTHON" -c 'import json,sys,frappe
from frappe.utils import cint
frappe.init(site=sys.argv[1],sites_path="/home/frappe/frappe-bench/sites"); frappe.connect()
print(json.dumps({"scheduler_enabled":bool(cint(frappe.db.get_single_value("System Settings","enable_scheduler"))),"maintenance_mode":bool(frappe.conf.maintenance_mode),"pause_scheduler":bool(frappe.conf.pause_scheduler)}))
frappe.destroy()' "$site" > "$RUN_DIR/site-state.json"
    state=$(cat "$RUN_DIR/site-state.json")
    jq -e '.maintenance_mode==false and .pause_scheduler==false and (.scheduler_enabled|type)=="boolean"' <<< "$state" >/dev/null
    SITE_STATES=$(jq -cn --argjson states "$SITE_STATES" --arg site "$site" --argjson state "$state" '$states+{($site):$state}')
  done
  queue_control check
}
refresh_scheduler_states() {
  # Jobs that finish during draining can change this DB setting legitimately.
  # Capture the settled value after all writers stop, immediately before backup.
  local site enabled
  for site in "${SITES[@]}"; do
    run_frappe "$BENCH_PYTHON" -c 'import json,sys,frappe
from frappe.utils import cint
frappe.init(site=sys.argv[1],sites_path="/home/frappe/frappe-bench/sites"); frappe.connect()
print(json.dumps(bool(cint(frappe.db.get_single_value("System Settings","enable_scheduler")))))
frappe.destroy()' "$site" > "$RUN_DIR/scheduler.json"
    enabled=$(jq -e 'type=="boolean"' "$RUN_DIR/scheduler.json" >/dev/null && cat "$RUN_DIR/scheduler.json")
    SITE_STATES=$(jq -c --arg site "$site" --argjson enabled "$enabled" '.[$site].scheduler_enabled=$enabled' <<< "$SITE_STATES")
  done
}
verify_scheduler_state() {
  local site="$1" expected
  expected=$(jq -er --arg site "$site" '.[$site].scheduler_enabled|tostring' <<< "$SITE_STATES")
  run_frappe "$BENCH_PYTHON" -c 'import sys,frappe
from frappe.utils import cint
frappe.init(site=sys.argv[1],sites_path="/home/frappe/frappe-bench/sites"); frappe.connect()
assert bool(cint(frappe.db.get_single_value("System Settings","enable_scheduler"))) == (sys.argv[2]=="true")
frappe.destroy()' "$site" "$expected"
}
apply_scheduler_state() {
  local site="$1" enabled
  enabled=$(jq -er --arg site "$site" '.[$site].scheduler_enabled|tostring' <<< "$SITE_STATES")
  if [[ "$enabled" == true ]]; then run_backend bench --site "$site" enable-scheduler
  else run_backend bench --site "$site" disable-scheduler; fi
  verify_scheduler_state "$site"
}
# Pending Docker stops survive client termination. Complete them before restart.
# A bounded client timeout keeps the IDs durable; it never authorizes reopening.
resolve_worker_stops() {
  local deadline=$((SECONDS + 600)) cid state ids
  ids=$(jq -r '.[]' <<< "$PENDING_STOPS") || return 1
  while read -r cid; do
    [[ -n "$cid" ]] || continue
    state=$(bounded_docker "$deadline" inspect --format '{{json .State}}' "$cid") || return 1
    if jq -e '.Running' <<< "$state" >/dev/null; then
      if jq -e '.Paused' <<< "$state" >/dev/null; then bounded_docker "$deadline" unpause "$cid" >/dev/null || return 1; fi
      bounded_docker "$deadline" stop --signal SIGTERM --timeout -1 "$cid" >/dev/null || return 1
    fi
    state=$(bounded_docker "$deadline" inspect --format '{{json .State}}' "$cid") || return 1
    jq -e '(.Running|not) and (.Restarting|not) and .Pid==0 and .ExitCode==0 and (.OOMKilled|not)' <<< "$state" >/dev/null || return 1
  done <<< "$ids"
  PENDING_STOPS='[]'
  record stops_resolved
}
verify_workers_running() {
  local deadline=$((SECONDS + 60)) cid state host statuses ids ready left
  while (( SECONDS < deadline )); do
    ready=true
    ids=$(bounded_compose "$deadline" ps -aq "${WORKERS[@]}") || return 1
    (( $(wc -l <<< "$ids") == 2 )) || return 1
    left=$((deadline - SECONDS)); (( left > 0 )) || return 1
    worker_status "$left" > "$RUN_DIR/workers.json" || return 1
    statuses=$(cat "$RUN_DIR/workers.json") || return 1
    while read -r cid; do
      [[ -n "$cid" ]] || return 1
      state=$(bounded_docker "$deadline" inspect --format '{{json .State}}' "$cid") || return 1
      jq -e '.Running and (.Paused|not) and (.Restarting|not) and .Pid>0' <<< "$state" >/dev/null || ready=false
      host=$(bounded_docker "$deadline" inspect --format '{{.Config.Hostname}}' "$cid") || return 1
      jq -e --arg host "$host" '[.[]|select(.host==$host)] | length>0 and all(.[]; .state=="idle" or .state=="busy")' <<< "$statuses" >/dev/null || ready=false
    done <<< "$ids"
    [[ "$ready" == true ]] && return 0
    left=$((deadline - SECONDS)); (( left <= 0 )) || sleep "$((left < 2 ? left : 2))"
  done
  return 1
}
verify_access_state() {
  local site="$1" expected
  expected=$(jq -ec --arg site "$site" '.[$site]|{maintenance_mode,pause_scheduler}' <<< "$SITE_STATES") || return 1
  run_frappe "$BENCH_PYTHON" -c 'import json,sys,frappe
frappe.init(site=sys.argv[1],sites_path="/home/frappe/frappe-bench/sites")
assert {"maintenance_mode":bool(frappe.conf.maintenance_mode),"pause_scheduler":bool(frappe.conf.pause_scheduler)} == json.loads(sys.argv[2])
frappe.destroy()' "$site" "$expected"
}
# Before mutation, restore access state without changing image, database or files.
# A timeout before shutdown has no pending IDs. An incomplete shutdown must resolve
# all IDs first. Never report recovery until restarted workers are proven ready.
reopen_untouched() {
  local site maintenance pause cid state ids
  resolve_worker_stops
  # start would also rerun configurator, a dependency; this keeps the existing containers.
  compose up -d --no-deps --no-recreate "${WRITERS[@]}"
  ids=$(worker_ids)
  while read -r cid; do
    [[ -n "$cid" ]] || continue
    state=$(docker inspect --format '{{json .State}}' "$cid")
    if jq -e '.Running and .Paused' <<< "$state" >/dev/null; then docker unpause "$cid" >/dev/null; fi
  done <<< "$ids"
  for site in "${SITES[@]}"; do
    maintenance=$(jq -er --arg site "$site" '.[$site].maintenance_mode|tostring' <<< "$SITE_STATES")
    pause=$(jq -er --arg site "$site" '.[$site].pause_scheduler|tostring' <<< "$SITE_STATES")
    if [[ "$maintenance" == true ]]; then run_backend bench --site "$site" set-maintenance-mode on
    else run_backend bench --site "$site" set-maintenance-mode off; fi
    if [[ "$pause" == true ]]; then run_backend bench --site "$site" scheduler pause
    else run_backend bench --site "$site" scheduler resume; fi
    verify_access_state "$site"
  done
  # Preflight proves pickup was not suspended. Always resume it after a closure:
  # a reboot can occur between the Redis write and its next durable record.
  queue_control resume
  QUEUES_SUSPENDED=false
  queue_control check
  verify_workers_running
  WORKERS_DRAINED=false
  OPENED=true
  if [[ -n "$RECOVERY_OF" ]]; then RECOVERY_VERIFIED=true; fi
  record aborted_untouched
}
closed_checks() {
  local site out
  for site in "${SITES[@]}"; do
    run_backend bench --site "$site" execute frappe.ping > "$RUN_DIR/ping.out"
    out=$(cat "$RUN_DIR/ping.out")
    echo "$out"
    grep -qx 'pong' <<< "$out"
    run_backend bench --site "$site" execute 'frappe.db.sql("SELECT 1")'
    verify_scheduler_state "$site"
  done
}
reopen() {
  set_image "$COMMAND_IMAGE"
  # Persist the write boundary BEFORE the first maintenance-off, not afterwards.
  OPENED=true
  record opening
  local site
  for site in "${SITES[@]}"; do
    run_backend bench --site "$site" set-maintenance-mode off
    run_backend bench --site "$site" scheduler resume
    verify_scheduler_state "$site"
  done
  if [[ "$QUEUES_SUSPENDED" == true ]]; then queue_control resume; QUEUES_SUSPENDED=false; fi
  WORKERS_DRAINED=false
  compose up -d --no-deps "${WRITERS[@]}"
}

# Use the image IDs of the actual application containers. Never read IMAGE= as history.
# All application services must agree. A stopped stack is allowed only for owner restore.
current_image() {
  local service cid iid ref found=''
  for service in "${WRITERS[@]}"; do
    cid=$(compose ps -aq "$service")
    [[ -n "$cid" && "$cid" != *$'\n'* ]] || return 1
    if [[ $(jq -r '.restore_folder' "$RUN_DIR/request.json") == '' && $(jq -r '.owner_recovery // false' "$RUN_DIR/request.json") != true ]]; then
      [[ $(docker inspect --format '{{.State.Running}}' "$cid") == true ]] || return 1
    fi
    iid=$(docker inspect --format '{{.Image}}' "$cid")
    ref=$(docker image inspect "$iid" --format '{{json .RepoDigests}}' | jq -er '.[0]')
    valid_image "$ref" || return 1
    [[ -z "$found" || "$ref" == "$found" ]] || return 1
    found=$ref
  done
  printf '%s\n' "$found"
}

verify_components() {
  local dir="$1" f
  for f in database.sql.gz site_config.json public.tgz private.tgz; do
    [[ -s "$dir/$f" ]] || return 1
  done
  gzip -t "$dir/database.sql.gz" || return 1
  jq -e 'type == "object" and .db_name and .db_password' "$dir/site_config.json" >/dev/null || return 1
  gzip -t "$dir/public.tgz" "$dir/private.tgz" || return 1
  tar -tzf "$dir/public.tgz" >/dev/null || return 1
  tar -tzf "$dir/private.tgz" >/dev/null || return 1
}

# Exact-object JSON API requests avoid the SDK's destination-prefix listing.
# Authentication uses the VM account. Resumable session URLs stay root-private.
storage_request() {
  local token
  token=$(gcloud auth print-access-token) || return 1
  curl -fsS --connect-timeout 20 --max-time 600 -H "Authorization: Bearer $token" "$@"
}
object_url() {
  local bucket object
  bucket=$(jq -rn --arg value "$BACKUP_BUCKET" '$value|@uri') || return 1
  object=$(jq -rn --arg value "$1" '$value|@uri') || return 1
  printf 'https://storage.googleapis.com/storage/v1/b/%s/o/%s' "$bucket" "$object"
}
object_metadata() { storage_request "$(object_url "$1")${2:+?generation=$2}"; }
download_object() {
  storage_request "$(object_url "$1")?generation=$2&alt=media" --output "$3"
}
upload_object() {
  local file="$1" relative="$2" name bucket session meta size hash md5 generation
  name="$BACKUP_FOLDER/$relative"
  bucket=$(jq -rn --arg value "$BACKUP_BUCKET" '$value|@uri')
  size=$(stat -c %s "$file")
  hash=$(sha256sum "$file" | cut -d' ' -f1)
  md5=$(openssl dgst -md5 -binary "$file" | openssl base64 -A)
  # The checksum and create-only precondition apply to the exact named object.
  storage_request -X POST "https://storage.googleapis.com/upload/storage/v1/b/$bucket/o?uploadType=resumable&ifGenerationMatch=0"     -H 'Content-Type: application/json' -H 'X-Upload-Content-Type: application/octet-stream'     -H "X-Upload-Content-Length: $size" --dump-header "$RUN_DIR/upload.headers"     --data "$(jq -cn --arg name "$name" --arg md5 "$md5" '{name:$name,md5Hash:$md5}')"     --output /dev/null
  session=$(awk 'tolower($1)=="location:" {sub(/\r$/, "", $2); print $2}' "$RUN_DIR/upload.headers")
  [[ "$session" == https://storage.googleapis.com/* && "$session" != *$'\n'* ]] || fail 'Invalid resumable upload session.'
  storage_request -X PUT "$session" -H "Content-Length: $size" -H 'Content-Type: application/octet-stream'     --upload-file "$file" --output "$RUN_DIR/upload.json"
  generation=$(jq -er '.generation|tostring' "$RUN_DIR/upload.json")
  [[ "$generation" =~ ^[0-9]+$ ]] || fail 'Upload did not return an object generation.'
  meta=$(object_metadata "$name" "$generation")
  jq -e --arg size "$size" --arg generation "$generation" --arg md5 "$md5" --arg name "$name"     '(.size|tostring)==$size and (.generation|tostring)==$generation and .name==$name and .md5Hash==$md5' <<< "$meta" >/dev/null
  jq -cn --arg path "$relative" --arg sha256 "$hash" --argjson meta "$meta"     '{path:$path,sha256:$sha256,size:($meta.size|tonumber),generation:($meta.generation|tostring),md5:$meta.md5Hash}'     >> "$RUN_DIR/objects.jsonl"
  rm -f "$RUN_DIR/upload.headers" "$RUN_DIR/upload.json"
}
backup() {
  local site dest path f
  BACKUP_FOLDER="production-stack/deploys/$(date -u +%Y-%m-%d_%H-%M-%S)-$ID"
  record backup
  mkdir "$RUN_DIR/backup"
  : > "$RUN_DIR/objects.jsonl"
  for site in "${SITES[@]}"; do
    path="/home/frappe/frappe-bench/sites/.brisk-deploy/$ID/backup/$site"
    # Explicit paths avoid timestamp selection and the nightly backup's directory.
    run_backend bench --site "$site" backup --with-files --compress --ignore-backup-conf \
      --backup-path "$path" --backup-path-db "$path/database.sql.gz" \
      --backup-path-conf "$path/site_config.json" --backup-path-files "$path/public.tgz" \
      --backup-path-private-files "$path/private.tgz"
    dest="$RUN_DIR/backup/$site"
    mkdir "$dest"
    run_backend tar -C "$path" -cf - database.sql.gz site_config.json public.tgz private.tgz \
      > "$dest/components.tar"
    tar -xf "$dest/components.tar" -C "$dest"
    rm "$dest/components.tar"
    verify_components "$dest"
    run_backend rm -rf "$path"
    for f in database.sql.gz site_config.json public.tgz private.tgz; do upload_object "$dest/$f" "$site/$f"; done
  done
  jq -s --arg image "$PREVIOUS_IMAGE" --arg folder "$BACKUP_FOLDER" \
    --arg sites "${SITES[*]}" --arg snapshot "$SNAPSHOT" --argjson site_states "$SITE_STATES" \
    '{image:$image,folder:$folder,sites:($sites|split(" ")),snapshot:$snapshot,site_states:$site_states,objects:.}' \
    "$RUN_DIR/objects.jsonl" > "$RUN_DIR/backup/manifest.json"
  upload_object "$RUN_DIR/backup/manifest.json" manifest.json
  # Manifest metadata stays in the durable record directory, including its generation.
  cp "$RUN_DIR/objects.jsonl" "$RUN_DIR/uploaded-objects.jsonl"
}

# Download by recorded generations, verify SHA256 and integrity again, and refuse any
# image/site mismatch. Nightly backups lack this manifest and cannot serve this path.
load_backup() {
  local folder="$1" expected="$2" dir="$RUN_DIR/restore" manifest meta path generation hash size site
  [[ "$folder" =~ ^production-stack/deploys/[A-Za-z0-9_-]+$ ]] || return 1
  mkdir -p "$dir"
  meta=$(object_metadata "$folder/manifest.json")
  generation=$(jq -er '.generation|tostring' <<< "$meta")
  download_object "$folder/manifest.json" "$generation" "$dir/manifest.json"
  manifest="$dir/manifest.json"
  jq -e --arg image "$expected" --arg folder "$folder" --arg sites "${SITES[*]}" \
    '.image == $image and .folder == $folder and .sites == ($sites|split(" ")) and
     (.site_states|keys|sort)==($sites|split(" ")|sort) and
     all(.site_states[]; (.scheduler_enabled|type)=="boolean") and
     ([.objects[].path]|sort) == ([$sites|split(" ")[] as $s |
       ["database.sql.gz","site_config.json","public.tgz","private.tgz"][] | $s+"/"+.]|sort)' "$manifest" >/dev/null
  while IFS=$'\t' read -r path generation hash size; do
    [[ "$path" =~ ^[A-Za-z0-9.-]+/(database.sql.gz|site_config.json|public.tgz|private.tgz)$ ]] || return 1
    [[ "$generation" =~ ^[0-9]+$ && "$hash" =~ ^[0-9a-f]{64}$ && "$size" =~ ^[0-9]+$ ]] || return 1
    mkdir -p "$dir/${path%/*}"
    download_object "$folder/$path" "$generation" "$dir/$path" || return 1
    [[ $(stat -c %s "$dir/$path") == "$size" ]] || return 1
    [[ $(sha256sum "$dir/$path" | cut -d' ' -f1) == "$hash" ]] || return 1
  done < <(jq -r '.objects[] | [.path,.generation,.sha256,.size] | @tsv' "$manifest")
  for site in "${SITES[@]}"; do verify_components "$dir/$site" || return 1; done
}
restore_data() {
  local image="$1" folder="$2" site path
  record restoring
  stop_writers
  load_backup "$folder" "$image"
  docker pull "$image"
  set_image "$image"
  COMMAND_IMAGE=$image
  SITE_STATES=$(jq -ec ' .site_states' "$RUN_DIR/restore/manifest.json")
  for site in "${SITES[@]}"; do
    path="/home/frappe/frappe-bench/sites/.brisk-deploy/$ID/restore/$site"
    run_backend mkdir -p "$path"
    # Pipefail covers both tar creation and extraction.
    tar -C "$RUN_DIR/restore/$site" -cf - database.sql.gz site_config.json public.tgz private.tgz |
      run_backend tar -C "$path" -xf -
    run_backend cp "$path/site_config.json" "sites/$site/site_config.json"
    run_backend bench --site "$site" set-maintenance-mode on
    run_backend bench --site "$site" scheduler pause
    # Remove files absent from the backup as well; bench restore otherwise overlays.
    run_backend "$BENCH_PYTHON" -c 'import shutil,sys; from pathlib import Path
for kind in ("public", "private"):
 p=Path("sites")/sys.argv[1]/kind/"files"
 if p.exists(): shutil.rmtree(p)
 p.mkdir(parents=True)' "$site"
    # Passwords come from compose's parsed .env, never shell source it or print them.
    local password
    password=$(cd "$DEPLOY_DIR" && docker compose config --environment | sed -n 's/^DB_ROOT_PASSWORD=//p')
    [[ -n "$password" ]] || fail 'DB_ROOT_PASSWORD is absent from the Compose environment.'
    # shellcheck disable=SC2016 # expanded by Bash inside the container
    compose run --no-deps -T --entrypoint /usr/bin/env --name "brisk-cd-$ID-command" -e "RESTORE_DB_PASSWORD=$password" backend \
      bash -c 'exec bench --site "$1" restore "$2/database.sql.gz" --db-root-password "$RESTORE_DB_PASSWORD" --with-public-files "$2/public.tgz" --with-private-files "$2/private.tgz"' _ "$site" "$path" &
    ACTIVE_CONTAINER="brisk-cd-$ID-command"
    local child=$! code=0
    wait "$child" || code=$?
    (( code == 0 )) || return "$code"
    docker rm "$ACTIVE_CONTAINER" >/dev/null
    ACTIVE_CONTAINER=''
    unset password
    # Restore may update config; replace it with the matching saved config again.
    run_backend cp "$path/site_config.json" "sites/$site/site_config.json"
    run_backend bench --site "$site" set-maintenance-mode on
    run_backend bench --site "$site" scheduler pause
    apply_scheduler_state "$site"
    run_backend rm -rf "$path"
  done
  closed_checks
}

# If recovery itself fails, leave no application writer running and retain the record.
recovery_failed() {
  trap - ERR TERM INT HUP
  stop_clients
  stop_active || true
  if [[ "$CHANGED" == true ]]; then stop_writers || true; fi
  record needs_owner || true
  exit 1
}
on_failure() {
  local code=${1:-1}
  # Only the operation shell recovers; inherited ERR traps in pipelines exit to it.
  if (( BASH_SUBSHELL > 0 )); then exit "$code"; fi
  trap - ERR TERM INT HUP
  set +e
  stop_active
  local stopped=$?
  stop_clients
  if [[ "$PHASE" == preflight || "$PHASE" == queued ]]; then
    if [[ "$stopped" == 0 && -z "$RECOVERY_OF" && "$CHANGED" == false ]]; then record preflight_failed
    else record needs_owner; fi
    exit "$code"
  fi
  if [[ -n "$RECOVERY_OF" && "$RECOVERY_VERIFIED" == false ]]; then
    if [[ "$CHANGED" == true ]]; then stop_writers || true; fi
    record needs_owner
    exit "$code"
  fi
  # Bash suppresses recursive ERR handling while an ERR trap runs. Persist intent,
  # then exec recovery in a fresh shell, inheriting the SAME locked descriptor 9.
  if [[ "$CHANGED" == true || "$OPENED" == true ]]; then stop_writers || stopped=1; fi
  if ! record recovering_failure; then exit "$code"; fi
  /bin/bash "$RUN_DIR/deploy-on-vm.sh" resume_failure "$RUN_DIR/record.json" "$stopped"
  exit "$code"
}
resume_failure() {
  local state="$1" stopped="$2"
  # This is an internal entry point. The inherited lock must already be held.
  flock -n 9
  PREVIOUS_IMAGE=$(jq -er '.previous_image' "$state")
  BACKUP_FOLDER=$(jq -r '.backup_folder' "$state")
  COMMAND_IMAGE=$(jq -er '.command_image' "$state")
  OPENED=$(jq -er '.opened|tostring' "$state")
  CHANGED=$(jq -er '.changed|tostring' "$state")
  RECOVERY_VERIFIED=$(jq -er '.recovery_verified|tostring' "$state")
  WORKERS_DRAINED=$(jq -er '.workers_drained|tostring' "$state")
  QUEUES_SUSPENDED=$(jq -er '.queues_suspended|tostring' "$state")
  SITE_STATES=$(jq -ec '.site_states' "$state")
  PENDING_STOPS=$(jq -ec '.pending_stops // []' "$state")
  CLOSURE_STARTED=$(jq -r '.closure_started // false' "$state")
  trap recovery_failed ERR TERM INT HUP
  [[ "$stopped" == 0 ]] || recovery_failed
  if [[ "$CHANGED" == false && "$OPENED" == false ]]; then
    reopen_untouched
    return
  fi
  stop_writers
  if [[ "$OPENED" == true ]]; then
    close_sites
    record needs_owner
    echo "User access resumed. NO automatic restore. Backup: $BACKUP_FOLDER; snapshot: $SNAPSHOT"
    echo "Owner-confirmed restore: sudo $RUN_DIR/deploy-on-vm.sh recover $ID"
    return
  fi
  if [[ "$CHANGED" == true ]]; then
    [[ "$WORKERS_DRAINED" == true ]] || recovery_failed
    restore_data "$PREVIOUS_IMAGE" "$BACKUP_FOLDER"
  else
    closed_checks
  fi
  reopen
  record recovered
  trap - ERR TERM INT HUP
}

preflight() {
  record preflight
  local services running sha previous_sha asserted_sha restore_folder repo
  [[ -f "$DEPLOY_DIR/compose.yaml" && -f "$DEPLOY_DIR/.env" ]] || fail 'Missing Compose files.'
  services=$(compose config --services | sort)
  # Unknown services could write during maintenance: require the audited compose layout.
  # configurator is frappe_docker's one-shot config job; --no-deps starts never rerun it.
  [[ "$services" == "$(printf '%s\n' "${WRITERS[@]}" mariadb redis-cache redis-queue configurator | sort)" ]] \
    || fail 'Unexpected Compose services.'
  running=$(compose ps -q --status running configurator)
  [[ -z "$running" ]] || fail 'Configurator is still running.'
  docker pull "$IMAGE"
  restore_folder=$(jq -r '.restore_folder' "$RUN_DIR/request.json")
  if [[ $(jq -r '.owner_recovery // false' "$RUN_DIR/request.json") == true ]]; then
    PREVIOUS_IMAGE=$(jq -er '.recovery_image' "$RUN_DIR/request.json")
    valid_image "$PREVIOUS_IMAGE"
    COMMAND_IMAGE=$PREVIOUS_IMAGE
    load_backup "$restore_folder" "$IMAGE"
    BACKUP_FOLDER=$restore_folder
    SITE_STATES=$(jq -ec '.site_states' "$RUN_DIR/restore/manifest.json")
    return
  fi
  PREVIOUS_IMAGE=$(current_image)
  COMMAND_IMAGE=$PREVIOUS_IMAGE
  # Verify the old digest remains retrievable before any write freeze or switch.
  docker pull "$PREVIOUS_IMAGE"
  sha=$(docker image inspect "$IMAGE" --format '{{index .Config.Labels "org.opencontainers.image.revision"}}')
  if [[ $(jq -r '.automatic' "$RUN_DIR/request.json") == true ]]; then
    [[ "$sha" =~ ^[0-9a-f]{40}$ && "$sha" == "$(jq -r '.sha' "$RUN_DIR/request.json")" ]] \
      || fail 'Image source revision does not match the tested SHA.'
  fi
  previous_sha=$(docker image inspect "$PREVIOUS_IMAGE" --format '{{index .Config.Labels "org.opencontainers.image.revision"}}')
  asserted_sha=$(jq -r '.previous_sha // ""' "$RUN_DIR/request.json")
  if [[ -n "$asserted_sha" ]]; then
    # Images built before the pipeline carry no revision label; the owner names their commit.
    [[ -z "$previous_sha" ]] || fail 'previous_sha applies only when the running image has no revision label.'
    echo "Running image has no revision label; using owner-asserted commit $asserted_sha."
    previous_sha=$asserted_sha
  fi
  repo=$(jq -er '.repository' "$RUN_DIR/request.json")
  [[ "$repo" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || fail 'Invalid repository.'
  if [[ -n "$restore_folder" ]]; then
    load_backup "$restore_folder" "$IMAGE"
  elif [[ "$PREVIOUS_IMAGE" != "$IMAGE" ]]; then
    [[ "$sha" =~ ^[0-9a-f]{40}$ && "$previous_sha" =~ ^[0-9a-f]{40}$ ]] \
      || fail 'Cannot prove forward order; supply the matching backup folder for a restore.'
    git init -q "$RUN_DIR/ancestry"
    git -C "$RUN_DIR/ancestry" fetch -q "https://github.com/$repo.git" "$sha" "$previous_sha"
    git -C "$RUN_DIR/ancestry" merge-base --is-ancestor "$previous_sha" "$sha" \
      || fail 'Older or unrelated image refused without its matching backup folder.'
  fi
  capture_site_states
  [[ $(df --output=avail "$DEPLOY_DIR" | tail -1) -ge 6291456 ]] || fail 'Less than 6 GB free.'
  record preflight
}

# A free lock alone does not prove Docker's detached command stopped.
# Check both the original service and any recovery attempt before owner launch.
prove_operation_stopped() {
  local old="$1" props cid state
  props=$(systemctl show "brisk-deploy-$old.service" --property=LoadState --property=ActiveState --property=MainPID --property=ControlPID) || {
    grep -qx 'LoadState=not-found' <<< "$props" || return 1
  }
  grep -Eq '^ActiveState=(inactive|failed)$' <<< "$props" || return 1
  grep -qx 'MainPID=0' <<< "$props" || return 1
  grep -qx 'ControlPID=0' <<< "$props" || return 1
  cid=$(docker ps -aq --filter "name=^/brisk-cd-$old-command$") || return 1
  if [[ -n "$cid" ]]; then
    [[ "$cid" != *$'\n'* ]] || return 1
    state=$(docker inspect --format '{{json .State}}' "$cid") || return 1
    jq -e '(.Running|not) and (.Restarting|not) and .Pid==0' <<< "$state" >/dev/null || return 1
    docker rm "$cid" >/dev/null || return 1
  fi
}
recover_untouched_operation() {
  local original="$ROOT/$RECOVERY_OF/record.json" previous phase
  jq -e '.changed==false' "$original" >/dev/null
  prove_operation_stopped "$RECOVERY_OF"
  CHANGED=false
  OPENED=false
  PREVIOUS_IMAGE=$(jq -r '.previous_image' "$original")
  BACKUP_FOLDER=$(jq -r '.backup_folder' "$original")
  SNAPSHOT=$(jq -r '.snapshot' "$original")
  PENDING_STOPS=$(jq -ec '.pending_stops // []' "$original")
  CLOSURE_STARTED=$(jq -r '.closure_started // false' "$original")
  QUEUES_SUSPENDED=$(jq -r '.queues_suspended // false' "$original")
  SITE_STATES=$(jq -ec '.site_states // {}' "$original")
  previous=$(current_image)
  [[ -z "$PREVIOUS_IMAGE" || "$previous" == "$PREVIOUS_IMAGE" ]] || fail 'Runtime image differs from the untouched transaction.'
  PREVIOUS_IMAGE=$previous
  COMMAND_IMAGE=$previous
  phase=$(jq -r '.phase' "$original")
  if [[ "$CLOSURE_STARTED" == false ]]; then
    # queued/preflight only read state. No closure can start without a saved state.
    [[ "$QUEUES_SUSPENDED" == false && "$PENDING_STOPS" == '[]' ]]
    [[ "$phase" == queued || "$phase" == preflight || "$phase" == preflight_failed || "$phase" == needs_owner ]]
    # start would also rerun configurator, a dependency; this keeps the existing containers.
    compose up -d --no-deps --no-recreate "${WRITERS[@]}"
    capture_site_states
    verify_workers_running
    RECOVERY_VERIFIED=true
    OPENED=true
    record aborted_untouched
  else
    jq -e --arg sites "${SITES[*]}" '(keys|sort)==($sites|split(" ")|sort) and all(.[]; (.maintenance_mode|type)=="boolean" and (.pause_scheduler|type)=="boolean")' <<< "$SITE_STATES" >/dev/null
    record recovering_untouched
    reopen_untouched
  fi
}

operation() {
  exec 9>"$LOCK"
  flock -n 9 || fail 'Another VM transaction owns the lock.'
  # Only a freshly registered launch can enter preflight. Replaying operate after
  # an interrupted migration must not reset CHANGED or clear its recovery barrier.
  [[ $(jq -r '.phase' "$RUN_DIR/record.json") == queued ]] || fail 'Operation already entered; use owner recovery.'
  if [[ -n "$RECOVERY_OF" ]]; then
    jq -e --arg original "$RECOVERY_OF" --arg attempt "$ID"       '.id==$original and .recovery_attempt==$attempt' "$ROOT/current.json" >/dev/null
  else
    jq -e --arg id "$ID" '.id==$id and .phase=="queued" and .changed==false and (.recovery_attempt // "")==""' "$ROOT/current.json" >/dev/null
  fi
  trap 'on_failure $?' ERR
  trap 'on_failure 143' TERM
  trap 'on_failure 130' INT
  trap 'on_failure 129' HUP
  if [[ $(jq -r '.recovery_untouched // false' "$RUN_DIR/request.json") == true ]]; then
    recover_untouched_operation
    return
  fi
  preflight
  if [[ $(jq -r '.owner_recovery // false' "$RUN_DIR/request.json") == true ]]; then
    # The live database can already differ from the archived image. An early
    # owner-recovery failure must retain the barrier and never reopen old code alone.
    CHANGED=true
  fi
  CLOSURE_STARTED=true
  record closing
  close_sites
  local restore_folder
  restore_folder=$(jq -r '.restore_folder' "$RUN_DIR/request.json")
  if [[ $(jq -r '.owner_recovery // false' "$RUN_DIR/request.json") != true ]]; then
    backup
  fi
  record snapshot
  gcloud compute disks snapshot "$(jq -er '.disk' "$RUN_DIR/request.json")" \
    --project "$(jq -er '.project' "$RUN_DIR/request.json")" \
    --zone "$(jq -er '.zone' "$RUN_DIR/request.json")" \
    --storage-location "$(jq -er '.region' "$RUN_DIR/request.json")" \
    --snapshot-names "$SNAPSHOT" --labels="cd_purpose=pre-deploy,cd_run=$ID,retention_days=14,cd_result=pending" --quiet
  # Last possible stale-head check, inside the lock immediately before mutation.
  if [[ $(jq -r '.automatic' "$RUN_DIR/request.json") == true ]]; then
    local head
    head=$(git ls-remote "https://github.com/$(jq -r '.repository' "$RUN_DIR/request.json").git" refs/heads/main | cut -f1)
    [[ "$head" == "$(jq -r '.sha' "$RUN_DIR/request.json")" ]] || fail 'Stale automatic deployment refused.'
  fi
  CHANGED=true
  record switching
  if [[ -n "$restore_folder" ]]; then
    restore_data "$IMAGE" "$restore_folder"
  else
    set_image "$IMAGE"
    COMMAND_IMAGE=$IMAGE
    local site
    record migrating
    for site in "${SITES[@]}"; do run_backend bench --site "$site" migrate; done
    record closed_checks
    for site in "${SITES[@]}"; do apply_scheduler_state "$site"; done
    closed_checks
  fi
  if [[ -n "$RECOVERY_OF" ]]; then
    # Only full restore + closed checks above can release the original barrier.
    RECOVERY_VERIFIED=true
    record restored_closed
  fi
  reopen
  VERDICT_DEADLINE=$(($(date +%s) + 600))
  record awaiting_https
  # Each wait is bounded at ten minutes. A missing runner closes sites, never restores.
  local verdict=''
  until [[ -f "$RUN_DIR/verdict" ]]; do
    (( $(date +%s) < VERDICT_DEADLINE )) || fail 'No outside verdict within ten minutes.'
    sleep 5
  done
  verdict=$(cat "$RUN_DIR/verdict")
  [[ "$verdict" == pass ]] || fail 'Outside HTTPS checks failed.'
  record succeeded
  trap - ERR TERM INT HUP
}

load_request() {
  ID=$(jq -er '.id' "$1"); valid_id "$ID"
  RUN_DIR="$ROOT/$ID"
  DEPLOY_DIR=$(jq -er '.deploy_dir' "$1")
  IMAGE=$(jq -er '.image' "$1"); valid_image "$IMAGE"
  BACKUP_BUCKET=$(jq -er '.backup_bucket' "$1")
  read -r -a SITES <<< "$(jq -er '.sites' "$1")"
  [[ ${#SITES[@]} == 2 && "${SITES[0]}" != "${SITES[1]}" ]] || fail 'Require exactly two distinct sites.'
  local site
  for site in "${SITES[@]}"; do [[ "$site" =~ ^[A-Za-z0-9][A-Za-z0-9.-]+$ ]] || fail 'Invalid site name.'; done
  RECOVERY_OF=$(jq -r '.recovery_of // ""' "$1")
  if [[ -n "$RECOVERY_OF" ]]; then
    valid_id "$RECOVERY_OF"
    [[ $(jq -r '.owner_recovery' "$1") == true ]] || fail 'Recovery must use the owner recovery entry point.'
    CHANGED=$(jq -er '.recovery_changed|tostring' "$1")
  else
    [[ $(jq -r '.owner_recovery // false' "$1") == false ]] || fail 'Owner recovery needs its original transaction.'
  fi
  SNAPSHOT="pre-deploy-$ID" # run ID AND attempt; owner recovery also has a unique suffix
}
start() {
  local request="$1" current_phase current_id active_id
  load_request "$request"
  mkdir -p "$ROOT"
  exec 8>"$LOCK"
  flock -n 8 || fail 'Another VM transaction owns the lock.'
  if [[ -f "$ROOT/current.json" ]]; then
    current_phase=$(jq -er '.phase' "$ROOT/current.json")
    current_id=$(jq -er '.id' "$ROOT/current.json")
    if [[ "$current_phase" == preflight_failed || "$current_phase" == aborted_untouched ]]; then
      if ! jq -e '.changed==false' "$ROOT/current.json" >/dev/null; then current_phase=unresolved_mutation; fi
    fi
    case "$current_phase" in
      succeeded|recovered|preflight_failed|aborted_untouched)
        [[ -z "$RECOVERY_OF" ]] || fail 'No unresolved transaction to recover.' ;;
      *)
        # restore_folder alone never authorizes superseding an unfinished DB.
        [[ "$RECOVERY_OF" == "$current_id" ]] || fail "Unfinished deployment $current_id; use its recorded owner recovery command."
        jq -e --slurpfile request "$request"           '.previous_image==$request[0].recovery_image and .changed==$request[0].recovery_changed and
           (.changed==true or $request[0].recovery_untouched==true) and .backup_folder==$request[0].restore_folder and
           .deploy_dir==$request[0].deploy_dir and .sites==$request[0].sites and .backup_bucket==$request[0].backup_bucket'           "$ROOT/current.json" >/dev/null
        active_id=$(jq -r '.recovery_attempt // .id' "$ROOT/current.json")
        prove_operation_stopped "$current_id"
        if [[ "$active_id" != "$current_id" ]]; then prove_operation_stopped "$active_id"; fi
        ;;
    esac
  else
    [[ -z "$RECOVERY_OF" ]] || fail 'Recovery has no original transaction.'
  fi
  mkdir "$RUN_DIR" # refuses duplicate run IDs
  install -m 700 "$0" "$RUN_DIR/deploy-on-vm.sh"
  install -m 600 "$request" "$RUN_DIR/request.json"
  record queued
  if [[ -n "$RECOVERY_OF" ]]; then
    # Keep all original mutation/history fields; record only the active attempt ID.
    jq --arg attempt "$ID" '. + {recovery_attempt:$attempt}' "$ROOT/current.json" > "$ROOT/current.tmp"
    sync -f "$ROOT/current.tmp"
    mv -f "$ROOT/current.tmp" "$ROOT/current.json"
    sync -f "$ROOT"
  fi
  # Release the launch lock; queued state blocks other launches until operation owns it.
  flock -u 8
  systemd-run --unit="brisk-deploy-$ID" --property=Type=exec \
    --property=KillMode=mixed --property=TimeoutStopSec=900 --property=RuntimeMaxSec=5400 \
    /bin/bash "$RUN_DIR/deploy-on-vm.sh" operate "$RUN_DIR/request.json"
}
recover() {
  local old="$1" request
  valid_id "$old"
  request=$(mktemp)
  # This explicit owner action accepts possible data loss after user access resumed.
  local base=${old%%-recover-*}
  jq --arg id "$base-recover-$(date +%s)" --arg recovery_of "$old" \
    '.id=$id | .recovery_changed=.changed | .recovery_untouched=(.changed==false) |
     .recovery_image=.previous_image | .image=(if .previous_image=="" then .image else .previous_image end) |
     .restore_folder=.backup_folder | .automatic=false | .owner_recovery=true | .recovery_of=$recovery_of' \
    "$ROOT/$old/record.json" > "$request"
  start "$request"
  rm -f "$request"
}
main() {
  [[ $(id -u) == 0 ]] || fail 'Run as root.'
  case "${1:-}" in
    start) [[ $# == 2 ]]; start "$2" ;;
    operate) [[ $# == 2 ]]; load_request "$2"; operation ;;
    resume_failure) [[ $# == 3 ]]; load_request "$2"; resume_failure "$2" "$3" ;;
    status) [[ $# == 2 ]]; valid_id "$2"; cat "$ROOT/$2/record.json" ;;
    retention-records) [[ $# == 1 ]]; retention_records ;;
    verdict)
      [[ $# == 3 ]]; valid_id "$2"; [[ "$3" == pass || "$3" == fail ]]
      [[ $(jq -r '.phase' "$ROOT/$2/record.json") == awaiting_https ]]
      (( $(date +%s) < $(jq -r '.verdict_deadline' "$ROOT/$2/record.json") ))
      printf '%s\n' "$3" > "$ROOT/$2/verdict.tmp"
      mv "$ROOT/$2/verdict.tmp" "$ROOT/$2/verdict" ;;
    recover) [[ $# == 2 ]]; recover "$2" ;;
    *) fail 'Usage: start <request.json> | status <id> | verdict <id> pass|fail | recover <id> | retention-records' ;;
  esac
}
main "$@"
