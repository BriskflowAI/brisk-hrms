"""Server side of the briskrew Inbox.

One place for a manager or HR user to see and decide every request waiting on
them. Nothing here re-implements approval rules: decisions go through the
documents' own submit / workflow code, so validations, balances, notifications
and custom approval workflows behave exactly as in the classic desk.
"""

import frappe
from frappe import _
from frappe.model.workflow import apply_workflow, get_transitions, get_workflow_name
from frappe.utils import add_days, cint, date_diff, flt, getdate

from erpnext.setup.doctype.employee.employee import get_holiday_list_for_employee

from hrms.api import get_allowed_states_for_workflow, get_workflow

MAX_ITEMS_PER_TYPE = 200

# How each request type is decided when it has no custom workflow.
# status_field / pending: the value that means "waiting for a decision".
# approver_field: the field naming who decides; None means anyone allowed to submit.
REQUEST_TYPES = {
	"Leave Application": {
		"label": "Leave",
		"approver_field": "leave_approver",
		"status_field": "status",
		"pending": "Open",
		"fields": ["leave_type", "from_date", "to_date", "half_day", "total_leave_days", "description"],
	},
	"Expense Claim": {
		"label": "Expense",
		"approver_field": "expense_approver",
		"status_field": "approval_status",
		"pending": "Draft",
		"fields": ["total_claimed_amount", "currency", "remark"],
	},
	"Shift Request": {
		"label": "Shift",
		"approver_field": "approver",
		"status_field": "status",
		"pending": "Draft",
		"fields": ["shift_type", "from_date", "to_date"],
	},
	"Attendance Request": {
		"label": "Attendance",
		"approver_field": None,
		"status_field": None,
		"pending": None,
		"fields": ["from_date", "to_date", "reason", "explanation", "half_day"],
	},
	"Compensatory Leave Request": {
		"label": "Comp-off",
		"approver_field": None,
		"status_field": None,
		"pending": None,
		"fields": ["work_from_date", "work_end_date", "leave_type", "reason", "half_day"],
	},
}


def _current_employee(user=None):
	return frappe.db.get_value("Employee", {"user_id": user or frappe.session.user}, "name")


def _config(doctype):
	if doctype not in REQUEST_TYPES:
		frappe.throw(_("{0} is not an Inbox request type").format(doctype))
	return REQUEST_TYPES[doctype]


def _pending_filters(doctype, user):
	"""Filters for requests waiting on `user`, or None if they can't decide any."""
	cfg = REQUEST_TYPES[doctype]
	filters = {"docstatus": 0}

	if workflow := get_workflow(doctype):
		states = get_allowed_states_for_workflow(workflow, user)
		if not states:
			return None
		filters[workflow.workflow_state_field] = ("in", states)
		return filters

	if cfg["status_field"]:
		filters[cfg["status_field"]] = cfg["pending"]
	if cfg["approver_field"]:
		filters[cfg["approver_field"]] = user
	return filters


@frappe.whitelist()
def get_inbox() -> dict:
	"""Everything waiting on the current user, oldest first."""
	user = frappe.session.user
	me = _current_employee(user)
	items = []

	for doctype, cfg in REQUEST_TYPES.items():
		if not frappe.has_permission(doctype, "read"):
			continue
		filters = _pending_filters(doctype, user)
		if filters is None:
			continue
		if me:
			# Nobody decides their own request.
			filters["employee"] = ("!=", me)

		workflow_field = (
			get_workflow(doctype).get("workflow_state_field") if get_workflow_name(doctype) else None
		)
		fields = ["name", "employee", "employee_name", "department", "creation", *cfg["fields"]]
		if workflow_field:
			fields.append(workflow_field)

		rows = frappe.get_list(
			doctype, filters=filters, fields=fields, order_by="creation asc", limit=MAX_ITEMS_PER_TYPE
		)
		for row in rows:
			if not cfg["approver_field"] and not frappe.has_permission(doctype, "submit", doc=row.name):
				continue
			row.update(
				doctype=doctype,
				kind=cfg["label"],
				workflow_state=row.get(workflow_field) if workflow_field else None,
			)
			items.append(row)

	items.sort(key=lambda r: r.creation)
	counts = {}
	for row in items:
		counts[row.kind] = counts.get(row.kind, 0) + 1
	return {"items": items, "counts": counts}


@frappe.whitelist()
def get_context(doctype: str, name: str) -> dict:
	"""What the approver needs to decide one request."""
	cfg = _config(doctype)
	doc = frappe.get_doc(doctype, name)
	doc.check_permission("read")

	employee = frappe.db.get_value(
		"Employee",
		doc.employee,
		["name", "employee_name", "designation", "department", "reports_to", "date_of_joining", "image"],
		as_dict=True,
	)

	context = {
		"doc": doc.as_dict(),
		"kind": cfg["label"],
		"employee": employee,
		"checks": get_checks(doc),
		"actions": _available_actions(doc),
		"history": _history(doc),
	}

	if doctype == "Leave Application":
		context.update(_leave_context(doc))
	elif doctype == "Expense Claim":
		context["expenses"] = [
			{
				k: row.get(k)
				for k in ("expense_type", "expense_date", "description", "amount", "sanctioned_amount")
			}
			for row in doc.expenses
		]
	return context


def _available_actions(doc):
	"""Buttons to show: workflow transitions when a workflow applies, else approve/reject."""
	if get_workflow_name(doc.doctype):
		return [{"action": t.action, "next_state": t.next_state} for t in get_transitions(doc)]

	cfg = REQUEST_TYPES[doc.doctype]
	if not frappe.has_permission(doc.doctype, "submit", doc=doc):
		return []
	actions = [{"action": "Approve"}]
	if cfg["status_field"]:
		actions.append({"action": "Reject"})
	return actions


def _history(doc, limit=5):
	return frappe.get_all(
		doc.doctype,
		filters={"employee": doc.employee, "docstatus": 1, "name": ("!=", doc.name)},
		fields=["name", "creation", *REQUEST_TYPES[doc.doctype]["fields"][:3]],
		order_by="creation desc",
		limit=limit,
	)


def _leave_context(doc):
	from hrms.hr.doctype.leave_application.leave_application import get_leave_balance_on

	balance = get_leave_balance_on(
		doc.employee,
		doc.leave_type,
		doc.from_date,
		doc.to_date,
		consider_all_leaves_in_the_allocation_period=True,
	)
	balance = flt(balance.get("leave_balance") if isinstance(balance, dict) else balance)

	holiday_list = get_holiday_list_for_employee(doc.employee, raise_exception=False)
	holidays = []
	if holiday_list:
		holidays = frappe.get_all(
			"Holiday",
			filters={"parent": holiday_list, "holiday_date": ("between", [doc.from_date, doc.to_date])},
			fields=["holiday_date", "description", "weekly_off"],
			order_by="holiday_date asc",
		)

	return {
		"leave_balance": balance,
		"balance_after": balance - flt(doc.total_leave_days),
		"holidays": holidays,
		"team": _team_overlap(doc),
	}


def _team_overlap(doc):
	"""The employee's team across the requested dates, and who else is off each day."""
	if not doc.department:
		return {"members": [], "days": []}

	start, end = getdate(doc.from_date), getdate(doc.to_date)
	members = frappe.get_all(
		"Employee",
		filters={"department": doc.department, "status": "Active"},
		fields=["name", "employee_name"],
		order_by="employee_name asc",
		limit=50,
	)
	leaves = frappe.get_all(
		"Leave Application",
		filters={
			"department": doc.department,
			"docstatus": ("<", 2),
			"status": ("in", ["Open", "Approved"]),
			"from_date": ("<=", end),
			"to_date": (">=", start),
		},
		fields=["employee", "from_date", "to_date", "status"],
	)
	days = []
	for i in range(min(date_diff(end, start) + 1, 31)):
		day = add_days(start, i)
		away = sorted(
			{lv.employee for lv in leaves if getdate(lv.from_date) <= getdate(day) <= getdate(lv.to_date)}
		)
		days.append({"date": day, "away": away})
	return {"members": members, "days": days}


def get_checks(doc) -> list[dict]:
	"""Plain-language checks shown next to a request. A request is "clear" when all pass."""
	checks = []
	if doc.doctype == "Leave Application":
		ctx = _leave_context(doc)
		checks.append(
			{
				"ok": ctx["balance_after"] >= 0,
				"label": _("Within leave balance")
				if ctx["balance_after"] >= 0
				else _("Goes {0} days over balance").format(abs(ctx["balance_after"])),
			}
		)
		members = len(ctx["team"]["members"])
		worst = max((len(d["away"]) for d in ctx["team"]["days"]), default=0)
		if members:
			ok = worst * 2 <= members
			checks.append(
				{
					"ok": ok,
					"label": _("Team coverage fine")
					if ok
					else _("{0} of {1} in the team away on the busiest day").format(worst, members),
				}
			)
	elif doc.doctype == "Expense Claim":
		missing = [row.idx for row in doc.expenses if not row.amount]
		checks.append(
			{
				"ok": not missing,
				"label": _("Every line has an amount") if not missing else _("Lines without an amount"),
			}
		)
		has_receipts = bool(
			frappe.db.count("File", {"attached_to_doctype": doc.doctype, "attached_to_name": doc.name})
		)
		checks.append(
			{
				"ok": has_receipts,
				"label": _("Receipts attached") if has_receipts else _("No receipts attached"),
			}
		)
	return checks


def _decide(doc, action, reason=None):
	if doc.docstatus != 0:
		frappe.throw(_("{0} {1} has already been decided").format(_(doc.doctype), doc.name))

	me = _current_employee()
	if me and doc.employee == me:
		frappe.throw(_("You can't decide your own request"), frappe.PermissionError)

	workflow = get_workflow_name(doc.doctype)
	cfg = REQUEST_TYPES[doc.doctype]
	if not workflow:
		if action not in ("Approve", "Reject") or (action == "Reject" and not cfg["status_field"]):
			frappe.throw(_("Action {0} is not available for {1}").format(action, _(doc.doctype)))

		# The named approver decides. HR managers may step in for anyone.
		approver_field = cfg["approver_field"]
		if (
			approver_field
			and doc.get(approver_field) != frappe.session.user
			and "HR Manager" not in frappe.get_roles()
		):
			frappe.throw(
				_("Only {0} can decide this request").format(doc.get(approver_field) or _("the approver")),
				frappe.PermissionError,
			)

	if reason:
		doc.add_comment("Comment", reason)

	if workflow:
		# The workflow decides who may take which step.
		return apply_workflow(doc, action)

	if cfg["status_field"]:
		doc.set(cfg["status_field"], "Approved" if action == "Approve" else "Rejected")
	# submit() runs the document's own validations and permission checks.
	doc.submit()
	return doc


@frappe.whitelist(methods=["POST"])
def decide(doctype: str, name: str, action: str, reason: str | None = None) -> dict:
	"""Approve, reject or apply a workflow action to one request."""
	_config(doctype)
	doc = frappe.get_doc(doctype, name)
	doc = _decide(doc, action, reason)
	return {"name": doc.name, "docstatus": doc.docstatus}


@frappe.whitelist(methods=["POST"])
def approve_clear(items: list | str) -> dict:
	"""Approve only the requests whose checks all pass. Each is decided on its own;
	one failure never blocks the rest."""
	items = frappe.parse_json(items) if isinstance(items, str) else items
	approved, skipped, failed = [], [], []

	for item in items:
		doctype, name = item.get("doctype"), item.get("name")
		frappe.db.savepoint("approve_clear")
		try:
			_config(doctype)
			doc = frappe.get_doc(doctype, name)
			if not all(c["ok"] for c in get_checks(doc)):
				skipped.append({"doctype": doctype, "name": name, "reason": _("Has warnings")})
				continue
			action = "Approve"
			if get_workflow_name(doctype):
				options = [t.action for t in get_transitions(doc) if t.action.lower().startswith("approv")]
				if not options:
					skipped.append({"doctype": doctype, "name": name, "reason": _("No approve step for you")})
					continue
				action = options[0]
			_decide(doc, action)
			approved.append({"doctype": doctype, "name": name})
		except Exception as e:
			frappe.db.rollback(save_point="approve_clear")
			frappe.clear_last_message()
			failed.append({"doctype": doctype, "name": name, "reason": str(e) or e.__class__.__name__})

	return {"approved": approved, "skipped": skipped, "failed": failed, "count": cint(len(approved))}


@frappe.whitelist(methods=["POST"])
def add_comment(doctype: str, name: str, text: str) -> None:
	"""Comment on a request without deciding it. The requester sees it on the document."""
	_config(doctype)
	doc = frappe.get_doc(doctype, name)
	doc.check_permission("read")
	if not (text or "").strip():
		frappe.throw(_("Write something first"))
	doc.add_comment("Comment", text.strip())
