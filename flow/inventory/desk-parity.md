# Desk feature parity

Everything the classic Frappe desk offers around the records themselves (the "shell"), and
where it is in briskrew. Record screens, lists and reports run each doctype's own desk
scripts; see `priority-coverage.md` for that audit.

Checked on a test site (Frappe develop, ERPNext develop, this branch) on 2026-10-03 (updated after the upstream merge), at
1440×900 and 390×844, as an HR manager and as a user with only Employee, Leave Approver
and Expense Approver roles.

## Account and session

| Desk | briskrew | Where |
|---|---|---|
| Log out | ✅ | Account menu (avatar), phone menu |
| My settings | ✅ | Account menu → own User record (editable through the share the desk uses) |
| Session defaults | ✅ | Account menu → Session defaults |
| Notifications (unread count, mark read, mark all read, open record, settings) | ✅ | Bell in the top bar; checks every minute and on tab focus |
| Menus only offer what the user can open | ✅ | Rail, sidebars, phone menu, command palette, Setup link |
| Translations in the user's language | ✅ | Frappe's catalogue for labels, record types, choices, navigation, buttons and briskrew's own sentences; right-to-left languages |
| Apps screen (switch to other Frappe apps and their workspaces) | ✅ | Grid button in the top bar |
| Keyboard shortcut list | ✅ | `?`, or Account menu → Keyboard shortcuts |
| Phone layout | ✅ | Bottom tabs, slide-in menu, stacked screens below 768px |

## Lists

| Desk | briskrew |
|---|---|
| Filters, standard filters, sort, search, paging | ✅ |
| Saved filters (List Filter, personal or for everyone) | ✅ Saved |
| Sidebar group-by counts (assigned to, created by, fields) | ✅ Group by |
| Column picker (per user) | ✅ Columns |
| Bulk edit, submit, cancel, delete, export | ✅ |
| Bulk assign to, add tags, print | ✅ |
| Report view (spreadsheet: inline editing, group-by with count/sum/average, totals, save as report) | ✅ Report |
| Calendar view | ✅ for every type with a desk calendar |
| Gantt view | ✅ for every type with a desk calendar |
| Image view | ✅ for types with an image field |
| Map view | ✅ for types with a location or latitude/longitude fields |
| Tree view | ✅ for tree types (departments, employees, goals) |
| Kanban view (Kanban Boards) | ✅ Board |
| List settings from scripts (indicators, buttons, actions) | ✅ |
| Live refresh | ✅ instantly through Frappe's realtime server; every 20 s and on tab focus when it can't be reached |

## Records

| Desk | briskrew |
|---|---|
| Form scripts, custom buttons, workflow actions | ✅ |
| Assign, attach, tags, share, connections | ✅ |
| Comments with @mentions, edit and delete own | ✅ |
| Email from a record (templates, attach PDF and files, Cc/Bcc, read receipt), reply, reply all | ✅ |
| Activity: comments, emails, changes, assignment/attachment/like/workflow logs | ✅ |
| Like | ✅ |
| Remind me | ✅ |
| Repeat (Auto Repeat) | ✅ |
| Print formats, PDF, duplicate, rename, copy link, copy to clipboard, follow, reload, delete, new, customize | ✅ |
| Someone else changed the record | ✅ instantly: quiet reload, or a banner when you have unsaved edits |
| Undo/redo (Ctrl/⌘ Z, Ctrl/⌘ Y outside text boxes) | ✅ also in the ••• menu |
| Jump to field (Ctrl/⌘ J) | ✅ |
| New record (Ctrl/⌘ B), save (Ctrl/⌘ S) | ✅ |

## Reports

| Desk | briskrew |
|---|---|
| Filters and report scripts | ✅ |
| Chart | ✅ bar, line, pie/donut/percentage |
| Column picker (per user) | ✅ |
| Print, PDF, export Excel/CSV | ✅ (PDF uses wkhtmltopdf on the server, as the desk does) |
| Save as custom report; custom reports open with their saved filters | ✅ |
| Report Builder reports | ✅ open in the list's Report view |
| Auto email | ✅ Email this regularly → Auto Email Report |

## Pages

| Desk | briskrew |
|---|---|
| Organizational chart | ✅ Org chart |
| Team updates | ✅ Team updates |
| Workspaces and dashboards | ✅ Overviews per area (number cards and charts), Stock and Assets included |
| Stock Summary | ✅ Stock levels (same data; reorder levels flagged, Move and Request actions) |
| Item dashboard (stock by warehouse) | ✅ Item page: stock by warehouse, reorder levels, recent movements, prices |
| Asset dashboard and value graph | ✅ Asset register and asset page (value now, depreciation schedule, movements, maintenance, repairs); the Asset form also draws its value graph |
| Warehouse Capacity Summary, Point of Sale | ❌ Classic desk only (see `stock-assets-api.md`) |

## Left in the classic desk

| Desk | Why |
|---|---|
| Email inbox list view (Communication as a mailbox) | Emails are on each record's activity, with reply and reply all; the mailbox view stays in the desk |
| Workspace and dashboard editing, Customize Form, DocType editing, system settings | On purpose (admin tools); reachable from Setup and the apps screen |
| ERPNext areas other than stock and assets (accounting, selling, buying…) | briskrew covers Frappe HR, Stock and Assets; the apps screen opens the others in the classic desk. Their records still open in briskrew when linked (a Purchase Order from a Material Request, say) |

## Notes

- Instant updates need Frappe's realtime server (`socketio`, port 9000 by default) running and
  reachable through the same proxy as the site. Without it, lists and records fall back to
  checking every 20 seconds.
- briskrew's own sentences are translated through Frappe's catalogue (`Translation` records and
  app translation files). Languages without those entries show English.
