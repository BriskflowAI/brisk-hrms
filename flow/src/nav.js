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
		label: "HR Setup",
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
					r("Companies", "Company"),
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
		label: "Leaves",
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
					r("Leave control panel", "Leave Control Panel"),
					r("Leave types", "Leave Type"),
					r("Leave periods", "Leave Period"),
					r("Holidays", "Holiday List"),
					r("Holiday list assignments", "Holiday List Assignment"),
					r("Block lists", "Leave Block List"),
					r("Encashment", "Leave Encashment"),
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
					{ label: "Overview", route: "/overview/attendance" },
					{ label: "Who's in", route: "/attendance" },
					r("Attendance", "Attendance"),
					r("Mark attendance", "Employee Attendance Tool"),
					r("Check-ins", "Employee Checkin"),
					r("Shift types", "Shift Type"),
					r("Shift assignments", "Shift Assignment"),
					r("Assign shifts", "Shift Assignment Tool"),
					r("Shift schedules", "Shift Schedule"),
					r("Schedule assignments", "Shift Schedule Assignment"),
					r("Shift locations", "Shift Location"),
					r("Shift requests", "Shift Request"),
					r("Overtime slips", "Overtime Slip"),
					r("Overtime types", "Overtime Type"),
					{ label: "Roster", href: "/hr/roster" },
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
					r("Salary withholding", "Salary Withholding"),
					r("Payroll settings", "Payroll Settings"),
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
		label: "Recruitment",
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
					{ label: "Overview", route: "/overview/growth" },
					r("Appraisal cycles", "Appraisal Cycle"),
					r("Appraisals", "Appraisal"),
					r("Feedback", "Employee Performance Feedback"),
					r("Goals", "Goal"),
					r("KRAs", "KRA"),
					r("Appraisal templates", "Appraisal Template"),
					r("Feedback criteria", "Employee Feedback Criteria"),
					report("Appraisal Overview"),
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
		a.sections.flatMap((s) => s.items.map((i) => ({ ...i, area: a.label, section: s.label }))),
	);
}
