#!/usr/bin/env bash
# Starts the briskrew site whenever the codespace starts. Each part runs on its own, so one
# failing (the realtime server, say) can't take the web server down with it.
# Logs: ~/logs/web.log, worker.log, schedule.log, socketio.log
export PATH="$HOME/.local/bin:$PATH"
cd "$HOME/frappe-bench" 2>/dev/null || exit 0 # setup hasn't run yet
[ -f sites/briskrew.localhost/.briskrew-site-ready ] || exit 0
mkdir -p "$HOME/logs"

run() { # name, pattern to detect it's already running, command...
	local name=$1 pattern=$2
	shift 2
	pgrep -f "$pattern" >/dev/null && return 0
	setsid nohup "$@" >"$HOME/logs/$name.log" 2>&1 </dev/null &
}

run web "frappe.*serve --port 8000" bench serve --port 8000 --noreload
run worker "frappe.*worker" bench worker
run schedule "frappe.*schedule" bench schedule
run socketio "socketio.js" bench socketio

for _ in $(seq 1 60); do
	if curl -s -o /dev/null http://127.0.0.1:8000/api/method/ping; then
		echo "briskrew is up: open the Ports tab and the 'briskrew' port (8000), then go to /flow"
		exit 0
	fi
	sleep 2
done
echo "The web server didn't come up. See: tail -40 ~/logs/web.log" >&2
exit 1
