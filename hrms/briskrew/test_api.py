import frappe

from hrms.briskrew.api import access, unread_notifications
from hrms.tests.utils import HRMSTestSuite


class TestBriskrewApi(HRMSTestSuite):
	def test_access_lists_readable_doctypes_and_reports(self):
		result = access()
		self.assertIn("Employee", result["can_read"])
		self.assertIn("Employee Leave Balance", result["reports"])

	def test_access_is_limited_for_a_plain_user(self):
		user = frappe.get_doc(
			{
				"doctype": "User",
				"email": "briskrew-access@example.com",
				"first_name": "Access",
				"send_welcome_email": 0,
			}
		).insert(ignore_if_duplicate=True)
		frappe.set_user(user.name)
		try:
			self.assertNotIn("Salary Structure", access()["can_read"])
		finally:
			frappe.set_user("Administrator")

	def test_unread_notifications_counts_only_mine(self):
		before = unread_notifications()
		frappe.get_doc(
			{"doctype": "Notification Log", "for_user": "Administrator", "subject": "Hello", "type": "Alert"}
		).insert(ignore_permissions=True)
		frappe.get_doc(
			{"doctype": "Notification Log", "for_user": "Guest", "subject": "Hello", "type": "Alert"}
		).insert(ignore_permissions=True)
		self.assertEqual(unread_notifications(), before + 1)
