// Two-layer navigation: a fixed rail of areas, each with its own context sidebar.
// Every record type an HR user needs gets a named home here; anything not listed
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
					{ label: "People", route: "/people" },
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
				items: [r("Payroll runs", "Payroll Entry"), r("Salary slips", "Salary Slip")],
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

export function areaForDoctype(doctype) {
	return areas.find((a) => a.sections.some((s) => s.items.some((i) => i.doctype === doctype)));
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
