#!/usr/bin/env bash
# Starts the briskrew site whenever the codespace starts. Logs: ~/bench.log
export PATH="$HOME/.local/bin:$PATH"
cd "$HOME/frappe-bench" 2>/dev/null || exit 0  # setup hasn't run yet
[ -d sites/briskrew.localhost ] || exit 0
pgrep -f "frappe.*serve.*8000" >/dev/null && exit 0
setsid nohup bench start > "$HOME/bench.log" 2>&1 < /dev/null &
echo "briskrew is starting on port 8000 (log: ~/bench.log)"
