# Screen coverage audit

Each doctype was opened in briskrew on a test site (Frappe develop, ERPNext develop,
this branch of Frappe HR) as Administrator: its list, a new record and, where one existed, an
existing record. Each screen ran the doctype's original desk scripts through the compatibility
layer (`flow/src/engine/compat.js`). A screen passes when its scripts ran with no unsupported
desk API, no script error and no error message.

Last run: 2026-10-03. Re-run after upstream merges.


## Priority screens

| Doctype | List | New | Existing | Buttons seen (existing record, else new) |
|---|---|---|---|---|
| Employee | ✅ | ✅ | ✅ | Overview, Address & Contacts, Attendance & Leaves, Salary, Personal Details, Profile, Joining, Exit |
| Leave Application | ✅ | ✅ | ✅ | Submit |
| Leave Allocation | ✅ | ✅ | ✅ | View Ledger, Actions, Cancel |
| Leave Policy | ✅ | ✅ | ✅ | Submit |
| Leave Type | ✅ | ✅ | ✅ | Details, Limits |
| Holiday List | ✅ | ✅ | ✅ | Save ⌘S |
| Attendance | ✅ | ✅ | ✅ | Cancel |
| Employee Checkin | ✅ | ✅ | – | Save ⌘S |
| Attendance Request | ✅ | ✅ | ✅ | Save ⌘S |
| Shift Request | ✅ | ✅ | ✅ | Submit |
| Shift Assignment | ✅ | ✅ | ✅ | Cancel |
| Expense Claim | ✅ | ✅ | ✅ | Submit, Expenses & Advances, Accounting, More Info |
| Employee Advance | ✅ | ✅ | – | Save ⌘S |
| Payroll Entry | ✅ | ✅ | ✅ | Submit Salary Slip, Review vs previous, Cancel, Overview, Employees, Accounting & Payment, Failure Details |
| Salary Slip | ✅ | ✅ | ✅ | Submit, Details, Payment Days, Earnings & Deductions, Net Pay Info, Income Tax Breakup, Bank Details, Leaves |
| Salary Structure | ✅ | ✅ | ✅ | Create, Actions, Cancel, Details, Earnings & Deductions, Account |
| Salary Structure Assignment | ✅ | ✅ | ✅ | Create, Actions, Cancel |
| Job Opening | ✅ | ✅ | ✅ | Details, Pay Details |
| Job Applicant | ✅ | ✅ | ✅ | Shortlist, Reject, Schedule Interview, Details, Salary Expectation |
| Appraisal | ✅ | ✅ | ✅ | View Goals, Submit, Overview, KRAs, Feedback, Self Appraisal |

## Performance

| Doctype | List | New | Existing | Buttons seen (existing record, else new) |
|---|---|---|---|---|
| Appraisal Cycle | ✅ | ✅ | ✅ | View Goals, Create Appraisals, Mark as Completed, Overview, Applicable For |
| Appraisal Template | ✅ | ✅ | ✅ |  |
| Appraisal | ✅ | ✅ | ✅ | View Goals, Submit, Overview, KRAs, Feedback, Self Appraisal |
| KRA | ✅ | ✅ | ✅ |  |
| Goal | ✅ | ✅ | ✅ | Status |
| Employee Performance Feedback | ✅ | ✅ | – | Save ⌘S, Employee Details, Feedback |
| Employee Feedback Criteria | ✅ | ✅ | ✅ |  |

## Hiring

| Doctype | List | New | Existing | Buttons seen (existing record, else new) |
|---|---|---|---|---|
| Staffing Plan | ✅ | ✅ | – | Save ⌘S |
| Job Requisition | ✅ | ✅ | – | Save ⌘S, Details, Job Description |
| Job Opening | ✅ | ✅ | ✅ | Details, Pay Details |
| Job Applicant | ✅ | ✅ | ✅ | Shortlist, Reject, Schedule Interview, Details, Salary Expectation |
| Interview Type | ✅ | ✅ | ✅ | Create Interview |
| Interview | ✅ | ✅ | ✅ | Actions, Submit Feedback, Submit, Details, Feedback |
| Interview Feedback | ✅ | ✅ | – | Save ⌘S |
| Job Offer | ✅ | ✅ | ✅ | Submit |
| Appointment Letter | ✅ | ✅ | – | Save ⌘S |
| Employee Referral | ✅ | ✅ | – | Save ⌘S |

## Shifts

| Doctype | List | New | Existing | Buttons seen (existing record, else new) |
|---|---|---|---|---|
| Shift Type | ✅ | ✅ | ✅ | Shift Tools, Mark Attendance |
| Shift Location | ✅ | ✅ | ✅ | Shift Tools |
| Shift Schedule | ✅ | ✅ | – | Save ⌘S |
| Shift Schedule Assignment | ✅ | ✅ | – | Save ⌘S |
| Shift Assignment | ✅ | ✅ | ✅ | Cancel |
| Shift Request | ✅ | ✅ | ✅ | Submit |
| Employee Checkin | ✅ | ✅ | – | Save ⌘S |

Buttons that depend on a record's state (e.g. Payroll Entry's Get Employees / Create Salary Slips /
Submit Salary Slip, Leave Application's Submit) were also exercised end to end; see the commit history
for those runs.
