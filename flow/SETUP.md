# Running briskrew on a test server

These steps set up a fresh Ubuntu 24.04 machine (a cloud VM with 4 GB RAM or more is
fine) with Frappe, ERPNext and this repository's Frappe HR, then open briskrew at
`/flow`. They follow what was used to test briskrew during development.

**Just want to look around?** Open this repository in a GitHub codespace instead (Code →
Codespaces → Create codespace). It sets everything below up with demo data on its own; see
[`.devcontainer/README.md`](../.devcontainer/README.md).

The `develop` branches of Frappe and ERPNext need **Python 3.14** and **Node 24**.

## 1. System packages (as root or with sudo)

```bash
sudo apt update
sudo apt install -y git curl build-essential pkg-config \
  mariadb-server mariadb-client libmariadb-dev redis-server \
  xvfb libfontconfig wkhtmltopdf
```

MariaDB settings Frappe needs:

```bash
sudo tee /etc/mysql/mariadb.conf.d/99-frappe.cnf >/dev/null <<'EOF'
[mysqld]
character-set-client-handshake = FALSE
character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci

[mysql]
default-character-set = utf8mb4
EOF
sudo systemctl restart mariadb
sudo mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED VIA mysql_native_password USING PASSWORD('choose-a-db-password'); FLUSH PRIVILEGES;"
```

## 2. A non-root user

Bench refuses to run as root.

```bash
sudo adduser --disabled-password --gecos "" frappe
sudo usermod -aG sudo frappe
sudo su - frappe
```

Everything below runs as `frappe`.

## 3. Python 3.14, Node 24, Yarn and bench

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
source ~/.local/bin/env
uv python install 3.14

curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.nvm/nvm.sh
nvm install 24
npm install -g yarn

uv tool install frappe-bench
```

## 4. Access to this repository

The repository is private. Give the server read access with an SSH key:

```bash
ssh-keygen -t ed25519 -C "briskrew test server" -N "" -f ~/.ssh/id_ed25519
cat ~/.ssh/id_ed25519.pub
```

Add the printed key as a **deploy key** (read only) under the repository's
Settings → Deploy keys on GitHub, then check it works:

```bash
ssh -T git@github.com
```

## 5. Bench, apps and site

```bash
bench init --frappe-branch develop --python "$(uv python find 3.14)" briskrew-bench
cd briskrew-bench
bench get-app --branch develop erpnext
bench get-app --branch develop git@github.com:BriskflowAI/brisk-hrms.git

bench new-site test.localhost --mariadb-root-password choose-a-db-password --admin-password choose-an-admin-password --install-app erpnext
bench --site test.localhost install-app hrms
bench --site test.localhost set-config developer_mode 1
bench use test.localhost
```

`bench get-app` for this repository runs its `postinstall`, which installs the briskrew
front end's packages. Then build everything:

```bash
bench build
(cd apps/hrms && yarn build-flow)
```

## 6. Start it

```bash
bench start
```

Open `http://<server-ip>:8000` (or `http://test.localhost:8000` on the server itself), log
in as `Administrator` and finish ERPNext's setup wizard: it creates your company, fiscal
year and chart of accounts.

Then open **`/flow`**. That's briskrew.

### Optional: demo team and requests

```bash
bench --site test.localhost execute hrms.briskrew.demo.seed --kwargs "{'company': 'Your Company Name'}"
```

It creates a team lead (`lead@briskrew.demo`, password `briskrew-demo-1`) with five
reports, leave requests, a salary structure with last month's slips, and an expense
type. Only on test sites: it refuses to run unless `developer_mode` is on.

## After pulling new changes

```bash
cd ~/briskrew-bench/apps/hrms && git pull
cd ~/briskrew-bench && bench --site test.localhost migrate
(cd apps/hrms && yarn build-flow)
bench restart   # or stop and re-run bench start
```

## Checking the priority screens

With the site running and Playwright installed (`npm install -g playwright && npx playwright install chromium`):

```bash
node apps/hrms/flow/scripts/audit-priority-screens.cjs
```

It opens the 20 priority screens in briskrew and reports any desk feature that doesn't
run there. Edit the login at the top of the script to your admin password first.

## Troubleshooting

- **`bench` says not to run as root**: switch to the `frappe` user (step 2).
- **`get-app` fails with "Repository not found"**: the deploy key isn't added, or the
  SSH address was mistyped (step 4).
- **Blank page at `/flow`**: run `(cd apps/hrms && yarn build-flow)` again; the page and
  its assets must come from the same build.
- **A screen says part of its script runs only in the classic desk**: that screen's
  original script used something briskrew doesn't support yet; use the link it shows,
  and report the screen so it can be added.
