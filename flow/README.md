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
- `SETUP.md`: how to run briskrew on a test server.

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

## Stock and assets

With ERPNext installed, briskrew has Stock and Assets areas next to the HR ones (main, Frappe
v16). Every stock and asset record type opens in briskrew's list and record screens, running
ERPNext's own form scripts (briskrew loads ERPNext's desk bundle, `erpnext.bundle.js`), so
transactions behave as in the desk: item details, rates, warehouses, Get Items From, the asset
value graph. Designed screens on top (server side: `hrms/briskrew/inventory.py`):

- `/flow/stock-levels`: stock by item and warehouse (ERPNext's Stock Summary data), filtered by
  warehouse, item group or item, with what's below its reorder level flagged.
- `/flow/item/<item>`: an item's stock by warehouse, reorder levels, recent movements, prices.
- `/flow/asset-register`: every asset with its value now, where it is and who has it, and
  maintenance or depreciation coming up.
- `/flow/asset/<asset>`: an asset's depreciation schedule, movements, maintenance and repairs.

`inventory/stock-assets-api.md` lists every ERPNext stock and assets API and how briskrew
reaches it. `hrms.briskrew.demo.seed` also seeds stock and assets demo data
(`hrms/briskrew/demo_inventory.py`).

## Check-ins and attendance

Server side: `hrms/briskrew/attendance.py`. Everything is built on Frappe HR's own Employee
Checkin and Auto Attendance, so the employee app (`/hrms`), biometric devices and briskrew all feed
the same check-in log.

- **Check in / Check out** card on Home for anyone whose user is linked to an employee. Each
  check-in records the browser's location (HR Settings, Allow Geolocation Tracking); a person who
  blocks location is told to allow it. A shift's Shift Location radius, if set, still applies.
- **`/flow/attendance`** (Time, Who's in): a day view (who's in, late, checked out, not in, on
  leave, off, with times, hours and where they checked in) and a month grid of everyone's
  attendance. HR roles see everyone; anyone else sees themselves and the people who report to them.
- **Setting it up for everyone**: HR managers get a one-click setup on that screen
  (`apply_attendance_setup`, safe to run again). It turns on check-ins from the app with location,
  creates the standard shift (10:00 to 19:00, Monday to Saturday; under 8 hours worked is a half
  day, under 4 is absent; 30 minutes' grace for late entry and early exit) with Auto Attendance
  from that day on, and gives it to active employees who have no shift of their own. Existing
  default shifts and shift assignments are left alone, and nothing before the setup day is marked.
  The shift's holiday list (Sundays off, plus the default company's own holidays, this year and
  next) applies to attendance only; leave and payroll keep each company's holiday lists.
- Frappe HR's hourly job then marks Present, Half Day or Absent, with late entry and early exit,
  once each shift has ended. Change the times or thresholds on the Shift Type
  "Standard 10:00-19:00".

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
