// Two-layer navigation: a fixed rail of areas, each with its own context sidebar.
// Every record type an HR, stock or assets user needs gets a named home here; anything not listed
// is still reachable from the command palette (⌘K) and the classic desk.

const r = (label, doctype, extra = {}) => ({ label, doctype, ...extra });
const report = (label) => ({ label, report: label });

export const areas = [
	{
		key: "home",
		label: "Home",
		icon: "home",
		to: "/",
		sections: [
			{
				label: "Waiting on you",
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
	{ key: "inbox", label: "Inbox", icon: "inbox", to: "/inbox", sections: [] },
	{
		key: "people",
		label: "People",
		icon: "users",
		to: "/people",
		sections: [
			{
				label: "Directory",
				items: [
					{ label: "Overview", route: "/overview/people" },
					{ label: "People", route: "/people" },
					{ label: "Org chart", route: "/org-chart" },
					r("Employees (table)", "Employee"),
					r("Departments", "Department"),
					r("Designations", "Designation"),
					r("Branches", "Branch"),
					r("Grades", "Employee Grade"),
					r("Groups", "Employee Group"),
				],
			},
			{
				label: "Lifecycle",
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
				items: [
					{ label: "Team updates", route: "/team-updates" },
					r("Daily work summaries", "Daily Work Summary Group"),
				],
			},
		],
	},
	{
		key: "time",
		label: "Time",
		icon: "cal",
		sections: [
			{
				label: "Leave",
				items: [
					{ label: "Overview", route: "/overview/time" },
					r("Requests", "Leave Application"),
					{ label: "Policy builder", route: "/leave-policies" },
					r("Allocations", "Leave Allocation"),
					r("Policies", "Leave Policy"),
					r("Policy assignments", "Leave Policy Assignment"),
					r("Leave types", "Leave Type"),
					r("Leave periods", "Leave Period"),
					r("Holidays", "Holiday List"),
					r("Block lists", "Leave Block List"),
					r("Encashment", "Leave Encashment"),
				],
			},
			{
				label: "Attendance",
				items: [
					r("Attendance", "Attendance"),
					r("Check-ins", "Employee Checkin"),
					r("Shift types", "Shift Type"),
					r("Shift assignments", "Shift Assignment"),
					r("Shift requests", "Shift Request"),
				],
			},
		],
	},
	{
		key: "pay",
		label: "Pay",
		icon: "coins",
		sections: [
			{
				label: "Runs",
				items: [
					{ label: "Overview", route: "/overview/pay" },
					r("Payroll runs", "Payroll Entry"),
					r("Salary slips", "Salary Slip"),
				],
			},
			{
				label: "Setup",
				items: [
					r("Salary components", "Salary Component"),
					r("Salary structures", "Salary Structure"),
					r("Assignments", "Salary Structure Assignment"),
					r("Tax slabs", "Income Tax Slab"),
					r("Payroll periods", "Payroll Period"),
					r("Additional salary", "Additional Salary"),
					r("Incentives", "Employee Incentive"),
					r("Retention bonus", "Retention Bonus"),
					r("Benefit applications", "Employee Benefit Application"),
					r("Tax declarations", "Employee Tax Exemption Declaration"),
				],
			},
			{
				label: "Reports",
				items: [
					report("Salary Register"),
					report("Bank Remittance"),
					report("Income Tax Computation"),
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
					{ label: "Overview", route: "/overview/expenses" },
					r("Expense claims", "Expense Claim"),
					r("Advances", "Employee Advance"),
					r("Travel requests", "Travel Request"),
					r("Vehicle logs", "Vehicle Log"),
					r("Claim types", "Expense Claim Type"),
				],
			},
		],
	},
	{
		key: "hiring",
		label: "Hiring",
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
				],
			},
		],
	},
	{
		key: "growth",
		label: "Growth",
		icon: "spark",
		sections: [
			{
				label: "Performance",
				items: [
					{ label: "Overview", route: "/overview/growth" },
					r("Appraisal cycles", "Appraisal Cycle"),
					r("Appraisals", "Appraisal"),
					r("Feedback", "Employee Performance Feedback"),
					r("Goals", "Goal"),
					r("KRAs", "KRA"),
				],
			},
			{
				label: "Learning",
				items: [
					r("Training programs", "Training Program"),
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
			{ label: "More", items: [{ label: "All reports", href: "/app/report" }] },
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
		a.sections.flatMap((s) => s.items.map((i) => ({ ...i, area: a.label, section: s.label }))),
	);
}

export const classicUrl = (doctype, name) => {
	const slug = doctype.toLowerCase().replace(/ /g, "-");
	return name ? `/app/${slug}/${encodeURIComponent(name)}` : `/app/${slug}`;
};
