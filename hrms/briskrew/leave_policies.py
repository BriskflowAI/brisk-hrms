"""Leave policy builder: leave types, the policies that bundle them, and who each policy applies to,
on one screen. Everything is stored in Frappe HR's own Leave Type, Leave Policy and
Leave Policy Assignment records, so the classic screens and reports keep working."""

import json

import frappe
from frappe import _
from frappe.utils import nowdate, strip_html

# Every setting on a leave type, in the groups the builder shows them in.
LEAVE_TYPE_GROUPS = [
	(
		"Taking leave",
		[
			"max_leaves_allowed",
			"applicable_after",
			"max_continuous_days_allowed",
			"include_holiday",
			"allow_negative",
			"allow_over_allocation",
			"is_optional_leave",
			"is_compensatory",
		],
	),
	("Pay", ["is_lwp", "is_ppl", "fraction_of_daily_salary_per_leave"]),
	(
		"Carry forward",
		["is_carry_forward", "maximum_carry_forwarded_leaves", "expire_carry_forwarded_leaves_after_days"],
	),
	("Earned leave", ["is_earned_leave", "earned_leave_frequency", "allocate_on_day", "rounding"]),
	(
		"Encashment",
		["allow_encashment", "earning_component", "max_encashable_leaves", "non_encashable_leaves"],
	),
]
LEAVE_TYPE_FIELDS = ["leave_type_name"] + [f for _label, fields in LEAVE_TYPE_GROUPS for f in fields]
EMPLOYEE_FILTERS = ("company", "department", "designation", "branch", "grade", "employment_type")


@frappe.whitelist()
def get_overview() -> dict:
	frappe.has_permission("Leave Policy", "read", throw=True)
	meta = frappe.get_meta("Leave Type")

	def describe(fieldname):
		df = meta.get_field(fieldname)
		return {
			"fieldname": df.fieldname,
			"label": _(df.label),
			"fieldtype": df.fieldtype,
			"options": df.options,
			"description": _(df.description) if df.description else "",
			"depends_on": df.depends_on,
			"default": df.default,
		}

	policies = frappe.get_list(
		"Leave Policy",
		fields=["name", "title", "docstatus", "modified"],
		filters={"docstatus": ("<", 2)},
		order_by="docstatus asc, modified desc",
		limit=500,
	)
	rows = frappe.get_all(
		"Leave Policy Detail",
		filters={"parenttype": "Leave Policy", "parent": ("in", [p.name for p in policies] or [""])},
		fields=["parent", "leave_type", "annual_allocation", "idx"],
		order_by="idx asc",
	)
	assigned = dict(
		frappe.get_all(
			"Leave Policy Assignment",
			filters={"docstatus": 1, "effective_to": (">=", nowdate())},
			fields=["leave_policy", {"COUNT": "*", "as": "count"}],
			group_by="leave_policy",
			as_list=True,
		)
	)
	for p in policies:
		p.rows = [r for r in rows if r.parent == p.name]
		p.assigned = assigned.get(p.name, 0)

	return {
		"policies": policies,
		"leave_types": frappe.get_list(
			"Leave Type", fields=["name", *LEAVE_TYPE_FIELDS], order_by="name asc", limit=500
		),
		"groups": [
			{"label": _(label), "fields": [describe(f) for f in fields]}
			for label, fields in LEAVE_TYPE_GROUPS
		],
		"leave_periods": frappe.get_list(
			"Leave Period",
			fields=["name", "from_date", "to_date", "company", "is_active"],
			order_by="from_date desc",
			limit=50,
		),
		"can": {
			"write_policy": frappe.has_permission("Leave Policy", "create"),
			"submit_policy": frappe.has_permission("Leave Policy", "submit"),
			"write_leave_type": frappe.has_permission("Leave Type", "write"),
			"create_leave_type": frappe.has_permission("Leave Type", "create"),
			"assign": frappe.has_permission("Leave Policy Assignment", "submit"),
		},
	}


@frappe.whitelist()
def save_leave_type(values: str | dict, name: str | None = None) -> dict:
	"""Create a leave type, or change one. Only leave type settings are touched."""
	values = _parse(values)
	doc = frappe.get_doc("Leave Type", name) if name else frappe.new_doc("Leave Type")
	doc.update(
		{k: v for k, v in values.items() if k in LEAVE_TYPE_FIELDS and (k != "leave_type_name" or not name)}
	)
	doc.save()
	return {k: doc.get(k) for k in ["name", *LEAVE_TYPE_FIELDS]}


@frappe.whitelist()
def save_policy(title: str, rows: str | list, name: str | None = None, submit: bool | int = False) -> dict:
	"""Save a draft policy (new or existing) and optionally submit it, which makes it assignable."""
	rows = _parse(rows)
	doc = frappe.get_doc("Leave Policy", name) if name else frappe.new_doc("Leave Policy")
	if doc.docstatus != 0:
		frappe.throw(
			_("Policy {0} is already in use and can't be changed. Make a copy instead.").format(doc.name)
		)
	doc.title = title
	doc.set("leave_policy_details", [])
	for r in rows:
		if r.get("leave_type"):
			doc.append(
				"leave_policy_details",
				{"leave_type": r["leave_type"], "annual_allocation": r.get("annual_allocation") or 0},
			)
	doc.save()
	if frappe.utils.cint(submit):
		doc.submit()
	return {"name": doc.name, "docstatus": doc.docstatus}


@frappe.whitelist()
def get_candidates(filters: str | dict | None = None) -> list[dict]:
	"""Active employees matching the filters, with the leave policy they're on now, if any."""
	frappe.has_permission("Leave Policy Assignment", "read", throw=True)
	filters = _parse(filters or {})
	conditions = {"status": "Active"}
	for key in EMPLOYEE_FILTERS:
		if filters.get(key):
			conditions[key] = filters[key]

	employees = frappe.get_list(
		"Employee",
		filters=conditions,
		fields=["name", "employee_name", "department", "designation", "company", "date_of_joining", "image"],
		order_by="employee_name asc",
		limit=1000,
	)
	current = {}
	for a in frappe.get_all(
		"Leave Policy Assignment",
		filters={
			"docstatus": 1,
			"employee": ("in", [e.name for e in employees] or [""]),
			"effective_to": (">=", nowdate()),
		},
		fields=["name", "employee", "leave_policy", "effective_from", "effective_to"],
		order_by="effective_from asc",
	):
		current.setdefault(a.employee, a)
	for e in employees:
		e.current = current.get(e.name)
	return employees


@frappe.whitelist()
def assign(policy: str, employees: str | list, data: str | dict) -> dict:
	"""Give a submitted policy to several employees. Each one succeeds or fails on its own,
	and the reason for a failure comes back with it."""
	from hrms.hr.doctype.leave_policy_assignment.leave_policy_assignment import create_assignment

	frappe.has_permission("Leave Policy Assignment", "submit", throw=True)
	employees, data = _parse(employees), frappe._dict(_parse(data))
	if frappe.db.get_value("Leave Policy", policy, "docstatus") != 1:
		frappe.throw(_("Submit the policy before assigning it."))
	data.leave_policy = policy
	if data.assignment_based_on != "Leave Period":
		data.leave_period = None

	created, failed = [], []
	for employee in employees:
		frappe.db.savepoint("briskrew_assign")
		try:
			doc = create_assignment(employee, data)
			doc.submit()
			created.append({"employee": employee, "name": doc.name})
		except Exception as e:
			frappe.db.rollback(save_point="briskrew_assign")
			failed.append(
				{
					"employee": employee,
					"employee_name": frappe.db.get_value("Employee", employee, "employee_name"),
					"error": _message(e),
				}
			)
		frappe.clear_messages()
	return {"created": created, "failed": failed}


def _message(e):
	text = strip_html(str(e) or "").strip()
	if not text and frappe.message_log:
		last = frappe.message_log[-1]
		text = strip_html(last.get("message", "") if isinstance(last, dict) else str(last))
	return text or _("Couldn't assign the policy.")


def _parse(value):
	return json.loads(value) if isinstance(value, str) else value
