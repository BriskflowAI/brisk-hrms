"""Small helpers the briskrew interface needs that Frappe doesn't expose as whitelisted methods."""

import frappe
from frappe import _


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
	sysdefaults = {
		"currency": frappe.db.get_default("currency"),
		"date_format": frappe.db.get_default("date_format") or "dd-mm-yyyy",
		"time_format": frappe.db.get_default("time_format") or "HH:mm:ss",
		"number_format": frappe.db.get_default("number_format") or "#,###.##",
		"float_precision": frappe.db.get_default("float_precision") or 3,
		"currency_precision": frappe.db.get_default("currency_precision"),
		"first_day_of_the_week": frappe.db.get_default("first_day_of_the_week") or "Monday",
		"country": frappe.db.get_default("country"),
		"time_zone": frappe.utils.get_system_timezone(),
	}
	desk = _desk_boot(sysdefaults)
	return {
		"user": user,
		"user_fullname": frappe.utils.get_fullname(user),
		"user_email": frappe.db.get_value("User", user, "email") or user,
		"roles": frappe.get_roles(user),
		"employee": employee and employee.name,
		"defaults": defaults,
		"sysdefaults": desk.pop("sysdefaults"),
		"desk": desk,
		"installed_apps": frappe.get_installed_apps(),
		"companies": {c.name: {"currency": c.default_currency, "abbr": c.abbr} for c in companies},
	}


def _desk_boot(sysdefaults: dict) -> dict:
	"""What installed apps add to the desk's boot through their `boot_session` hooks (ERPNext's
	selling and accounts settings, party account types, SLA doctypes, its company and currency
	lookups...), which their desk scripts read from frappe.boot and locals. Large or desk-only
	parts are left out."""
	bootinfo = frappe._dict(sysdefaults=frappe._dict(sysdefaults), docs=[], page_info={})
	for method in frappe.get_hooks("boot_session"):
		try:
			frappe.get_attr(method)(bootinfo)
		except Exception:
			frappe.log_error(title=f"briskrew: boot_session hook {method} failed")
	# Frappe's own boot adds the ":Currency" lookups (fractions, symbols) that scripts round with.
	try:
		from frappe.boot import load_currency_docs

		load_currency_docs(bootinfo)
	except ImportError:
		pass
	for key in ("page_info", "website_route_rules"):
		bootinfo.pop(key, None)
	# Only the small lookup documents scripts read from locals (":Company", ":Currency").
	bootinfo.docs = [d for d in bootinfo.docs if str(d.get("doctype", "")).startswith(":")]

	# The parts of Frappe's own boot that desk scripts read.
	from frappe.utils.change_log import get_versions

	bootinfo.versions = {k: v["version"] for k, v in get_versions().items()}
	bootinfo.sms_gateway_enabled = bool(frappe.db.get_single_value("SMS Settings", "sms_gateway_url"))
	bootinfo.setup_complete = frappe.is_setup_complete()
	from frappe.core.doctype.user_permission.user_permission import get_user_permissions

	bootinfo.user_permissions = get_user_permissions()
	user = frappe.get_user().load_user()
	bootinfo.user_perms = {
		k: user.get(k) or []
		for k in (
			"can_create",
			"can_read",
			"can_write",
			"can_submit",
			"can_cancel",
			"can_delete",
			"all_reports",
		)
	}
	# Through JSON so dates and sets reach the browser as plain values.
	return frappe.parse_json(frappe.as_json(bootinfo))


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


@frappe.whitelist(methods=["GET"])
def translations(lang: str | None = None) -> dict:
	"""Frappe's translations for a language (the apps' catalogues plus the site's Translation
	records), for briskrew's own text. Newer Frappe serves these as
	frappe.translate.get_boot_translations; v16 only sends them inside the desk's boot."""
	from frappe.translate import get_all_languages, get_all_translations

	if not lang or lang not in get_all_languages():
		lang = frappe.local.lang
	return get_all_translations(lang)


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
	# Only decides which buttons to show; every action is checked again on the server.
	perms = {p: int(bool(frappe.has_permission(doctype, p))) for p in ptypes}  # nosemgrep
	perms["bulk_actions"] = int(bool(frappe.get_cached_value("User", frappe.session.user, "bulk_actions")))
	return perms
