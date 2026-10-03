import frappe
from frappe.utils import add_days, getdate, nowdate

from erpnext.setup.doctype.employee.test_employee import make_employee

from hrms.briskrew.api import boot, doctype_perms, new_doc
from hrms.briskrew.payroll import _diff_lines
from hrms.briskrew.people import _next_event, get_directory, get_profile
from hrms.briskrew.today import get_today
from hrms.tests.utils import HRMSTestSuite


class TestBriskrewScreens(HRMSTestSuite):
	def setUp(self):
		frappe.set_user("Administrator")
		self.addCleanup(frappe.set_user, "Administrator")
		self.employee = make_employee("screens_member@example.com", "_Test Company")

	def test_new_doc_has_server_defaults(self):
		doc = new_doc("Leave Application")
		self.assertEqual(doc["doctype"], "Leave Application")
		self.assertEqual(doc["status"], "Open")
		self.assertEqual(getdate(doc["posting_date"]), getdate(nowdate()))

	def test_new_doc_respects_create_permission(self):
		frappe.set_user("Guest")
		self.assertRaises(frappe.PermissionError, new_doc, "Salary Slip")

	def test_boot_and_perms(self):
		info = boot()
		self.assertEqual(info["user"], "Administrator")
		self.assertIn("System Manager", info["roles"])
		perms = doctype_perms("Employee")
		self.assertEqual(perms["read"], 1)

	def test_directory_lists_active_employees(self):
		res = get_directory()
		self.assertIn(self.employee, [e.name for e in res["employees"]])

	def test_directory_away_view_uses_todays_leave(self):
		res = get_directory(view="away")
		self.assertNotIn(self.employee, [e.name for e in res["employees"]])

	def test_profile(self):
		profile = get_profile(self.employee)
		self.assertEqual(profile["employee"]["name"], self.employee)
		self.assertIn("balances", profile)

	def test_next_event_picks_the_nearest_within_30_days(self):
		today = getdate(nowdate())
		e = frappe._dict(
			date_of_joining=add_days(today, -400),
			date_of_birth=None,
			final_confirmation_date=add_days(today, 3),
			relieving_date=None,
		)
		ev = _next_event(e, today)
		self.assertEqual(ev["kind"], "probation")
		self.assertEqual(ev["in_days"], 3)
		self.assertIsNone(_next_event(frappe._dict(date_of_joining=add_days(today, -200)), today))

	def test_today_payload(self):
		data = get_today()
		for key in ("week", "away", "holidays", "moments", "inbox", "headcount"):
			self.assertIn(key, data)
		self.assertEqual((getdate(data["week"]["end"]) - getdate(data["week"]["start"])).days, 6)

	def test_payroll_diff_lines(self):
		prev = frappe._dict()
		prev.components = [
			frappe._dict(parentfield="earnings", salary_component="Basic", amount=1000),
			frappe._dict(parentfield="earnings", salary_component="HRA", amount=300),
			frappe._dict(parentfield="deductions", salary_component="Tax", amount=100),
		]
		cur = frappe._dict(
			components=[
				frappe._dict(parentfield="earnings", salary_component="Basic", amount=1000),
				frappe._dict(parentfield="earnings", salary_component="Bonus", amount=500),
				frappe._dict(parentfield="deductions", salary_component="Tax", amount=150),
			]
		)
		kinds = {line["component"]: line["kind"] for line in _diff_lines(prev, cur)}
		self.assertEqual(kinds, {"Basic": "same", "Bonus": "added", "HRA": "removed", "Tax": "changed"})
		# Earnings come before deductions.
		self.assertEqual(_diff_lines(prev, cur)[-1]["section"], "deductions")
		# A first payslip: every line is new.
		self.assertTrue(all(line["kind"] == "added" for line in _diff_lines(None, cur)))
