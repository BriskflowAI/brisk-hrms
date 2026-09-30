# Priority screens: coverage audit

Each priority doctype was opened in briskrew on a test site (Frappe develop, ERPNext develop,
this branch of Frappe HR) as Administrator: its list, a new record and, where one existed, an
existing record. Each screen ran the doctype's original desk scripts through the compatibility
layer (`flow/src/engine/compat.js`). A screen passes when its scripts ran with no unsupported
desk API, no script error and no error message.

Last run: 2026-09-30. Re-run after upstream merges.

| Doctype | List | New | Existing | Buttons seen (existing record, else new) |
|---|---|---|---|---|
| Employee | ✅ | ✅ | ✅ | Overview, Address & Contacts, Attendance & Leaves, Salary, Personal Details, Profile, Joining, Exit |
| Leave Application | ✅ | ✅ | ✅ | Submit |
| Leave Allocation | ✅ | ✅ | ✅ | View Ledger, Actions, Cancel |
| Leave Policy | ✅ | ✅ | – |  |
| Leave Type | ✅ | ✅ | ✅ | Details, Limits |
| Holiday List | ✅ | ✅ | ✅ |  |
| Attendance | ✅ | ✅ | ✅ | Cancel |
| Employee Checkin | ✅ | ✅ | – |  |
| Attendance Request | ✅ | ✅ | ✅ |  |
| Shift Request | ✅ | ✅ | – |  |
| Shift Assignment | ✅ | ✅ | – |  |
| Expense Claim | ✅ | ✅ | ✅ | Submit, Expenses & Advances, Accounting, More Info |
| Employee Advance | ✅ | ✅ | – |  |
| Payroll Entry | ✅ | ✅ | ✅ | Submit Salary Slip, Review vs previous, Cancel, Overview, Employees, Accounting & Payment, Failure Details |
| Salary Slip | ✅ | ✅ | ✅ | Submit, Details, Payment Days, Earnings & Deductions, Net Pay Info, Income Tax Breakup, Bank Details, Leaves |
| Salary Structure | ✅ | ✅ | ✅ | Create, Actions, Cancel, Details, Earnings & Deductions, Account |
| Salary Structure Assignment | ✅ | ✅ | ✅ | Create, Actions, Cancel |
| Job Opening | ✅ | ✅ | – | Details, Pay Details |
| Job Applicant | ✅ | ✅ | – | Details, Salary Expectation |
| Appraisal | ✅ | ✅ | – | Overview, KRAs, Feedback, Self Appraisal |

Buttons that depend on a record's state (e.g. Payroll Entry's Get Employees / Create Salary Slips /
Submit Salary Slip, Leave Application's Submit) were also exercised end to end; see the commit history
for those runs.
