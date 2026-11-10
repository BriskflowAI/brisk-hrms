// Two-layer navigation: a fixed rail of areas, each with its own context sidebar.
// Every record type an HR, stock or assets user needs gets a named home here; anything not listed
// is still reachable from the command palette (⌘K) and the classic desk.

// `roles` on an area, section or item hides it from anyone holding none of them. Left off, it is for
// every signed-in employee. This only shapes the menus; the server still checks every request.
export const HR = ["HR Manager", "HR User", "System Manager"];
const APPROVERS = [...HR, "Leave Approver", "Expense Approver"];

const r = (label, doctype, extra = {}) => ({ label, doctype, ...extra });
const report = (label, extra = {}) => ({ label, report: label, ...extra });

export const areas = [
	{
		key: "home",
		label: "Home",
		icon: "home",
		to: "/",
		sections: [
			{
				label: "Waiting on you",
				roles: APPROVERS,
				items: [
					r("Leave requests", "Leave Application"),
					r("Expense claims", "Expense Claim"),
					r("Attendance requests", "Attendance Request"),
					r("Shift requests", "Shift Request"),
					r("Comp-off requests", "Compensatory Leave Request"),
				],
			},
		],
	},
	{ key: "inbox", label: "Inbox", icon: "inbox", to: "/inbox", roles: APPROVERS, sections: [] },
	{
		key: "people",
		label: "HR Setup",
		icon: "users",
		to: "/people",
		sections: [
			{
				label: "Directory",
				items: [
					{ label: "Overview", route: "/overview/people", roles: HR },
					{ label: "People", route: "/people" },
					{ label: "Org chart", route: "/org-chart" },
					r("Employees (table)", "Employee", { roles: HR }),
					r("Departments", "Department", { roles: HR }),
					r("Designations", "Designation", { roles: HR }),
					r("Branches", "Branch", { roles: HR }),
					r("Grades", "Employee Grade", { roles: HR }),
					r("Groups", "Employee Group", { roles: HR }),
					r("Companies", "Company", { roles: HR }),
				],
			},
			{
				label: "Lifecycle",
				roles: HR,
				items: [
					r("Onboarding", "Employee Onboarding"),
					r("Promotions", "Employee Promotion"),
					r("Transfers", "Employee Transfer"),
					r("Grievances", "Employee Grievance"),
					r("Separations", "Employee Separation"),
					r("Exit interviews", "Exit Interview"),
					r("Full & final", "Full and Final Statement"),
				],
			},
			{
				label: "Team",
				roles: HR,
				items: [
					{ label: "Team updates", route: "/team-updates" },
					r("Daily work summaries", "Daily Work Summary Group"),
				],
			},
		],
	},
	{
		key: "time",
		label: "Leaves",
		icon: "cal",
		sections: [
			{
				label: "Leave",
				items: [
					{ label: "My leave", route: "/leave" },
					{ label: "Overview", route: "/overview/time", roles: HR },
					r("Requests", "Leave Application", { roles: APPROVERS }),
					{ label: "Policy builder", route: "/leave-policies", roles: HR },
					r("Allocations", "Leave Allocation"),
					r("Policies", "Leave Policy", { roles: HR }),
					r("Policy assignments", "Leave Policy Assignment", { roles: HR }),
					r("Leave control panel", "Leave Control Panel", { roles: HR }),
					r("Leave types", "Leave Type", { roles: HR }),
					r("Leave periods", "Leave Period", { roles: HR }),
					r("Holidays", "Holiday List"),
					r("Holiday list assignments", "Holiday List Assignment", { roles: HR }),
					r("Block lists", "Leave Block List", { roles: HR }),
					r("Encashment", "Leave Encashment", { roles: HR }),
				],
			},
		],
	},
	{
		key: "attendance",
		label: "Shift & Attendance",
		icon: "clock",
		sections: [
			{
				label: "Attendance",
				items: [
					{ label: "Overview", route: "/overview/attendance", roles: HR },
					{ label: "Who's in", route: "/attendance" },
					r("Attendance", "Attendance"),
					r("Mark attendance", "Employee Attendance Tool", { roles: HR }),
					r("Check-ins", "Employee Checkin"),
					r("Shift types", "Shift Type", { roles: HR }),
					r("Shift assignments", "Shift Assignment"),
					r("Assign shifts", "Shift Assignment Tool", { roles: HR }),
					r("Shift schedules", "Shift Schedule", { roles: HR }),
					r("Schedule assignments", "Shift Schedule Assignment", { roles: HR }),
					r("Shift locations", "Shift Location", { roles: HR }),
					r("Shift requests", "Shift Request"),
					r("Overtime slips", "Overtime Slip"),
					r("Overtime types", "Overtime Type", { roles: HR }),
					{ label: "Roster", href: "/hr/roster", roles: HR },
				],
			},
		],
	},
	{
		key: "pay",
		label: "Payroll",
		icon: "coins",
		sections: [
			{
				label: "Runs",
				items: [
					{ label: "Overview", route: "/overview/pay", roles: HR },
					r("Payroll runs", "Payroll Entry", { roles: HR }),
					r("Salary slips", "Salary Slip"),
				],
			},
			{
				label: "Setup",
				roles: HR,
				items: [
					r("Salary components", "Salary Component", { roles: HR }),
					r("Salary structures", "Salary Structure", { roles: HR }),
					r("Assignments", "Salary Structure Assignment", { roles: HR }),
					r("Tax slabs", "Income Tax Slab", { roles: HR }),
					r("Payroll periods", "Payroll Period", { roles: HR }),
					r("Additional salary", "Additional Salary", { roles: HR }),
					r("Incentives", "Employee Incentive", { roles: HR }),
					r("Retention bonus", "Retention Bonus", { roles: HR }),
					r("Benefit applications", "Employee Benefit Application", { roles: HR }),
					r("Tax declarations", "Employee Tax Exemption Declaration", { roles: HR }),
					r("Salary withholding", "Salary Withholding", { roles: HR }),
					r("Payroll settings", "Payroll Settings", { roles: HR }),
				],
			},
			{
				label: "Reports",
				roles: HR,
				items: [
					report("Salary Register", { roles: HR }),
					report("Bank Remittance", { roles: HR }),
					report("Income Tax Computation", { roles: HR }),
				],
			},
		],
	},
	{
		key: "expenses",
		label: "Expenses",
		icon: "receipt",
		sections: [
			{
				label: "Money out",
				items: [
					{ label: "Overview", route: "/overview/expenses", roles: HR },
					r("Expense claims", "Expense Claim"),
					r("Advances", "Employee Advance"),
					r("Travel requests", "Travel Request"),
					r("Vehicle logs", "Vehicle Log"),
					r("Claim types", "Expense Claim Type", { roles: HR }),
				],
			},
		],
	},
	{
		key: "hiring",
		label: "Recruitment",
		roles: HR,
		icon: "door",
		sections: [
			{
				label: "Pipeline",
				items: [
					{ label: "Overview", route: "/overview/hiring" },
					r("Requisitions", "Job Requisition"),
					r("Openings", "Job Opening"),
					r("Applicants", "Job Applicant"),
					r("Interviews", "Interview"),
					r("Offers", "Job Offer"),
					r("Appointment letters", "Appointment Letter"),
					r("Staffing plans", "Staffing Plan"),
					r("Referrals", "Employee Referral"),
					{ label: "Job portal", href: "/jobs" },
				],
			},
			{
				label: "Setup",
				items: [
					r("Opening templates", "Job Opening Template"),
					r("Offer terms", "Job Offer Term Template"),
					r("Appointment letter templates", "Appointment Letter Template"),
					r("Interview types", "Interview Type"),
					r("Skills", "Skill"),
				],
			},
			{ label: "Reports", items: [report("Recruitment Analytics")] },
		],
	},
	{
		key: "growth",
		label: "Performance",
		icon: "spark",
		sections: [
			{
				label: "Performance",
				items: [
					{ label: "Overview", route: "/overview/growth", roles: HR },
					r("Appraisal cycles", "Appraisal Cycle", { roles: HR }),
					r("Appraisals", "Appraisal"),
					r("Feedback", "Employee Performance Feedback"),
					r("Goals", "Goal"),
					r("KRAs", "KRA"),
					r("Appraisal templates", "Appraisal Template", { roles: HR }),
					r("Feedback criteria", "Employee Feedback Criteria", { roles: HR }),
					report("Appraisal Overview", { roles: HR }),
				],
			},
			{
				label: "Learning",
				items: [
					r("Training programs", "Training Program", { roles: HR }),
					r("Training events", "Training Event"),
					r("Skill maps", "Employee Skill Map"),
				],
			},
		],
	},
	{
		key: "stock",
		label: "Stock",
		icon: "box",
		sections: [
			{
				label: "Inventory",
				items: [
					{ label: "Overview", route: "/overview/stock" },
					{ label: "Stock levels", route: "/stock-levels" },
					r("Items", "Item"),
					r("Item groups", "Item Group"),
					r("Warehouses", "Warehouse"),
					r("Batches", "Batch"),
					r("Serial numbers", "Serial No"),
				],
			},
			{
				label: "Movements",
				items: [
					r("Material requests", "Material Request"),
					r("Stock entries", "Stock Entry"),
					r("Purchase receipts", "Purchase Receipt"),
					r("Delivery notes", "Delivery Note"),
					r("Pick lists", "Pick List"),
					r("Packing slips", "Packing Slip"),
					r("Delivery trips", "Delivery Trip"),
					r("Shipments", "Shipment"),
					r("Stock counts", "Stock Reconciliation"),
					r("Landed costs", "Landed Cost Voucher"),
					r("Reservations", "Stock Reservation Entry"),
					r("Installation notes", "Installation Note"),
				],
			},
			{
				label: "Quality",
				items: [
					r("Inspections", "Quality Inspection"),
					r("Inspection templates", "Quality Inspection Template"),
					r("Inspection parameters", "Quality Inspection Parameter"),
					r("Parameter groups", "Quality Inspection Parameter Group"),
				],
			},
			{
				label: "Catalogue",
				items: [
					r("Item prices", "Item Price"),
					r("Price lists", "Price List"),
					r("Pricing rules", "Pricing Rule"),
					r("Product bundles", "Product Bundle"),
					r("Brands", "Brand"),
					r("Units of measure", "UOM"),
					r("UOM categories", "UOM Category"),
					r("UOM conversions", "UOM Conversion Factor"),
					r("Item attributes", "Item Attribute"),
					r("Item alternatives", "Item Alternative"),
					r("Item manufacturers", "Item Manufacturer"),
					r("Manufacturers", "Manufacturer"),
					r("Customs tariff numbers", "Customs Tariff Number"),
				],
			},
			{
				label: "Setup",
				items: [
					r("Stock settings", "Stock Settings"),
					r("Item variant settings", "Item Variant Settings"),
					r("Warehouse types", "Warehouse Type"),
					r("Stock entry types", "Stock Entry Type"),
					r("Putaway rules", "Putaway Rule"),
					r("Inventory dimensions", "Inventory Dimension"),
					r("Shipment parcel templates", "Shipment Parcel Template"),
					r("Delivery settings", "Delivery Settings"),
					r("Item lead times", "Item Lead Time"),
					r("Quick stock balance", "Quick Stock Balance"),
				],
			},
			{
				label: "Ledger",
				items: [
					r("Stock ledger entries", "Stock Ledger Entry"),
					r("Serial & batch bundles", "Serial and Batch Bundle"),
					r("Stock closing entries", "Stock Closing Entry"),
					r("Stock closing balances", "Stock Closing Balance"),
					r("Repost item valuation", "Repost Item Valuation"),
					r("Stock reposting settings", "Stock Reposting Settings"),
				],
			},
			{
				label: "Reports",
				items: [
					report("Stock Balance"),
					report("Stock Ledger"),
					report("Stock Projected Qty"),
					report("Stock Ageing"),
					report("Warehouse Wise Stock Balance"),
					report("Warehouse wise Item Balance Age and Value"),
					report("Stock Analytics"),
					report("Total Stock Summary"),
					report("Item Shortage Report"),
					report("Itemwise Recommended Reorder Level"),
					report("Items To Be Requested"),
					report("Requested Items To Be Transferred"),
					report("Item Prices"),
					report("Item Price Stock"),
					report("Item-wise Price List Rate"),
					report("Item Variant Details"),
					report("Item Where Used"),
					report("Item Wise Consumption"),
					report("Item Balance (Simple)"),
					report("Product Bundle Balance"),
					report("Reserved Stock"),
					report("Delivery Note Trends"),
					report("Purchase Receipt Trends"),
					report("Delayed Item Report"),
					report("Delayed Order Report"),
					report("Landed Cost Report"),
					report("COGS By Item Group"),
					report("Material Requests for which Supplier Quotations are not created"),
				],
			},
			{
				label: "Serial and batch reports",
				items: [
					report("Batch-Wise Balance History"),
					report("Batch Item Expiry Status"),
					report("Available Batch Report"),
					report("Available Serial No"),
					report("Serial No Ledger"),
					report("Serial No and Batch Traceability"),
					report("Serial and Batch Summary"),
					report("Serial No Status"),
					report("Serial No Warranty Expiry"),
					report("Serial No Service Contract Expiry"),
					report("Negative Batch Report"),
				],
			},
			{
				label: "Checks",
				items: [
					report("Stock and Account Value Comparison"),
					report("Stock Ledger Variance"),
					report("Stock Ledger Invariant Check"),
					report("Incorrect Stock Value Report"),
					report("Incorrect Balance Qty After Transaction"),
					report("Incorrect Serial No Valuation"),
					report("Incorrect Serial and Batch Bundle"),
					report("FIFO Queue vs Qty After Transaction Comparison"),
					report("Stock Qty vs Batch Qty"),
					report("Stock Qty vs Serial No Count"),
				],
			},
		],
	},
	{
		key: "assets",
		label: "Assets",
		icon: "laptop",
		sections: [
			{
				label: "Register",
				items: [
					{ label: "Overview", route: "/overview/assets" },
					{ label: "Asset register", route: "/asset-register" },
					r("Assets", "Asset"),
					r("Categories", "Asset Category"),
					r("Locations", "Location"),
				],
			},
			{
				label: "Lifecycle",
				items: [
					r("Movements", "Asset Movement"),
					r("Capitalizations", "Asset Capitalization"),
					r("Value adjustments", "Asset Value Adjustment"),
					r("Depreciation schedules", "Asset Depreciation Schedule"),
					r("Repairs", "Asset Repair"),
					r("Shift allocations", "Asset Shift Allocation"),
					r("Shift factors", "Asset Shift Factor"),
					r("Activity", "Asset Activity"),
				],
			},
			{
				label: "Maintenance",
				items: [
					r("Maintenance plans", "Asset Maintenance"),
					r("Maintenance logs", "Asset Maintenance Log"),
					r("Maintenance teams", "Asset Maintenance Team"),
				],
			},
			{
				label: "Reports",
				items: [
					report("Fixed Asset Register"),
					report("Asset Depreciation Ledger"),
					report("Asset Depreciations and Balances"),
					report("Asset Activity"),
					report("Asset Maintenance"),
				],
			},
		],
	},
	{
		key: "reports",
		label: "Reports",
		roles: APPROVERS,
		icon: "chart",
		sections: [
			{
				label: "People",
				items: [
					report("Employee Analytics"),
					report("Employee Birthday"),
					report("Employee Exits"),
					report("Employee Information"),
				],
			},
			{
				label: "Time",
				items: [
					report("Monthly Attendance Sheet"),
					report("Employee Leave Balance"),
					report("Employee Leave Balance Summary"),
					report("Leave Ledger"),
					report("Shift Attendance"),
					report("Employees working on a holiday"),
				],
			},
			{
				label: "Money",
				items: [
					report("Salary Register"),
					report("Employee CTC Break-up"),
					report("Unpaid Expense Claim"),
					report("Employee Advance Summary"),
				],
			},
		],
	},
];

// The area a record type belongs to. Home only lists shortcuts, so a record type's own area wins.
export function areaForDoctype(doctype) {
	const has = (a) => a.sections.some((s) => s.items.some((i) => i.doctype === doctype));
	return areas.find((a) => a.key !== "home" && has(a)) || areas.find(has);
}

export function allNavItems() {
	return areas.flatMap((a) =>
		a.sections.flatMap((s) =>
			s.items.map((i) => ({
				...i,
				roles: i.roles || s.roles || a.roles,
				area: a.label,
				section: s.label,
			})),
		),
	);
}
