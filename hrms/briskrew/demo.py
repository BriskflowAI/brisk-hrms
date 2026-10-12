"""Sample team and requests for trying briskrew on a test site.

Run on a test site only (never production):
    bench --site <site> execute hrms.briskrew.demo.seed --kwargs "{'company': '<Company>'}"

Creates a team lead with five reports, leave allocations, and a mix of pending
requests (leave, shift, attendance) so the Inbox has something to decide.
Safe to re-run: existing demo records are reused. Log in as the lead with
lead@briskrew.demo / the password printed at the end.
"""

import frappe
from frappe import _
from frappe.utils import add_days, add_months, getdate, nowdate

DEMO_PASSWORD = "briskrew-demo-1"
LEAD = ("lead@briskrew.demo", "Maya", "Rodrigues", "Design Lead")
TEAM = [
	("priya@briskrew.demo", "Priya", "Nair", "Senior Product Designer"),
	("hana@briskrew.demo", "Hana", "Kim", "Product Designer"),
	("tomas@briskrew.demo", "Tomás", "Ruiz", "UX Researcher"),
	("mei@briskrew.demo", "Mei", "Chen", "Visual Designer"),
	("daniel@briskrew.demo", "Daniel", "Okafor", "Content Designer"),
]


def setup_site(
	company: str = "Brisk Flow Demo",
	country: str = "India",
	currency: str = "INR",
	timezone: str = "Asia/Kolkata",
) -> dict:
	"""A ready-to-try site from a fresh install: finishes ERPNext's setup wizard
	(company, fiscal year, chart of accounts) when no company exists yet, then seeds the demo team.
	Used by the Codespaces setup in .devcontainer/."""
	if not frappe.conf.developer_mode:
		frappe.throw(_("Demo data is for test sites only. Enable developer_mode on the site first."))

	if not frappe.db.exists("Company", {}):
		from frappe.desk.page.setup_wizard.setup_wizard import setup_complete

		year = getdate(nowdate()).year
		res = setup_complete(
			{
				"language": "english",
				"country": country,
				"currency": currency,
				"timezone": timezone,
				"company_name": company,
				"company_abbr": "".join(w[0] for w in company.split()).upper()[:5],
				"chart_of_accounts": "Standard",
				"fy_start_date": f"{year}-01-01",
				"fy_end_date": f"{year}-12-31",
				"setup_demo": 0,
			}
		)
		if (res or {}).get("status") not in (None, "ok"):
			frappe.throw(_("Setup wizard failed: {0}").format(res))
		frappe.db.commit()  # nosemgrep

	result = seed(frappe.db.get_value("Company", {}, "name"))
	frappe.db.commit()  # nosemgrep
	return result


def seed(company: str | None = None) -> dict:
	if not frappe.conf.developer_mode and not frappe.flags.in_test:
		frappe.throw(_("Demo data is for test sites only. Enable developer_mode on the site first."))

	company = company or frappe.db.get_value("Company", {}, "name")
	if not company:
		frappe.throw(_("Create a company first (finish the setup wizard)."))

	department = _department(company)
	holiday_list = _holiday_list()
	frappe.db.set_value("Company", company, "default_holiday_list", holiday_list)
	leave_type = _leave_type()

	lead = _employee(*LEAD, company=company, department=department, holiday_list=holiday_list)
	team = [
		_employee(*m, company=company, department=department, holiday_list=holiday_list, reports_to=lead)
		for m in TEAM
	]

	for emp in [lead, *team]:
		_assign_holidays(emp, holiday_list)
		_allocate(emp, leave_type)

	lead_user = LEAD[0]
	today = getdate(nowdate())
	next_monday = add_days(today, 7 - today.weekday())
	requests = [
		_leave(team[0], leave_type, next_monday, add_days(next_monday, 2), "Family function out of town."),
		_leave(team[1], leave_type, add_days(next_monday, 1), add_days(next_monday, 4), "Trip home."),
		_leave(
			team[2], leave_type, add_days(next_monday, 2), add_days(next_monday, 2), "Doctor's appointment."
		),
		_leave(team[3], leave_type, add_days(next_monday, 14), add_days(next_monday, 28), "Long holiday."),
		_attendance(team[4], _last_workday(today), "On Duty"),
		# Something happening this week, so the Today screen isn't empty.
		_leave(team[4], leave_type, today, add_days(today, 1), "Moving house."),
	]
	_payroll_setup(company, [lead, *team])
	_previous_month_slips(company, [lead, *team])
	_bonus(company, _draft_slip_employee(team, today) or team[3], today)
	_expense_setup(company)

	_shifts(company, team, today)
	shift = _shift_request(team[4], lead_user, add_days(next_monday, 7), company)
	if shift:
		requests.append(shift)

	_performance(company, lead, team, today)
	_hiring(company, lead_user, today)

	# Stock and assets, for the briskrew Stock and Assets areas.
	from hrms.briskrew.demo_inventory import seed as seed_inventory

	inventory = {}
	if "erpnext" in frappe.get_installed_apps():
		# A site whose company isn't fully set up for stock still gets the HR demo.
		frappe.db.savepoint("briskrew_inventory_demo")
		try:
			inventory = seed_inventory(company)
		except Exception as e:
			frappe.db.rollback(save_point="briskrew_inventory_demo")
			frappe.log_error(title="briskrew: stock and assets demo data")
			inventory = {"error": str(e)}

	# Run from the command line, not inside a request, so nothing else commits for it.
	frappe.db.commit()  # nosemgrep
	return {
		"login": lead_user,
		"password": DEMO_PASSWORD,
		"team": [e for e in team],
		"requests": [r for r in requests if r],
		"inventory": inventory,
	}


def _department(company):
	abbr = frappe.db.get_value("Company", company, "abbr")
	name = f"Design - {abbr}"
	if not frappe.db.exists("Department", name):
		frappe.get_doc({"doctype": "Department", "department_name": "Design", "company": company}).insert(
			ignore_permissions=True
		)
	return name


def _holiday_list():
	name = f"briskrew demo {getdate().year}"
	if frappe.db.exists("Holiday List", name):
		return name
	year = getdate().year
	doc = frappe.get_doc(
		{
			"doctype": "Holiday List",
			"holiday_list_name": name,
			"from_date": f"{year}-01-01",
			"to_date": f"{year + 1}-12-31",
			"weekly_off": "Sunday",
		}
	)
	doc.get_weekly_off_dates()
	doc.insert(ignore_permissions=True)
	return name


def _leave_type():
	name = "Annual Leave"
	if not frappe.db.exists("Leave Type", name):
		frappe.get_doc(
			{"doctype": "Leave Type", "leave_type_name": name, "max_leaves_allowed": 12, "allow_negative": 1}
		).insert(ignore_permissions=True)
	return name


def _user(email, first, last):
	if not frappe.db.exists("User", email):
		user = frappe.get_doc(
			{
				"doctype": "User",
				"email": email,
				"first_name": first,
				"last_name": last,
				"send_welcome_email": 0,
				"new_password": DEMO_PASSWORD,
				"roles": [{"role": "Employee"}],
			}
		)
		user.insert(ignore_permissions=True)
	return email


def _employee(email, first, last, designation, company, department, holiday_list, reports_to=None):
	user = _user(email, first, last)
	if name := frappe.db.get_value("Employee", {"user_id": user}):
		return name
	if not frappe.db.exists("Designation", designation):
		frappe.get_doc({"doctype": "Designation", "designation_name": designation}).insert(
			ignore_permissions=True
		)
	doc = frappe.get_doc(
		{
			"doctype": "Employee",
			"first_name": first,
			"last_name": last,
			"gender": frappe.db.get_value("Gender", {}, "name"),
			"date_of_birth": "1992-04-12",
			"date_of_joining": add_months(nowdate(), -30),
			"company": company,
			"department": department,
			"designation": designation,
			"holiday_list": holiday_list,
			"user_id": user,
			"reports_to": reports_to,
			"status": "Active",
		}
	)
	doc.insert(ignore_permissions=True)
	return doc.name


def _assign_holidays(employee, holiday_list):
	if frappe.db.exists(
		"Holiday List Assignment", {"assigned_to": employee, "holiday_list": holiday_list, "docstatus": 1}
	):
		return
	doc = frappe.get_doc(
		{
			"doctype": "Holiday List Assignment",
			"applicable_for": "Employee",
			"assigned_to": employee,
			"holiday_list": holiday_list,
			"from_date": f"{getdate().year}-01-01",
		}
	)
	doc.insert(ignore_permissions=True)
	doc.submit()


def _allocate(employee, leave_type):
	from_date = f"{getdate().year}-01-01"
	if frappe.db.exists(
		"Leave Allocation",
		{"employee": employee, "leave_type": leave_type, "from_date": from_date, "docstatus": 1},
	):
		return
	doc = frappe.get_doc(
		{
			"doctype": "Leave Allocation",
			"employee": employee,
			"leave_type": leave_type,
			"from_date": from_date,
			"to_date": f"{getdate().year}-12-31",
			"new_leaves_allocated": 12,
		}
	)
	doc.insert(ignore_permissions=True)
	doc.submit()


def _leave(employee, leave_type, from_date, to_date, reason):
	existing = frappe.db.get_value(
		"Leave Application", {"employee": employee, "from_date": from_date, "docstatus": 0}
	)
	if existing:
		doc = frappe.get_doc("Leave Application", existing)
		if not doc.leave_approver:
			doc.save(ignore_permissions=True)  # picks up the default approver
		return existing
	doc = frappe.get_doc(
		{
			"doctype": "Leave Application",
			"employee": employee,
			"leave_type": leave_type,
			"from_date": from_date,
			"to_date": to_date,
			"description": reason,
			"status": "Open",
		}
	)
	doc.insert(ignore_permissions=True)
	return doc.name


def _attendance(employee, day, reason):
	existing = frappe.db.get_value(
		"Attendance Request", {"employee": employee, "from_date": day, "docstatus": 0}
	)
	if existing:
		return existing
	doc = frappe.get_doc(
		{
			"doctype": "Attendance Request",
			"employee": employee,
			"from_date": day,
			"to_date": day,
			"reason": reason,
			"explanation": "Client workshop off-site all day; forgot to check in.",
		}
	)
	doc.insert(ignore_permissions=True)
	return doc.name


def _shift_request(employee, approver, from_date, company):
	shift_type = frappe.db.get_value("Shift Type", {}, "name")
	if not shift_type:
		return None
	existing = frappe.db.get_value("Shift Request", {"employee": employee, "docstatus": 0})
	if existing:
		return existing
	doc = frappe.get_doc(
		{
			"doctype": "Shift Request",
			"employee": employee,
			"company": company,
			"shift_type": shift_type,
			"from_date": from_date,
			"to_date": add_days(from_date, 4),
			"approver": approver,
			"status": "Draft",
		}
	)
	doc.insert(ignore_permissions=True)
	return doc.name


def _last_workday(today):
	day = add_days(today, -1)
	while getdate(day).weekday() == 6:  # Sunday is the demo weekly off
		day = add_days(day, -1)
	return day


def _component(name, abbr, kind):
	if not frappe.db.exists("Salary Component", name):
		frappe.get_doc(
			{
				"doctype": "Salary Component",
				"salary_component": name,
				"salary_component_abbr": abbr,
				"type": kind,
			}
		).insert(ignore_permissions=True)
	return name


def _payroll_setup(company, employees):
	"""A simple monthly structure (basic = base, flat professional tax) assigned to the demo team."""
	currency = frappe.db.get_value("Company", company, "default_currency")
	basic = _component("Demo Basic", "DB", "Earning")
	tax = _component("Demo Professional Tax", "DPT", "Deduction")
	structure = "briskrew Demo Structure"
	if not frappe.db.exists("Salary Structure", structure):
		doc = frappe.get_doc(
			{
				"doctype": "Salary Structure",
				"name": structure,
				"company": company,
				"currency": currency,
				"payroll_frequency": "Monthly",
				"earnings": [
					{"salary_component": basic, "abbr": "DB", "amount_based_on_formula": 1, "formula": "base"}
				],
				"deductions": [{"salary_component": tax, "abbr": "DPT", "amount": 200}],
			}
		)
		doc.insert(ignore_permissions=True)
		doc.submit()

	payable = frappe.db.get_value("Company", company, "default_payroll_payable_account")
	if payable and frappe.db.get_value("Account", payable, "account_type") != "Payable":
		frappe.db.set_value("Account", payable, "account_type", "Payable")
	for i, emp in enumerate(employees):
		if frappe.db.exists("Salary Structure Assignment", {"employee": emp, "docstatus": 1}):
			continue
		doc = frappe.get_doc(
			{
				"doctype": "Salary Structure Assignment",
				"employee": emp,
				"salary_structure": structure,
				"company": company,
				"currency": currency,
				"from_date": f"{getdate().year}-01-01",
				"base": 6000 + i * 750,
				"payroll_payable_account": payable,
			}
		)
		doc.insert(ignore_permissions=True)
		doc.submit()


def _expense_setup(company):
	payable = frappe.db.get_value(
		"Account", {"company": company, "account_type": "Payable", "is_group": 0}, "name"
	)
	if payable and not frappe.db.get_value("Company", company, "default_expense_claim_payable_account"):
		frappe.db.set_value("Company", company, "default_expense_claim_payable_account", payable)

	name = "Demo Travel"
	if frappe.db.exists("Expense Claim Type", name):
		return
	expense_account = frappe.db.get_value(
		"Account", {"company": company, "root_type": "Expense", "is_group": 0}, "name"
	)
	frappe.get_doc(
		{
			"doctype": "Expense Claim Type",
			"expense_type": name,
			"accounts": [{"company": company, "default_account": expense_account}] if expense_account else [],
		}
	).insert(ignore_permissions=True)


def _previous_month_slips(company, employees):
	"""Submitted slips for last month, so payroll review has something to compare with."""
	from frappe.utils import get_first_day, get_last_day

	start = get_first_day(add_months(nowdate(), -1))
	end = get_last_day(start)
	for emp in employees:
		# Any slip for that month (a draft from a payroll run included) means there's nothing to add.
		if frappe.db.exists("Salary Slip", {"employee": emp, "start_date": start, "docstatus": ("<", 2)}):
			continue
		slip = frappe.get_doc(
			{
				"doctype": "Salary Slip",
				"employee": emp,
				"company": company,
				"posting_date": end,
				"start_date": start,
				"end_date": end,
				"payroll_frequency": "Monthly",
			}
		)
		slip.insert(ignore_permissions=True)
		slip.submit()


def _bonus(company, employee, today):
	"""A one-off bonus this month, applied to any draft slip already made."""
	from frappe.utils import get_first_day

	component = _component("Demo Bonus", "DBON", "Earning")
	payroll_date = get_first_day(today)
	if not frappe.db.exists(
		"Additional Salary",
		{"employee": employee, "salary_component": component, "payroll_date": payroll_date, "docstatus": 1},
	):
		doc = frappe.get_doc(
			{
				"doctype": "Additional Salary",
				"employee": employee,
				"company": company,
				"salary_component": component,
				"amount": 1200,
				"payroll_date": payroll_date,
				"overwrite_salary_structure_amount": 1,
			}
		)
		doc.insert(ignore_permissions=True)
		doc.submit()
	for name in frappe.get_all(
		"Salary Slip",
		filters={"employee": employee, "start_date": payroll_date, "docstatus": 0},
		pluck="name",
	):
		frappe.get_doc("Salary Slip", name).save(ignore_permissions=True)


def _draft_slip_employee(employees, today):
	"""Someone whose slip this month is still a draft (a bonus can still change it)."""
	from frappe.utils import get_first_day

	return frappe.db.get_value(
		"Salary Slip",
		{"employee": ("in", employees), "start_date": get_first_day(today), "docstatus": 0},
		"employee",
	)


def _insert(doc: dict, submit: bool = False) -> str:
	d = frappe.get_doc(doc)
	d.insert(ignore_permissions=True)
	if submit:
		d.submit()
	return d.name


def _performance(company, lead, team, today):
	"""An appraisal cycle with a template, two appraisals and a goal."""
	for kra in ("Design quality", "Delivery"):
		if not frappe.db.exists("KRA", kra):
			_insert({"doctype": "KRA", "title": kra})
	for criteria in ("Collaboration", "Ownership"):
		if not frappe.db.exists("Employee Feedback Criteria", criteria):
			_insert({"doctype": "Employee Feedback Criteria", "criteria": criteria})
	template = "briskrew Demo Designer"
	if not frappe.db.exists("Appraisal Template", template):
		_insert(
			{
				"doctype": "Appraisal Template",
				"template_title": template,
				"goals": [
					{"key_result_area": "Design quality", "per_weightage": 60},
					{"key_result_area": "Delivery", "per_weightage": 40},
				],
				"rating_criteria": [
					{"criteria": "Collaboration", "per_weightage": 50},
					{"criteria": "Ownership", "per_weightage": 50},
				],
			}
		)
	cycle = f"briskrew Demo {today.year}"
	if not frappe.db.exists("Appraisal Cycle", cycle):
		_insert(
			{
				"doctype": "Appraisal Cycle",
				"cycle_name": cycle,
				"company": company,
				"start_date": f"{today.year}-01-01",
				"end_date": f"{today.year}-12-31",
				"status": "In Progress",
			}
		)
	for emp in team[:2]:
		if not frappe.db.exists("Appraisal", {"employee": emp, "appraisal_cycle": cycle}):
			_insert(
				{
					"doctype": "Appraisal",
					"employee": emp,
					"company": company,
					"appraisal_cycle": cycle,
					"appraisal_template": template,
				}
			)
	if not frappe.db.exists("Goal", {"employee": team[0], "goal_name": "Ship the new onboarding flow"}):
		_insert(
			{
				"doctype": "Goal",
				"employee": team[0],
				"goal_name": "Ship the new onboarding flow",
				"kra": "Delivery",
				"appraisal_cycle": cycle,
				"start_date": f"{today.year}-01-01",
				"progress": 40,
			}
		)


def _hiring(company, lead_user, today):
	"""An open role with two applicants, an interview and a draft offer."""
	designation = "Product Designer"
	if not frappe.db.exists("Designation", designation):
		_insert({"doctype": "Designation", "designation_name": designation})
	opening = frappe.db.get_value("Job Opening", {"job_title": "Product Designer (demo)"})
	if not opening:
		opening = _insert(
			{
				"doctype": "Job Opening",
				"job_title": "Product Designer (demo)",
				"designation": designation,
				"company": company,
				"status": "Open",
				"description": "Design calm, fast tools for our HR team.",
			}
		)
	applicants = []
	for name, email in (("Aarav Shah", "aarav@applicant.demo"), ("Lina Morales", "lina@applicant.demo")):
		existing = frappe.db.get_value("Job Applicant", {"email_id": email})
		applicants.append(
			existing
			or _insert(
				{
					"doctype": "Job Applicant",
					"applicant_name": name,
					"email_id": email,
					"job_title": opening,
					"status": "Open",
				}
			)
		)
	if not frappe.db.exists("Skill", "Visual design"):
		_insert({"doctype": "Skill", "skill_name": "Visual design"})
	interview_type = "Portfolio review"
	if not frappe.db.exists("Interview Type", interview_type):
		_insert(
			{
				"doctype": "Interview Type",
				"interview_type_name": interview_type,
				"expected_skill_set": [{"skill": "Visual design"}],
			}
		)
	if not frappe.db.exists("Interview", {"job_applicant": applicants[0]}):
		_insert(
			{
				"doctype": "Interview",
				"job_applicant": applicants[0],
				"interview_type": interview_type,
				"status": "Pending",
				"scheduled_on": add_days(today, 3),
				"from_time": "11:00:00",
				"to_time": "12:00:00",
				"interview_details": [{"interviewer": lead_user}],
			}
		)
	if not frappe.db.exists("Job Offer", {"job_applicant": applicants[1]}):
		_insert(
			{
				"doctype": "Job Offer",
				"job_applicant": applicants[1],
				"applicant_name": "Lina Morales",
				"offer_date": today,
				"designation": designation,
				"company": company,
				"status": "Awaiting Response",
			}
		)


def _shifts(company, team, today):
	"""A day shift at the head office, assigned to one person."""
	shift_type = "briskrew Demo Day"
	if not frappe.db.exists("Shift Type", shift_type):
		_insert(
			{
				"doctype": "Shift Type",
				"__newname": shift_type,
				"name": shift_type,
				"start_time": "09:00:00",
				"end_time": "18:00:00",
			}
		)
	if not frappe.db.exists("Shift Location", "Head office"):
		_insert({"doctype": "Shift Location", "location_name": "Head office"})
	if not frappe.db.exists(
		"Shift Assignment", {"employee": team[2], "shift_type": shift_type, "docstatus": 1}
	):
		_insert(
			{
				"doctype": "Shift Assignment",
				"employee": team[2],
				"company": company,
				"shift_type": shift_type,
				"shift_location": "Head office",
				"start_date": today,
				"status": "Active",
			},
			submit=True,
		)
