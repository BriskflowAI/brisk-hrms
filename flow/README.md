# briskrew: the new HR interface

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

## Inbox

`/flow/inbox`: every leave, expense, shift, attendance and comp-off request waiting on the
current user, with the context to decide it (balance, who else in the team is away, holidays,
policy checks). Server side: `hrms/briskrew/inbox.py`.

- Decisions go through each document's own submit, or its workflow if one is set up,
  so validations, balances and notifications are unchanged.
- Nobody can decide their own request. Only the named approver (or an HR Manager) can decide
  a request that has an approver field.
- "Approve the clear ones" re-checks every request on the server and approves only those
  with no warnings.
- Approvals wait 5 seconds before being sent, so they can be undone.
- Keyboard: `J`/`K` move, `A` approve, `R` reject (asks for a reason), `C` comment.

## Default approvers

`hrms/briskrew/approvers.py`. Any empty leave, expense or shift approver on an employee
defaults to their reporting manager (`reports_to`). Explicit approvers always win.
Requests that arrive without an approver (API, mobile app, imports) get one on save:
the employee's approver, then the department's first approver, then the reporting manager.
To apply the default to existing employees once:

```sh
bench --site <site> execute hrms.briskrew.approvers.backfill_default_approvers
```

## Demo data (test sites only)

```sh
bench --site <site> set-config developer_mode 1
bench --site <site> execute hrms.briskrew.demo.seed --kwargs "{'company': '<Company>'}"
```

Creates a team lead (`lead@briskrew.demo`) with five reports and pending requests.

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
