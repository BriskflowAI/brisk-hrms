"""Payroll review: a payroll run compared with the previous period, employee by employee."""

import frappe
from frappe import _
from frappe.utils import flt, getdate


@frappe.whitelist()
def get_run_review(payroll_entry: str) -> dict:
	entry = frappe.get_doc("Payroll Entry", payroll_entry)
	entry.check_permission("read")
	frappe.has_permission("Salary Slip", "read", throw=True)

	slips = _slips({"payroll_entry": entry.name, "docstatus": ("<", 2)})
	current = {s.employee: s for s in slips}

	# The latest submitted slip before this period, per employee.
	employees = list({*current.keys(), *(e.employee for e in entry.employees)})
	previous = {}
	if employees:
		for s in _slips(
			{"employee": ("in", employees), "docstatus": 1, "end_date": ("<", getdate(entry.start_date))},
			order_by="end_date desc",
		):
			previous.setdefault(s.employee, s)

	people = []
	for emp in sorted(
		employees,
		key=lambda e: (current.get(e) or previous.get(e) or frappe._dict(employee_name=e)).employee_name or e,
	):
		cur, prev = current.get(emp), previous.get(emp)
		lines = _diff_lines(prev, cur)
		change = flt(cur.net_pay if cur else 0) - flt(prev.net_pay if prev else 0)
		people.append(
			{
				"employee": emp,
				"employee_name": (cur or prev or {}).get("employee_name") or emp,
				"department": (cur or prev or {}).get("department"),
				"slip": cur.name if cur else None,
				"slip_status": cur.docstatus if cur else None,
				"previous_slip": prev.name if prev else None,
				"previous_period": f"{prev.start_date} – {prev.end_date}" if prev else None,
				"net": flt(cur.net_pay) if cur else None,
				"previous_net": flt(prev.net_pay) if prev else None,
				"change": change,
				"change_pct": (change / flt(prev.net_pay) * 100) if prev and flt(prev.net_pay) else None,
				"lines": lines,
				"changed": any(line["kind"] != "same" for line in lines) or not prev or not cur,
				"new": bool(cur and not prev),
				"missing_slip": not cur,
				"leave_without_pay": flt(cur.leave_without_pay) if cur else 0,
				"payment_days": flt(cur.payment_days) if cur else None,
				"total_working_days": flt(cur.total_working_days) if cur else None,
			}
		)

	totals = {
		"gross": sum(flt(s.gross_pay) for s in slips),
		"deductions": sum(flt(s.total_deduction) for s in slips),
		"net": sum(flt(s.net_pay) for s in slips),
		"previous_net": sum(
			flt(p["previous_net"]) for p in people if p["previous_net"] is not None and p["slip"]
		),
		"slips": len(slips),
		"submitted": sum(1 for s in slips if s.docstatus == 1),
	}
	return {
		"entry": {
			k: entry.get(k)
			for k in (
				"name",
				"company",
				"currency",
				"start_date",
				"end_date",
				"posting_date",
				"docstatus",
				"status",
				"payroll_frequency",
				"salary_slips_created",
				"salary_slips_submitted",
			)
		},
		"people": people,
		"totals": totals,
		"checks": _checks(entry, people),
	}


def _slips(filters, order_by="employee_name asc"):
	slips = frappe.get_list(
		"Salary Slip",
		filters=filters,
		fields=[
			"name",
			"employee",
			"employee_name",
			"department",
			"start_date",
			"end_date",
			"gross_pay",
			"total_deduction",
			"net_pay",
			"leave_without_pay",
			"payment_days",
			"total_working_days",
			"docstatus",
		],
		order_by=order_by,
		limit=10000,
	)
	if not slips:
		return slips
	details = frappe.get_all(
		"Salary Detail",
		filters={"parent": ("in", [s.name for s in slips]), "parenttype": "Salary Slip"},
		fields=["parent", "parentfield", "salary_component", "amount", "idx"],
		order_by="idx asc",
	)
	by_slip = {}
	for d in details:
		by_slip.setdefault(d.parent, []).append(d)
	for s in slips:
		s.components = by_slip.get(s.name, [])
	return slips


def _diff_lines(prev, cur):
	"""Component lines, earnings then deductions, marked added / removed / changed / same."""

	def index(slip):
		out = {}
		for d in slip.components if slip else []:
			key = (d.parentfield, d.salary_component)
			out[key] = out.get(key, 0) + flt(d.amount)
		return out

	a, b = index(prev), index(cur)
	lines = []
	for key in sorted({*a, *b}, key=lambda k: (k[0] != "earnings", k[1])):
		before, after = a.get(key), b.get(key)
		if before is None:
			kind = "added"
		elif after is None:
			kind = "removed"
		elif abs(flt(after) - flt(before)) > 0.005:
			kind = "changed"
		else:
			kind = "same"
		lines.append({"section": key[0], "component": key[1], "before": before, "after": after, "kind": kind})
	return lines


def _checks(entry, people):
	checks = []
	missing = [p for p in people if p["missing_slip"]]
	if entry.salary_slips_created and missing:
		checks.append(
			{
				"ok": False,
				"label": _("{0} employee(s) in the run have no salary slip").format(len(missing)),
				"employees": [p["employee_name"] for p in missing],
			}
		)
	lwp = [p for p in people if p["leave_without_pay"]]
	if lwp:
		checks.append(
			{
				"ok": False,
				"warning": True,
				"label": _("{0} employee(s) have unpaid leave deducted").format(len(lwp)),
				"employees": [f"{p['employee_name']} ({p['leave_without_pay']:g} days)" for p in lwp],
			}
		)
	big = [p for p in people if p["change_pct"] is not None and abs(p["change_pct"]) >= 20]
	if big:
		checks.append(
			{
				"ok": False,
				"warning": True,
				"label": _("{0} net pay change(s) of 20% or more").format(len(big)),
				"employees": [f"{p['employee_name']} ({p['change_pct']:+.0f}%)" for p in big],
			}
		)
	# Active employees of the company not in this run (usually: no salary structure assigned).
	in_run = {p["employee"] for p in people}
	absent = frappe.get_all(
		"Employee",
		filters={
			"company": entry.company,
			"status": "Active",
			"date_of_joining": ("<=", entry.end_date),
			"name": ("not in", list(in_run) or [""]),
		},
		fields=["name", "employee_name"],
		limit=50,
	)
	if absent:
		no_structure = [
			e.employee_name
			for e in absent
			if not frappe.db.exists(
				"Salary Structure Assignment",
				{"employee": e.name, "docstatus": 1, "from_date": ("<=", entry.end_date)},
			)
		]
		if no_structure:
			checks.append(
				{
					"ok": False,
					"label": _("{0} active employee(s) have no salary structure, so they're not paid").format(
						len(no_structure)
					),
					"employees": no_structure,
				}
			)
	if entry.salary_slips_created and not missing:
		checks.append({"ok": True, "label": _("Every employee in the run has a slip")})
	return checks
