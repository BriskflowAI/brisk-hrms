# Screen coverage audit

Each doctype was opened in briskrew on a test site (see "Last run" for the Frappe and ERPNext
versions) as Administrator: its list, a new record and, where one existed, an existing record;
each report on its own screen. Each screen ran the original desk scripts through the
compatibility layer (`flow/src/engine/compat.js`). A screen passes when its scripts ran with no
unsupported desk API, no script error, no failed API call and no error message.

Last run: 2026-10-03 (HR, develop); 2026-10-07 (HR, stock and assets on main: Frappe v16,
ERPNext v16, with ERPNext's desk bundle loaded). Re-run after upstream merges.


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

## Stock

| Doctype | List | New | Existing | Buttons seen (existing record, else new) |
|---|---|---|---|---|
| Item | ✅ | ✅ | ✅ | View, Duplicate, Details, Accounting, UOM, Tax, Inventory, Purchasing, Sales, Manufacturing, Quality, Pricing |
| Item Group | ✅ | ✅ | ✅ | Item Group Tree, Items |
| Brand | ✅ | ✅ | – | Save ⌘S |
| UOM | ✅ | ✅ | ✅ |  |
| UOM Conversion Factor | ✅ | ✅ | ✅ |  |
| Item Attribute | ✅ | ✅ | ✅ |  |
| Item Price | ✅ | ✅ | ✅ |  |
| Price List | ✅ | ✅ | ✅ | Add / Edit Prices |
| Pricing Rule | ✅ | ✅ | – | Save ⌘S, Details, Dynamic Condition, Advanced Settings, Help Article |
| Product Bundle | ✅ | ✅ | – | Save ⌘S |
| Item Alternative | ✅ | ✅ | – | Save ⌘S |
| Item Manufacturer | ✅ | ✅ | – | Save ⌘S |
| Manufacturer | ✅ | ✅ | – | Save ⌘S |
| Customs Tariff Number | ✅ | ✅ | – | Save ⌘S |
| Warehouse | ✅ | ✅ | ✅ | Disable, Convert to Group, View |
| Warehouse Type | ✅ | ✅ | ✅ |  |
| Material Request | ✅ | ✅ | ✅ | Stop, Create, Cancel, Details, Terms, More Info |
| Stock Entry | ✅ | ✅ | ✅ | Get Items From, Create, Preview, Submit, Details, Additional Costs, Accounting Dimensions, Other Info |
| Stock Entry Type | ✅ | ✅ | ✅ |  |
| Purchase Receipt | ✅ | ✅ | ✅ | Create, View, Status, Cancel, Details, Address & Contact, Terms, More Info |
| Delivery Note | ✅ | ✅ | ✅ | Create, View, Status, Cancel, Details, Address & Contact, Terms, More Info |
| Pick List | ✅ | ✅ | – | Save ⌘S, Details, More Info |
| Packing Slip | ✅ | ✅ | – | Save ⌘S |
| Delivery Trip | ✅ | ✅ | – | Get stops from, View, Save ⌘S |
| Shipment | ✅ | ✅ | – | Save ⌘S |
| Stock Reconciliation | ✅ | ✅ | ✅ | View, Cancel |
| Landed Cost Voucher | ✅ | ✅ | – | Save ⌘S |
| Quality Inspection | ✅ | ✅ | – | Save ⌘S |
| Quality Inspection Template | ✅ | ✅ | – | Save ⌘S |
| Quality Inspection Parameter | ✅ | ✅ | – | Save ⌘S |
| Serial No | ✅ | ✅ | ✅ | View Ledgers |
| Batch | ✅ | ✅ | ✅ | View Ledger, Recalculate Batch Qty |
| Serial and Batch Bundle | ✅ | ✅ | ✅ | Cancel, Serial and Batch, Quantity and Rate, Reference |
| Stock Reservation Entry | ✅ | ✅ | – | Save ⌘S, Details, Serial and Batch Reservation, More Information |
| Putaway Rule | ✅ | ✅ | – | Save ⌘S |
| Inventory Dimension | ✅ | ✅ | – | Save ⌘S, Dimension Details, Applicable For |
| Installation Note | ✅ | ✅ | – | fa fa-download, Save ⌘S |
| Stock Closing Entry | ✅ | ✅ | – | Save ⌘S |
| Repost Item Valuation | ✅ | ✅ | – | Save ⌘S |
| Stock Ledger Entry | ✅ | ✅ | ✅ |  |

## Assets

| Doctype | List | New | Existing | Buttons seen (existing record, else new) |
|---|---|---|---|---|
| Asset | ✅ | ✅ | ✅ | Cancel, Details, Depreciation, More Info |
| Asset Category | ✅ | ✅ | ✅ |  |
| Location | ✅ | ✅ | ✅ |  |
| Asset Movement | ✅ | ✅ | ✅ | Cancel |
| Asset Capitalization | ✅ | ✅ | – | Save ⌘S |
| Asset Depreciation Schedule | ✅ | ✅ | ✅ | Cancel |
| Asset Value Adjustment | ✅ | ✅ | – | Save ⌘S |
| Asset Repair | ✅ | ✅ | ✅ | Submit |
| Asset Maintenance | ✅ | ✅ | ✅ |  |
| Asset Maintenance Team | ✅ | ✅ | ✅ |  |
| Asset Maintenance Log | ✅ | ✅ | ✅ | Submit |
| Asset Shift Allocation | ✅ | ✅ | – | Save ⌘S |
| Asset Shift Factor | ✅ | ✅ | – | Save ⌘S |
| Asset Activity | ✅ | ✅ | ✅ |  |

## Stock reports

49 of 49 open with their filters and run their scripts with no error. Serial No and Batch Traceability, FIFO Queue vs Qty After Transaction Comparison ask for at least one filter before running, as in the desk.

Stock Balance, Stock Ledger, Stock Projected Qty, Stock Ageing, Warehouse Wise Stock Balance, Warehouse wise Item Balance Age and Value, Stock Analytics, Total Stock Summary, Item Shortage Report, Itemwise Recommended Reorder Level, Items To Be Requested, Requested Items To Be Transferred, Item Prices, Item Price Stock, Item-wise Price List Rate, Item Variant Details, Item Where Used, Item Wise Consumption, Item Balance (Simple), Product Bundle Balance, Reserved Stock, Delivery Note Trends, Purchase Receipt Trends, Delayed Item Report, Delayed Order Report, Landed Cost Report, COGS By Item Group, Material Requests for which Supplier Quotations are not created, Batch-Wise Balance History, Batch Item Expiry Status, Available Batch Report, Available Serial No, Serial No Ledger, Serial No and Batch Traceability, Serial and Batch Summary, Serial No Status, Serial No Warranty Expiry, Serial No Service Contract Expiry, Negative Batch Report, Stock and Account Value Comparison, Stock Ledger Variance, Stock Ledger Invariant Check, Incorrect Stock Value Report, Incorrect Balance Qty After Transaction, Incorrect Serial No Valuation, Incorrect Serial and Batch Bundle, FIFO Queue vs Qty After Transaction Comparison, Stock Qty vs Batch Qty, Stock Qty vs Serial No Count.

## Asset reports

5 of 5 open with their filters and run their scripts with no error.

Fixed Asset Register, Asset Depreciation Ledger, Asset Depreciations and Balances, Asset Activity, Asset Maintenance.

Buttons that depend on a record's state (e.g. Payroll Entry's Get Employees / Create Salary Slips /
Submit Salary Slip, Leave Application's Submit) were also exercised end to end; see the commit history
for those runs.
