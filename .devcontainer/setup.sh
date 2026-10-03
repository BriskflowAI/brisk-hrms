#!/usr/bin/env bash
# Builds a working briskrew site inside the codespace: Frappe and ERPNext (develop), this
# repository's Frappe HR, a demo company and team. Runs once, when the codespace is created
# (15–25 minutes). Re-running it is safe; finished steps are skipped.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
# Defaults match docker-compose.yml; override them to run this elsewhere.
BENCH="${BENCH:-$HOME/frappe-bench}"
SITE="${SITE:-briskrew.localhost}"
DB_HOST="${DB_HOST:-mariadb}"
DB_PORT="${DB_PORT:-3306}"
DB_ROOT_PASSWORD="${DB_ROOT_PASSWORD:-briskrew-dev}"
REDIS_URL="${REDIS_URL:-redis://redis:6379}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin}"

step() { printf '\n==> %s\n' "$*"; }

# Downloads (PyPI, npm, GitHub) occasionally time out in a fresh codespace; try again before failing.
retry() {
	local n
	for n in 1 2 3 4; do
		"$@" && return 0
		[ "$n" = 4 ] && break
		echo "   ... that failed, trying again in $((n * 15)) seconds ($n/3)"
		sleep $((n * 15))
	done
	echo "   ... still failing. Check the network, then run: bash .devcontainer/setup.sh" >&2
	return 1
}
export UV_HTTP_TIMEOUT=120

step "Python 3.14 and bench"
if ! command -v uv >/dev/null; then
	retry sh -c 'curl -LsSf https://astral.sh/uv/install.sh | sh'
fi
export PATH="$HOME/.local/bin:$PATH"
retry uv python install 3.14
command -v bench >/dev/null || retry uv tool install frappe-bench
command -v yarn >/dev/null || retry npm install -g yarn

step "Waiting for the database"
until mariadb -h "$DB_HOST" -P "$DB_PORT" -uroot -p"$DB_ROOT_PASSWORD" -e "select 1" >/dev/null 2>&1; do sleep 2; done

if [ ! -f "$BENCH/sites/apps.txt" ]; then
	step "Frappe (develop)"
	init_bench() {
		rm -rf "$BENCH" # a half-finished earlier attempt
		cd "$(dirname "$BENCH")"
		bench init --frappe-branch develop --python "$(uv python find 3.14)" \
			--skip-redis-config-generation --skip-assets --no-backups "$(basename "$BENCH")" < /dev/null
	}
	retry init_bench
fi
cd "$BENCH"
bench set-config -g db_host "$DB_HOST"
bench set-config -g db_port "$DB_PORT" --parse
bench set-config -g redis_cache "$REDIS_URL"
bench set-config -g redis_queue "$REDIS_URL"
bench set-config -g redis_socketio "$REDIS_URL"
# The file watcher isn't needed to look around and slows the codespace down.
sed -i '/^watch:/d' Procfile

if [ ! -d apps/erpnext ]; then
	step "ERPNext (develop)"
	retry bench get-app --branch develop --skip-assets https://github.com/frappe/erpnext
fi

if [ ! -e apps/hrms ]; then
	step "Frappe HR from this repository"
	ln -s "$REPO" apps/hrms
	retry bench pip install -e apps/hrms
	python3 - <<'PY'
from pathlib import Path
p = Path("sites/apps.txt")
apps = [a for a in p.read_text().split() if a]
if "hrms" not in apps:
	apps.append("hrms")
p.write_text("\n".join(apps) + "\n")
PY
fi

step "Front-end packages"
retry sh -c 'cd apps/hrms && yarn install'

# The marker is written only once the site is fully made.
if [ ! -f "sites/$SITE/.briskrew-site-ready" ]; then
	step "Site $SITE"
	# --force replaces a site left half-made by an earlier attempt.
	bench new-site "$SITE" --force --db-host "$DB_HOST" --db-port "$DB_PORT" --db-root-username root \
		--db-root-password "$DB_ROOT_PASSWORD" --mariadb-user-host-login-scope='%' \
		--admin-password "$ADMIN_PASSWORD" --install-app erpnext
	bench --site "$SITE" install-app hrms
	bench --site "$SITE" set-config developer_mode 1
	touch "sites/$SITE/.briskrew-site-ready"
fi
bench use "$SITE"

step "Demo company and team"
bench --site "$SITE" execute hrms.briskrew.demo.setup_site

step "Building the interface"
bench build
(cd apps/hrms && yarn build)

step "Done"
echo "Open the Ports tab and the 'briskrew' port (8000)."
echo "Sign in as Administrator / $ADMIN_PASSWORD, or the team lead lead@briskrew.demo / briskrew-demo-1."
