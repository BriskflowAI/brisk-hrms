# briskCrew: the new HR interface

A new interface for this app, built alongside the classic desk. The Python
server code (every rule, calculation, permission and workflow) is unchanged.
The new UI only calls Frappe's standard endpoints.

Served at `/flow` on any site with this app installed.

## Layout

- `src/nav.js`: the two-layer navigation (a rail of areas, each with its own sidebar).
  Every record type an HR user works with has a named place here.
- `src/views/DocList.vue`, `src/views/DocForm.vue`: generic list and record screens driven
  by Frappe's metadata, so any record type opens in the new UI on day one, custom fields included.
  Anything these screens can't do yet (submit, cancel, form buttons, full dependency rules)
  is one click away in the classic desk.
- `src/components/CommandPalette.vue`: ⌘K search over people, record types and reports.
- `src/brand.js`: the product name and mark. Renaming the product only touches this file.
- `inventory/`: the feature checklist the new UI must cover, generated from the source.

## Develop

```sh
cd flow
yarn install      # or: npm install
yarn dev          # http://<site>:8082/flow, proxies API calls to the local bench
yarn build        # outputs to hrms/public/flow and hrms/www/flow.html
```

## Feature inventory

```sh
python3 flow/scripts/inventory.py
```

Rewrites `inventory/feature-inventory.md` and `.json`. Re-run it after every upstream
merge and review the diff: new buttons, fields or reports upstream added show up there.

## Licences

This interface ships inside Frappe HR, which is licensed under the GNU GPL v3, and runs on
ERPNext (GPL v3) and the Frappe Framework (MIT). The About page (`/flow/about`) keeps
their copyright notices and links to the source. Keep it when rebranding.
