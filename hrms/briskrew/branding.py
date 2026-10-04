"""Puts the briskrew name and look on a site: sign-in page, email header, prints.

Only settings still at Frappe's defaults are changed, so anything an admin has
customised stays as it is. Runs on install and once on migrate (see patches.txt)."""

import frappe

NAME = "briskrew"
LOGO = "/assets/hrms/briskrew/mark.png"
PRINT_STYLE = "briskrew"
SALARY_SLIP_FORMAT = "Salary Slip briskrew"

# Product names Frappe and its apps set by default; these are replaced, anything else is kept.
DEFAULT_NAMES = {"", "Frappe", "ERPNext", "Frappe HR", "Frappe Framework"}


def apply():
	for doctype in ("Website Settings", "System Settings"):
		if (frappe.db.get_single_value(doctype, "app_name") or "") in DEFAULT_NAMES:
			frappe.db.set_single_value(doctype, "app_name", NAME)

	# The logo on the sign-in page and at the top of emails. PNG, because many email apps don't show SVG.
	if not frappe.db.get_single_value("Website Settings", "app_logo"):
		frappe.db.set_single_value("Website Settings", "app_logo", LOGO)

	# Print Settings' style is site-wide (invoices, orders, every ERPNext print), so it is left
	# alone. HR prints get the briskrew look from their own format; the briskrew Print Style is
	# installed for anyone who chooses it.

	if (
		frappe.db.exists("Print Format", SALARY_SLIP_FORMAT)
		and not frappe.get_meta("Salary Slip").default_print_format
	):
		frappe.make_property_setter(
			{
				"doctype": "Salary Slip",
				"doctype_or_field": "DocType",
				"property": "default_print_format",
				"value": SALARY_SLIP_FORMAT,
				"property_type": "Data",
			},
			validate_fields_for_doctype=False,
		)

	frappe.clear_cache()
