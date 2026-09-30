"""Data for the briskrew People screen: directory with today's status, and a profile peek."""

import frappe
from frappe.utils import add_days, date_diff, getdate, nowdate

VIEWS = ("everyone", "away", "joining", "probation", "leaving")


@frappe.whitelist()
def get_directory(view: str = "everyone", search: str | None = None, department: str | None = None) -> dict:
	"""Employees visible to the user, with what's going on for each of them today."""
	if view not in VIEWS:
		view = "everyone"
	today = getdate(nowdate())

	filters = {"status": ("in", ["Active", "Suspended"])}
	if view == "joining":
		filters = {"date_of_joining": (">", today)}
	elif view == "probation":
		filters["final_confirmation_date"] = (">=", today)
	elif view == "leaving":
		filters = {"relieving_date": (">=", today), "status": ("!=", "Left")}
	if department:
		filters["department"] = department

	or_filters = None
	if search:
		like = f"%{search}%"
		or_filters = {"employee_name": ("like", like), "name": ("like", like), "designation": ("like", like)}

	employees = frappe.get_list(
		"Employee",
		filters=filters,
		or_filters=or_filters,
		fields=[
			"name",
			"employee_name",
			"designation",
			"department",
			"branch",
			"reports_to",
			"image",
			"date_of_joining",
			"date_of_birth",
			"final_confirmation_date",
			"relieving_date",
			"status",
			"user_id",
		],
		order_by="department asc, employee_name asc",
		limit=500,
	)
	names = [e.name for e in employees]
	managers = {
		m.name: m.employee_name
		for m in frappe.get_all(
			"Employee",
			filters={"name": ("in", list({e.reports_to for e in employees if e.reports_to}))},
			fields=["name", "employee_name"],
		)
	}
	status = _today_status(names, today)

	rows = []
	for e in employees:
		s = status.get(e.name)
		if view == "away" and not s:
			continue
		e.manager_name = managers.get(e.reports_to)
		e.today = s
		e.next = _next_event(e, today)
		e.tenure_days = date_diff(today, e.date_of_joining) if e.date_of_joining else None
		rows.append(e)

	counts = {}
	for r in rows:
		counts[r.department or ""] = counts.get(r.department or "", 0) + 1
	return {"employees": rows, "departments": counts, "today": today}


def _today_status(names: list[str], today) -> dict:
	"""Leave, attendance and remote-work status for today, keyed by employee."""
	if not names:
		return {}
	out = {}
	for lv in frappe.get_all(
		"Leave Application",
		filters={
			"employee": ("in", names),
			"from_date": ("<=", today),
			"to_date": (">=", today),
			"docstatus": ("<", 2),
			"status": ("in", ["Open", "Approved"]),
		},
		fields=["employee", "leave_type", "to_date", "status", "half_day"],
	):
		out[lv.employee] = {
			"kind": "half" if lv.half_day else "away",
			"label": lv.leave_type,
			"until": lv.to_date,
			"pending": lv.status == "Open",
		}
	for att in frappe.get_all(
		"Attendance",
		filters={"employee": ("in", names), "attendance_date": today, "docstatus": 1},
		fields=["employee", "status"],
	):
		if att.employee in out:
			continue
		if att.status == "Work From Home":
			out[att.employee] = {"kind": "remote", "label": "Working from home"}
		elif att.status in ("Absent", "On Leave"):
			out[att.employee] = {"kind": "away", "label": att.status}
	return out


def _next_event(e, today) -> dict | None:
	"""The nearest upcoming thing worth knowing about someone, within 30 days."""
	events = []
	if e.final_confirmation_date and getdate(e.final_confirmation_date) >= today:
		events.append(("probation", getdate(e.final_confirmation_date), "Probation ends"))
	if e.relieving_date and getdate(e.relieving_date) >= today:
		events.append(("leaving", getdate(e.relieving_date), "Last day"))
	if e.date_of_joining:
		doj = getdate(e.date_of_joining)
		if doj > today:
			events.append(("joining", doj, "Joins"))
		else:
			anniv = _next_yearly(doj, today)
			years = anniv.year - doj.year
			if years:
				events.append(("anniversary", anniv, f"{years} year{'s' if years > 1 else ''} here"))
	if e.date_of_birth:
		events.append(("birthday", _next_yearly(getdate(e.date_of_birth), today), "Birthday"))
	events = [ev for ev in events if date_diff(ev[1], today) <= 30]
	if not events:
		return None
	kind, when, label = min(events, key=lambda ev: ev[1])
	return {"kind": kind, "date": when, "label": label, "in_days": date_diff(when, today)}


def _next_yearly(d, today):
	for year in (today.year, today.year + 1):
		try:
			candidate = d.replace(year=year)
		except ValueError:  # 29 Feb
			candidate = d.replace(year=year, day=28)
		if candidate >= today:
			return candidate
	return add_days(today, 400)


@frappe.whitelist()
def get_profile(employee: str) -> dict:
	"""Everything the profile peek shows about one person."""
	frappe.has_permission("Employee", "read", employee, throw=True)
	emp = frappe.get_doc("Employee", employee)
	today = getdate(nowdate())

	balances = []
	try:
		from hrms.hr.doctype.leave_application.leave_application import get_leave_details

		details = get_leave_details(employee, today)
		for leave_type, d in (details.get("leave_allocation") or {}).items():
			balances.append(
				{
					"leave_type": leave_type,
					"total": d.get("total_leaves"),
					"remaining": d.get("remaining_leaves"),
					"pending": d.get("leaves_pending_approval"),
				}
			)
	except frappe.PermissionError:
		balances = []

	manager = (
		frappe.db.get_value("Employee", emp.reports_to, ["name", "employee_name"], as_dict=True)
		if emp.reports_to
		else None
	)
	reports = frappe.get_all(
		"Employee",
		filters={"reports_to": employee, "status": "Active"},
		fields=["name", "employee_name", "designation"],
		limit=20,
	)
	structure = None
	if frappe.has_permission("Salary Structure Assignment", "read"):
		structure = frappe.db.get_value(
			"Salary Structure Assignment",
			{"employee": employee, "docstatus": 1, "from_date": ("<=", today)},
			["salary_structure", "from_date"],
			order_by="from_date desc",
			as_dict=True,
		)

	return {
		"employee": {
			k: emp.get(k)
			for k in (
				"name",
				"employee_name",
				"designation",
				"department",
				"branch",
				"company",
				"status",
				"image",
				"date_of_joining",
				"final_confirmation_date",
				"relieving_date",
				"company_email",
				"personal_email",
				"cell_number",
				"employment_type",
				"grade",
				"holiday_list",
				"default_shift",
				"leave_approver",
				"expense_approver",
				"user_id",
			)
		},
		"today": _today_status([employee], today).get(employee),
		"manager": manager,
		"reports": reports,
		"balances": balances,
		"salary_structure": structure,
	}
