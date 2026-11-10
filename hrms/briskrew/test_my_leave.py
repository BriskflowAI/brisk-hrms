import frappe
from frappe.utils import add_days, add_months, getdate, nowdate

from erpnext.setup.doctype.employee.test_employee import make_employee

from hrms.briskrew.my_leave import apply, leave_types, preview, summary, withdraw
from hrms.hr.doctype.leave_application.test_leave_application import make_allocation_record
from hrms.tests.utils import HRMSTestSuite

PAID = "_Test My Leave Paid"
UNPAID = "_Test My Leave Unpaid"


def _leave_type(name, **extra):
	if not frappe.db.exists("Leave Type", name):
		frappe.get_doc(
			{"doctype": "Leave Type", "leave_type_name": name, "include_holiday": 1, **extra}
		).insert()


class TestMyLeave(HRMSTestSuite):
	def setUp(self):
		frappe.set_user("Administrator")
		self.addCleanup(frappe.set_user, "Administrator")
		# Holidays counted in, so day counts don't depend on the test company's calendar.
		_leave_type(PAID)
		_leave_type(UNPAID, is_lwp=1)

		self.manager_user = "my_leave_manager@example.com"
		self.manager = make_employee(self.manager_user, "_Test Company")
		self.user = "my_leave_member@example.com"
		self.employee = make_employee(self.user, "_Test Company")
		self.other_user = "my_leave_other@example.com"
		self.other = make_employee(self.other_user, "_Test Company")

		for doctype in ("Leave Application", "Leave Allocation", "Leave Ledger Entry"):
			frappe.db.delete(doctype, {"employee": ("in", [self.employee, self.other])})
		emp = frappe.get_doc("Employee", self.employee)
		emp.reports_to = self.manager
		emp.leave_approver = None
		emp.save()

		self.today = getdate(nowdate())
		self.period = {
			"from_date": str(add_days(self.today, -60)),
			"to_date": str(add_days(self.today, 300)),
		}
		for employee in (self.employee, self.other):
			make_allocation_record(
				employee=employee,
				leave_type=PAID,
				from_date=self.period["from_date"],
				to_date=self.period["to_date"],
				leaves=10,
			)

	def _request(self, offset, days=1, status="Open", employee=None, leave_type=PAID):
		from_date = add_days(self.today, offset)
		doc = frappe.get_doc(
			{
				"doctype": "Leave Application",
				"employee": employee or self.employee,
				"leave_type": leave_type,
				"from_date": from_date,
				"to_date": add_days(from_date, days - 1),
				"company": "_Test Company",
				"status": status,
				"leave_approver": self.manager_user,
			}
		).insert(ignore_permissions=True)
		if status == "Approved":
			doc.submit()
		return doc

	def _card(self, data, leave_type=PAID):
		return next(c for c in data["balances"] if c["leave_type"] == leave_type)

	def test_balance_splits_booked_into_used_and_planned(self):
		self._request(-10, days=2, status="Approved")
		self._request(20, days=3, status="Approved")
		self._request(40, days=1)

		frappe.set_user(self.user)
		card = self._card(summary(**self.period))
		self.assertEqual(card["allocated"], 10)
		self.assertEqual(card["used"], 2)
		self.assertEqual(card["planned"], 3)
		self.assertEqual(card["pending"], 1)
		self.assertEqual(card["available"], 4)

	def test_unpaid_leave_shows_once_used(self):
		frappe.set_user(self.user)
		self.assertNotIn(UNPAID, [c["leave_type"] for c in summary(**self.period)["balances"]])

		frappe.set_user("Administrator")
		self._request(5, days=2, status="Approved", leave_type=UNPAID)
		frappe.set_user(self.user)
		card = self._card(summary(**self.period), UNPAID)
		self.assertFalse(card["paid"])
		self.assertIsNone(card["available"])
		self.assertEqual(card["planned"], 2)

	def test_summary_lists_only_my_requests(self):
		mine = self._request(10)
		theirs = self._request(10, employee=self.other)

		frappe.set_user(self.user)
		names = {r.name for r in summary(**self.period)["requests"]}
		self.assertIn(mine.name, names)
		self.assertNotIn(theirs.name, names)

	def test_preview_counts_days_and_balance_after(self):
		frappe.set_user(self.user)
		start = add_days(self.today, 10)
		end = str(add_days(start, 2))
		result = preview(PAID, str(start), end, half_day=1, half_day_date=end)
		self.assertEqual(result["days"], 2.5)
		self.assertEqual(len(result["day_rows"]), 3)
		self.assertEqual(result["balance"]["available"], 10)
		self.assertEqual(result["balance"]["after"], 7.5)
		self.assertEqual(result["approver"]["user"], self.manager_user)

	def test_leave_types_offers_allocated_and_unpaid(self):
		frappe.set_user(self.user)
		offered = leave_types()
		self.assertIn(PAID, offered)
		self.assertIn(UNPAID, offered)

	def test_apply_sends_a_pending_request_to_my_approver(self):
		frappe.set_user(self.user)
		start = str(add_days(self.today, 15))
		name = apply(PAID, start, start, reason="Dentist")

		doc = frappe.get_doc("Leave Application", name)
		self.assertEqual(doc.employee, self.employee)
		self.assertEqual(doc.status, "Open")
		self.assertEqual(doc.docstatus, 0)
		self.assertEqual(doc.leave_approver, self.manager_user)
		self.assertEqual(doc.description, "Dentist")

	def test_apply_over_balance_is_refused(self):
		frappe.set_user(self.user)
		start = add_days(self.today, 15)
		with self.assertRaises(frappe.ValidationError):
			apply(PAID, str(start), str(add_days(start, 11)))

	def test_withdraw_cancels_my_pending_request(self):
		request = self._request(25)
		frappe.set_user(self.user)
		withdraw(request.name)
		doc = frappe.get_doc("Leave Application", request.name)
		self.assertEqual(doc.docstatus, 2)
		self.assertEqual(doc.status, "Cancelled")

	def test_withdraw_refuses_someone_elses_request(self):
		theirs = self._request(25, employee=self.other)
		frappe.set_user(self.user)
		with self.assertRaises(frappe.DoesNotExistError):
			withdraw(theirs.name)
		self.assertEqual(frappe.db.get_value("Leave Application", theirs.name, "docstatus"), 0)

	def test_withdraw_refuses_a_decided_request(self):
		approved = self._request(25, status="Approved")
		frappe.set_user(self.user)
		with self.assertRaises(frappe.ValidationError):
			withdraw(approved.name)

	def test_user_without_employee_is_told_so(self):
		frappe.set_user("Administrator")
		user = frappe.get_doc(
			{
				"doctype": "User",
				"email": "my_leave_nobody@example.com",
				"first_name": "Nobody",
				"send_welcome_email": 0,
				"roles": [{"role": "Employee"}],
			}
		).insert(ignore_if_duplicate=True)
		frappe.set_user(user.name)
		with self.assertRaises(frappe.DoesNotExistError):
			summary()
