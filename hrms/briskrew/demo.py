"""Sample team and requests for trying briskrew on a test site.

Run on a test site only (never production):
    bench --site <site> execute hrms.briskrew.demo.seed --kwargs "{'company': '<Company>'}"

Creates a team lead with five reports, leave allocations, and a mix of pending
requests (leave, shift, attendance) so the Inbox has something to decide.
Safe to re-run: existing demo records are reused. Log in as the lead with
lead@briskrew.demo / the password printed at the end.
"""

import frappe
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


def seed(company: str | None = None) -> dict:
	if not frappe.conf.developer_mode and not frappe.flags.in_test:
		frappe.throw("Demo data is for test sites only. Enable developer_mode on the site first.")

	company = company or frappe.db.get_value("Company", {}, "name")
	if not company:
		frappe.throw("Create a company first (finish the setup wizard).")

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
	]
	shift = _shift_request(team[4], lead_user, add_days(next_monday, 7))
	if shift:
		requests.append(shift)

	frappe.db.commit()
	return {
		"login": lead_user,
		"password": DEMO_PASSWORD,
		"team": [e for e in team],
		"requests": [r for r in requests if r],
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


def _shift_request(employee, approver, from_date):
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
