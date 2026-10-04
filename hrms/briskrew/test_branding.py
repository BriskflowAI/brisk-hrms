import frappe

from hrms.briskrew import branding
from hrms.tests.utils import HRMSTestSuite


class TestBriskrewBranding(HRMSTestSuite):
	def test_replaces_frappe_defaults(self):
		frappe.db.set_single_value("Website Settings", "app_name", "Frappe")
		frappe.db.set_single_value("Website Settings", "app_logo", None)
		branding.apply()
		self.assertEqual(frappe.db.get_single_value("Website Settings", "app_name"), "briskrew")
		self.assertEqual(frappe.db.get_single_value("Website Settings", "app_logo"), branding.LOGO)
		self.assertEqual(frappe.get_meta("Salary Slip").default_print_format, branding.SALARY_SLIP_FORMAT)

	def test_leaves_the_site_print_style_alone(self):
		# The print style applies to every document (ERPNext invoices too), so branding never sets it.
		frappe.db.set_single_value("Print Settings", "print_style", "Redesign")
		branding.apply()
		self.assertEqual(frappe.db.get_single_value("Print Settings", "print_style"), "Redesign")
		self.assertTrue(frappe.db.exists("Print Style", branding.PRINT_STYLE))

	def test_keeps_what_an_admin_set(self):
		frappe.db.set_single_value("Website Settings", "app_name", "Acme People")
		frappe.db.set_single_value("Website Settings", "app_logo", "/files/acme.png")
		frappe.db.set_single_value("Print Settings", "print_style", "briskrew-custom-missing")
		branding.apply()
		self.assertEqual(frappe.db.get_single_value("Website Settings", "app_name"), "Acme People")
		self.assertEqual(frappe.db.get_single_value("Website Settings", "app_logo"), "/files/acme.png")
		self.assertEqual(
			frappe.db.get_single_value("Print Settings", "print_style"), "briskrew-custom-missing"
		)

	def test_email_footer_shows_one_line(self):
		from frappe.email.email_body import get_footer

		frappe.db.set_default("disable_standard_email_footer", 0)
		footer = get_footer(None)
		self.assertIn("Sent from briskrew", footer)
		self.assertNotIn("ERPNext", footer)
