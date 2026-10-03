"""Small helpers the briskrew interface needs that Frappe doesn't expose as whitelisted methods."""

import frappe


@frappe.whitelist()
def new_doc(doctype: str, parent_doctype: str | None = None) -> dict:
	"""A new, unsaved document with every server-side default applied
	(field defaults, user defaults such as company, naming series)."""
	frappe.has_permission(parent_doctype or doctype, "create", throw=True)
	doc = frappe.new_doc(doctype, as_dict=False)
	return doc.as_dict()


@frappe.whitelist()
def boot() -> dict:
	"""Session context the classic desk keeps in `frappe.boot`, needed to run desk form scripts."""
	user = frappe.session.user
	defaults = frappe.defaults.get_defaults() or {}
	employee = frappe.db.get_value("Employee", {"user_id": user}, ["name", "company"], as_dict=True)
	if not defaults.get("company"):
		# Desk scripts and report filters start from the user's company; fall back sensibly.
		companies = frappe.get_all("Company", pluck="name", limit=2)
		defaults["company"] = (
			(employee and employee.company)
			or frappe.db.get_single_value("Global Defaults", "default_company")
			or (companies[0] if len(companies) == 1 else None)
		)
	companies = frappe.get_all("Company", fields=["name", "default_currency", "abbr"])
	return {
		"user": user,
		"user_fullname": frappe.utils.get_fullname(user),
		"user_email": frappe.db.get_value("User", user, "email") or user,
		"roles": frappe.get_roles(user),
		"employee": employee and employee.name,
		"defaults": defaults,
		"sysdefaults": {
			"currency": frappe.db.get_default("currency"),
			"date_format": frappe.db.get_default("date_format") or "dd-mm-yyyy",
			"time_format": frappe.db.get_default("time_format") or "HH:mm:ss",
			"number_format": frappe.db.get_default("number_format") or "#,###.##",
			"float_precision": frappe.db.get_default("float_precision") or 3,
			"currency_precision": frappe.db.get_default("currency_precision"),
			"first_day_of_the_week": frappe.db.get_default("first_day_of_the_week") or "Monday",
			"country": frappe.db.get_default("country"),
			"time_zone": frappe.utils.get_system_timezone(),
		},
		"companies": {c.name: {"currency": c.default_currency, "abbr": c.abbr} for c in companies},
	}


@frappe.whitelist()
def access() -> dict:
	"""What the current user can open, so menus only offer what will work."""
	user = frappe.get_user()
	return {
		"can_read": sorted(set(user.get_can_read())),
		"reports": sorted(user.get_all_reports()),
		"lang": frappe.local.lang or "en",
	}


@frappe.whitelist()
def unread_notifications() -> int:
	"""Unread notifications for the bell, without loading them."""
	return frappe.db.count("Notification Log", {"for_user": frappe.session.user, "read": 0})


@frappe.whitelist()
def doctype_perms(doctype: str) -> dict:
	"""What the current user may do with a doctype, for list screens and desk scripts."""
	ptypes = (
		"read",
		"write",
		"create",
		"delete",
		"submit",
		"cancel",
		"amend",
		"import",
		"export",
		"print",
		"email",
		"report",
	)
	perms = {p: int(bool(frappe.has_permission(doctype, p))) for p in ptypes}
	perms["bulk_actions"] = int(bool(frappe.get_cached_value("User", frappe.session.user, "bulk_actions")))
	return perms
