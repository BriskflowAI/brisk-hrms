import frappe
from frappe.utils import add_days, add_months, nowdate

from erpnext.setup.doctype.employee.test_employee import make_employee

from hrms.briskrew.approvers import backfill_default_approvers
from hrms.briskrew.inbox import approve_clear, decide, get_context, get_inbox
from hrms.hr.doctype.leave_application.test_leave_application import make_allocation_record
from hrms.tests.utils import HRMSTestSuite

LEAVE_TYPE = "_Test Leave Type"


class TestInbox(HRMSTestSuite):
	def setUp(self):
		frappe.set_user("Administrator")
		self.addCleanup(frappe.set_user, "Administrator")

		self.manager_user = "inbox_manager@example.com"
		self.manager = make_employee(self.manager_user, "_Test Company")
		self.member_user = "inbox_member@example.com"
		self.member = make_employee(self.member_user, "_Test Company")
		self.other_user = "inbox_other_approver@example.com"
		make_employee(self.other_user, "_Test Company")

		# Start clean for this suite's own employees only; never touch other data on the site.
		for doctype in ("Leave Application", "Leave Allocation", "Leave Ledger Entry"):
			frappe.db.delete(doctype, {"employee": ("in", [self.manager, self.member])})

		emp = frappe.get_doc("Employee", self.member)
		emp.reports_to = self.manager
		emp.leave_approver = None
		emp.expense_approver = None
		emp.shift_request_approver = None
		emp.holiday_list = None
		emp.save()

		start = add_months(nowdate(), -1)
		make_allocation_record(
			employee=self.member,
			leave_type=LEAVE_TYPE,
			from_date=start,
			to_date=add_months(start, 11),
			leaves=10,
		)

	def _leave(self, employee=None, approver=None, days=2, offset=7):
		from_date = add_days(nowdate(), offset)
		doc = frappe.get_doc(
			{
				"doctype": "Leave Application",
				"employee": employee or self.member,
				"leave_type": LEAVE_TYPE,
				"from_date": from_date,
				"to_date": add_days(from_date, days - 1),
				"company": "_Test Company",
				"status": "Open",
				"leave_approver": approver or self.manager_user,
			}
		)
		doc.insert(ignore_permissions=True)
		return doc

	# Default approver ------------------------------------------------------

	def test_reporting_manager_becomes_default_approver(self):
		emp = frappe.get_doc("Employee", self.member)
		self.assertEqual(emp.leave_approver, self.manager_user)
		self.assertEqual(emp.expense_approver, self.manager_user)
		self.assertEqual(emp.shift_request_approver, self.manager_user)

	def test_explicit_approver_is_kept(self):
		emp = frappe.get_doc("Employee", self.member)
		emp.leave_approver = self.other_user
		emp.save()
		self.assertEqual(emp.leave_approver, self.other_user)
		self.assertEqual(emp.expense_approver, self.manager_user)

	def test_backfill_fills_only_blanks(self):
		frappe.db.set_value(
			"Employee", self.member, {"leave_approver": None, "expense_approver": self.other_user}
		)
		backfill_default_approvers()
		leave, expense = frappe.db.get_value("Employee", self.member, ["leave_approver", "expense_approver"])
		self.assertEqual(leave, self.manager_user)
		self.assertEqual(expense, self.other_user)

	def test_request_without_approver_gets_one(self):
		from_date = add_days(nowdate(), 40)
		leave = frappe.get_doc(
			{
				"doctype": "Leave Application",
				"employee": self.member,
				"leave_type": LEAVE_TYPE,
				"from_date": from_date,
				"to_date": from_date,
				"company": "_Test Company",
				"status": "Open",
			}
		).insert(ignore_permissions=True)
		self.assertEqual(leave.leave_approver, self.manager_user)

	# Queue -----------------------------------------------------------------

	def test_inbox_shows_only_requests_waiting_on_me(self):
		mine = self._leave()
		not_mine = self._leave(approver=self.other_user, offset=20)

		frappe.set_user(self.manager_user)
		names = {i["name"] for i in get_inbox()["items"]}
		self.assertIn(mine.name, names)
		self.assertNotIn(not_mine.name, names)

	def test_own_request_never_in_inbox_and_cannot_be_decided(self):
		own = self._leave(employee=self.manager, approver=self.manager_user)

		frappe.set_user(self.manager_user)
		self.assertNotIn(own.name, {i["name"] for i in get_inbox()["items"]})
		self.assertRaises(frappe.PermissionError, decide, "Leave Application", own.name, "Approve")

	# Decisions -------------------------------------------------------------

	def test_approve_submits_through_the_document(self):
		leave = self._leave()
		frappe.set_user(self.manager_user)
		decide("Leave Application", leave.name, "Approve")

		leave.reload()
		self.assertEqual(leave.status, "Approved")
		self.assertEqual(leave.docstatus, 1)

	def test_reject_keeps_reason_as_comment(self):
		leave = self._leave()
		frappe.set_user(self.manager_user)
		decide("Leave Application", leave.name, "Reject", reason="Release week, can we move this?")

		leave.reload()
		self.assertEqual(leave.status, "Rejected")
		self.assertEqual(leave.docstatus, 1)
		self.assertTrue(
			frappe.db.exists(
				"Comment",
				{
					"reference_doctype": "Leave Application",
					"reference_name": leave.name,
					"content": ("like", "%Release week%"),
				},
			)
		)

	def test_cannot_decide_twice(self):
		leave = self._leave()
		frappe.set_user(self.manager_user)
		decide("Leave Application", leave.name, "Approve")
		self.assertRaises(frappe.ValidationError, decide, "Leave Application", leave.name, "Approve")

	def test_context_explains_balance(self):
		leave = self._leave(days=3)
		frappe.set_user(self.manager_user)
		ctx = get_context("Leave Application", leave.name)
		self.assertEqual(ctx["leave_balance"], 10)
		self.assertEqual(ctx["balance_after"], 7)
		self.assertTrue(all(c["ok"] for c in ctx["checks"] if "balance" in c["label"].lower()))
		self.assertEqual([a["action"] for a in ctx["actions"]], ["Approve", "Reject"])

	# Bulk ------------------------------------------------------------------

	def test_approve_clear_skips_requests_with_warnings(self):
		# Allow applying beyond the balance so the over-balance request can exist at all.
		frappe.db.set_value("Leave Type", LEAVE_TYPE, "allow_negative", 1)
		clear = self._leave(days=2)
		over = self._leave(days=12, offset=30)

		frappe.set_user(self.manager_user)
		res = approve_clear(
			[
				{"doctype": "Leave Application", "name": clear.name},
				{"doctype": "Leave Application", "name": over.name},
			]
		)
		self.assertEqual([r["name"] for r in res["approved"]], [clear.name])
		self.assertEqual([r["name"] for r in res["skipped"]], [over.name])
		self.assertEqual(frappe.db.get_value("Leave Application", over.name, "docstatus"), 0)

	def test_approve_clear_never_approves_someone_elses_queue(self):
		foreign = self._leave(approver=self.other_user)
		frappe.set_user(self.manager_user)
		res = approve_clear([{"doctype": "Leave Application", "name": foreign.name}])
		self.assertEqual(res["approved"], [])
		self.assertEqual(frappe.db.get_value("Leave Application", foreign.name, "docstatus"), 0)
