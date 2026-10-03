# briskrew browser tests

Playwright tests that drive briskrew in Chromium against a running site:

- sign-in, a list, saving a record, the app switcher
- Report view, Gantt, Image and Map views
- undo/redo and jump to field
- the phone layout, translations
- instant updates (only with `E2E_REALTIME=1`, when Frappe's socketio server is running)

Every test also fails on a page error or a failed API call.

The site needs the demo team, which only developer-mode sites accept:

```bash
bench --site <site> set-config developer_mode 1
bench --site <site> execute hrms.briskrew.demo.setup_site   # or demo.seed on a site with a company
```

Run:

```bash
cd flow/e2e
npm install
npx playwright install chromium        # once
E2E_BASE_URL=http://127.0.0.1:8000 npx playwright test
```

`E2E_ADMIN_PASSWORD` (default `admin`) and `E2E_CHROMIUM` (path to a Chromium binary) are optional.
CI runs these in `.github/workflows/briskrew.yml`.
