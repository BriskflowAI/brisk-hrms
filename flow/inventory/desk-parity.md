# Desk feature parity

Everything the classic Frappe desk offers around the records themselves (the "shell"), and
where it is in briskrew. Record screens, lists and reports run each doctype's own desk
scripts; see `priority-coverage.md` for that audit.

Checked on a test site (Frappe develop, ERPNext develop, this branch) on 2026-10-03, at
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
| Translations in the user's language | ✅ | Frappe's catalogue for labels, record types, choices, navigation, buttons; right-to-left languages |
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
| Calendar view | ✅ for every type with a desk calendar |
| Tree view | ✅ for tree types (departments, employees, goals) |
| Kanban view (Kanban Boards) | ✅ Board |
| List settings from scripts (indicators, buttons, actions) | ✅ |
| Live refresh | ✅ every 20 s and on tab focus |

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
| Someone else changed the record | ✅ quiet reload, or a banner when you have unsaved edits |

## Reports

| Desk | briskrew |
|---|---|
| Filters and report scripts | ✅ |
| Chart | ✅ bar, line, pie/donut/percentage |
| Column picker (per user) | ✅ |
| Print, PDF, export Excel/CSV | ✅ (PDF uses wkhtmltopdf on the server, as the desk does) |
| Save as custom report; custom reports open with their saved filters | ✅ |
| Auto email | ✅ Email this regularly → Auto Email Report |

## Pages

| Desk | briskrew |
|---|---|
| Organizational chart | ✅ Org chart |
| Team updates | ✅ Team updates |
| Workspaces and dashboards | ✅ Overviews per area (number cards and charts) |

## Not in briskrew yet

| Desk | Status |
|---|---|
| briskrew's own sentences (hints, empty states) in other languages | English only; record type, field and button labels translate |
| Report view (spreadsheet-style list with inline editing and group-by totals) | Opens in the classic desk from the list's ••• menu |
| Gantt, image, map and email-inbox list views | Classic desk |
| Instant (socket) updates | Polling every 20 s instead |
| Form undo/redo, jump to field, keyboard shortcut list | Ctrl/⌘ K, Ctrl/⌘ S and the Inbox keys only |
| Workspace and dashboard editing, Customize Form, DocType editing, system settings | Classic desk, on purpose (admin tools) |
