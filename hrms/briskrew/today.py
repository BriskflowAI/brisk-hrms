"""Data for the briskrew Today (home) screen."""

import frappe
from frappe.utils import add_days, flt, get_first_day, get_last_day, getdate, nowdate

from hrms.briskrew.inbox import get_inbox
from hrms.briskrew.people import _next_yearly


@frappe.whitelist()
def get_today() -> dict:
	today = getdate(nowdate())
	week_start = add_days(today, -today.weekday())
	week_end = add_days(week_start, 6)

	# Each part shows only what this user may read; the rest is left out, not an error.
	can_see_people = bool(frappe.has_permission("Employee", "read"))
	employees = (
		frappe.get_list(
			"Employee",
			filters={"status": "Active"},
			fields=[
				"name",
				"employee_name",
				"department",
				"date_of_joining",
				"date_of_birth",
				"final_confirmation_date",
				"relieving_date",
			],
			limit=1000,
		)
		if can_see_people
		else []
	)
	names = [e.name for e in employees]

	return {
		"today": today,
		"week": {"start": week_start, "end": week_end},
		"away": _away(names, week_start, week_end),
		"holidays": _holidays(week_start, week_end),
		"moments": _moments(employees, week_start, week_end),
		"inbox": get_inbox(),
		"payroll": _payroll(today),
		"headcount": _headcount(employees) if can_see_people else None,
		"joining_soon": len(
			frappe.get_list("Employee", filters={"date_of_joining": (">", today)}, pluck="name", limit=200)
		)
		if can_see_people
		else 0,
	}


def _away(names, start, end):
	if not names:
		return []
	return frappe.get_list(
		"Leave Application",
		filters={
			"employee": ("in", names),
			"docstatus": ("<", 2),
			"status": ("in", ["Open", "Approved"]),
			"from_date": ("<=", end),
			"to_date": (">=", start),
		},
		fields=[
			"name",
			"employee",
			"employee_name",
			"department",
			"leave_type",
			"from_date",
			"to_date",
			"status",
			"half_day",
		],
		order_by="from_date asc",
		limit=60,
	)


def _holidays(start, end):
	"""Holidays in the week from the user's own holiday list, else the company default."""
	from erpnext.setup.doctype.employee.employee import get_holiday_list_for_employee

	holiday_list = None
	employee = frappe.db.get_value("Employee", {"user_id": frappe.session.user}, "name")
	if employee:
		holiday_list = get_holiday_list_for_employee(employee, raise_exception=False)
	if not holiday_list:
		company = frappe.defaults.get_user_default("Company") or frappe.db.get_single_value(
			"Global Defaults", "default_company"
		)
		if company:
			holiday_list = frappe.get_cached_value("Company", company, "default_holiday_list")
	if not holiday_list:
		return []
	return frappe.get_all(
		"Holiday",
		filters={"parent": holiday_list, "holiday_date": ("between", [start, end])},
		fields=["holiday_date", "description", "weekly_off"],
		order_by="holiday_date asc",
	)


def _moments(employees, start, end):
	out = []
	for e in employees:
		if e.date_of_birth:
			d = _next_yearly(getdate(e.date_of_birth), start)
			if d <= end:
				out.append(
					{
						"kind": "birthday",
						"date": d,
						"employee": e.name,
						"employee_name": e.employee_name,
						"label": "Birthday",
					}
				)
		if e.date_of_joining:
			doj = getdate(e.date_of_joining)
			if start <= doj <= end:
				out.append(
					{
						"kind": "joining",
						"date": doj,
						"employee": e.name,
						"employee_name": e.employee_name,
						"label": "Joins",
					}
				)
			elif doj < start:
				d = _next_yearly(doj, start)
				years = d.year - doj.year
				if d <= end and years:
					out.append(
						{
							"kind": "anniversary",
							"date": d,
							"employee": e.name,
							"employee_name": e.employee_name,
							"label": f"{years} year{'s' if years > 1 else ''}",
						}
					)
		if e.final_confirmation_date and start <= getdate(e.final_confirmation_date) <= end:
			out.append(
				{
					"kind": "probation",
					"date": getdate(e.final_confirmation_date),
					"employee": e.name,
					"employee_name": e.employee_name,
					"label": "Probation ends",
				}
			)
		if e.relieving_date and start <= getdate(e.relieving_date) <= end:
			out.append(
				{
					"kind": "leaving",
					"date": getdate(e.relieving_date),
					"employee": e.name,
					"employee_name": e.employee_name,
					"label": "Last day",
				}
			)
	return sorted(out, key=lambda m: m["date"])


def _payroll(today):
	if not frappe.has_permission("Payroll Entry", "read"):
		return None
	start, end = get_first_day(today), get_last_day(today)
	entry = frappe.get_list(
		"Payroll Entry",
		filters={"start_date": (">=", start), "end_date": ("<=", end), "docstatus": ("<", 2)},
		fields=[
			"name",
			"docstatus",
			"status",
			"salary_slips_created",
			"salary_slips_submitted",
			"posting_date",
			"company",
			"currency",
		],
		order_by="creation desc",
		limit=1,
	)
	entry = entry[0] if entry else None
	totals = {"gross": 0, "deductions": 0, "net": 0, "slips": 0}
	if entry and frappe.has_permission("Salary Slip", "read"):
		for s in frappe.get_list(
			"Salary Slip",
			filters={"payroll_entry": entry.name, "docstatus": ("<", 2)},
			fields=["gross_pay", "total_deduction", "net_pay"],
			limit=5000,
		):
			totals["gross"] += flt(s.gross_pay)
			totals["deductions"] += flt(s.total_deduction)
			totals["net"] += flt(s.net_pay)
			totals["slips"] += 1
	if entry:
		if entry.salary_slips_submitted:
			stage = "Slips submitted"
		elif entry.salary_slips_created:
			stage = "Slips created"
		elif entry.docstatus == 1:
			stage = "Submitted"
		else:
			stage = "Draft"
	else:
		stage = "Not started"
	return {"entry": entry, "totals": totals, "stage": stage, "month": start, "pay_date": end}


def _headcount(employees):
	counts = {}
	for e in employees:
		counts[e.department or "No department"] = counts.get(e.department or "No department", 0) + 1
	return sorted(({"department": k, "count": v} for k, v in counts.items()), key=lambda x: -x["count"])
