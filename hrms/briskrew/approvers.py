import frappe

# Employee fields that name who approves each kind of request.
APPROVER_FIELDS = ("leave_approver", "expense_approver", "shift_request_approver")

# Request doctype -> (its approver field, the Employee field, the Department Approver table)
REQUEST_APPROVERS = {
	"Leave Application": ("leave_approver", "leave_approver", "leave_approvers"),
	"Expense Claim": ("expense_approver", "expense_approver", "expense_approvers"),
	"Shift Request": ("approver", "shift_request_approver", "shift_request_approver"),
}


def set_default_approvers(doc, method=None):
	"""Default every empty approver to the employee's reporting manager (team lead).

	An approver set on the employee always wins, so explicit approvers and custom
	approval workflows keep working. Only blank fields are filled.
	"""
	if not doc.reports_to:
		return

	manager_user = frappe.db.get_value("Employee", doc.reports_to, "user_id")
	if not manager_user or manager_user == doc.user_id:
		return

	for field in APPROVER_FIELDS:
		if doc.meta.has_field(field) and not doc.get(field):
			doc.set(field, manager_user)


@frappe.whitelist()
def backfill_default_approvers() -> int:
	"""Apply the reporting-manager default to existing employees. Returns how many changed."""
	frappe.only_for(("HR Manager", "System Manager"))

	changed = 0
	for name in frappe.get_all("Employee", filters={"reports_to": ("is", "set")}, pluck="name"):
		doc = frappe.get_doc("Employee", name)
		before = [doc.get(f) for f in APPROVER_FIELDS]
		set_default_approvers(doc)
		if [doc.get(f) for f in APPROVER_FIELDS] != before:
			doc.save()
			changed += 1
	return changed


def set_request_approver(doc, method=None):
	"""Fill a request's approver when it arrives without one.

	The classic desk form does this in the browser; requests created through the API,
	the mobile app or imports skip that step and would reach nobody. Order: the
	employee's own approver, then the department's first approver, then the
	reporting manager.
	"""
	field, employee_field, department_table = REQUEST_APPROVERS[doc.doctype]
	if doc.get(field) or not doc.get("employee"):
		return

	employee = frappe.db.get_value(
		"Employee", doc.employee, [employee_field, "department", "reports_to", "user_id"], as_dict=True
	)
	if not employee:
		return

	approver = employee.get(employee_field)
	if not approver and employee.department:
		approver = frappe.db.get_value(
			"Department Approver",
			{"parent": employee.department, "parentfield": department_table},
			"approver",
			order_by="idx asc",
		)
	if not approver and employee.reports_to:
		approver = frappe.db.get_value("Employee", employee.reports_to, "user_id")

	if approver and approver != employee.user_id:
		doc.set(field, approver)
