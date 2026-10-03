# briskrew in a codespace

This codespace runs a full test copy of briskrew: Frappe and ERPNext (develop), this
repository's Frappe HR, and a demo company with a small team, leave requests and payroll.

## First start

Creating the codespace runs `.devcontainer/setup.sh`. It takes **15–25 minutes** the first
time (it installs Frappe, ERPNext and the front ends, then builds them). Watch progress in
the terminal; it ends with "Done".

Then open the **Ports** tab and click the globe next to **briskrew (8000)**.

| Sign in as | Password | Sees |
|---|---|---|
| `Administrator` | `admin` | Everything |
| `lead@briskrew.demo` | `briskrew-demo-1` | A team lead with five reports and pending requests |

- briskrew: `/flow`
- Employee mobile app: `/hrms` (open it on your phone, or narrow the browser window)
- Classic Frappe desk: `/app`

## Sharing the link

Ports are private by default: only you can open them, while signed in to GitHub. To show
someone else, right-click the port → **Port visibility → Public**, and send them the link.
Anyone with a public link can reach the site, so switch it back afterwards.

## After pulling new changes

```bash
cd ~/frappe-bench
bench --site briskrew.localhost migrate
(cd apps/hrms && yarn build)
pkill -f "bench start"; bash /workspaces/*/.devcontainer/start.sh
```

## If something's wrong

- The site isn't up: `tail -f ~/bench.log`, or start it with `bash .devcontainer/start.sh`.
- Setup stopped part-way: run `bash .devcontainer/setup.sh` again; it skips finished steps.
- Codespaces stop after 30 idle minutes; reopening one restarts briskrew automatically.
