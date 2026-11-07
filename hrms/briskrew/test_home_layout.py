import frappe

from hrms.briskrew.home_layout import HOME_CARDS, get_home_layout, save_home_layout
from hrms.tests.utils import HRMSTestSuite

USER = "home_layout_user@example.com"
OTHER = "home_layout_other@example.com"


class TestHomeLayout(HRMSTestSuite):
	def setUp(self):
		frappe.set_user("Administrator")
		self.addCleanup(frappe.set_user, "Administrator")
		for email in (USER, OTHER):
			if not frappe.db.exists("User", email):
				frappe.get_doc({"doctype": "User", "email": email, "first_name": email.split("@")[0]}).insert(
					ignore_permissions=True
				)
			frappe.defaults.clear_user_default("briskrew_home_layout", email)

	def test_a_new_user_gets_every_card_in_the_default_order(self):
		frappe.set_user(USER)
		self.assertEqual(get_home_layout(), {"order": list(HOME_CARDS), "hidden": []})

	def test_a_saved_order_and_hidden_cards_come_back(self):
		frappe.set_user(USER)
		order = ["week", "checkin", "payroll", "waiting", "headcount"]
		save_home_layout(order=order, hidden=["payroll"])
		self.assertEqual(get_home_layout(), {"order": order, "hidden": ["payroll"]})

	def test_unknown_and_repeated_cards_are_dropped_and_missing_ones_added_at_the_end(self):
		frappe.set_user(USER)
		saved = save_home_layout(order=["week", "nope", "week", "checkin"], hidden=["nope", "week"])
		self.assertEqual(saved["order"][:2], ["week", "checkin"])
		self.assertEqual(sorted(saved["order"]), sorted(HOME_CARDS))
		self.assertEqual(saved["hidden"], ["week"])

	def test_layout_accepts_json_strings_from_the_browser(self):
		frappe.set_user(USER)
		saved = save_home_layout(order='["headcount", "checkin"]', hidden="[]")
		self.assertEqual(saved["order"][:2], ["headcount", "checkin"])

	def test_one_users_layout_does_not_change_anothers(self):
		frappe.set_user(USER)
		save_home_layout(order=["headcount", "week"], hidden=["checkin"])
		frappe.set_user(OTHER)
		self.assertEqual(get_home_layout(), {"order": list(HOME_CARDS), "hidden": []})
