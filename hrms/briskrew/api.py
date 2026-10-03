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
def apps() -> dict:
	"""The other apps and workspaces this user can open, grouped by app, for briskrew's app
	switcher. Mirrors the desk's app screen: public top-level workspaces the user's roles and
	module settings allow, with the icon each app ships for its desk grid."""
	from frappe.apps import get_apps
	from frappe.utils.modules import is_module_visible

	installed = frappe.get_installed_apps()
	app_entries = get_apps()
	# Newer desks live at /desk, older ones at /app; the apps' own routes say which this site uses.
	desk = "/desk" if any(str(a.get("route") or "").startswith("/desk") for a in app_entries) else "/app"
	roles = set(frappe.get_roles())

	ws_fields = ["name", "title", "module", "icon", "sequence_id"]
	if frappe.get_meta("Workspace").has_field("parent_page"):
		ws_fields.append("parent_page")
	workspaces = frappe.get_all(
		"Workspace", filters={"public": 1}, fields=ws_fields, order_by="sequence_id asc, name asc"
	)
	ws_roles = {}
	for r in frappe.get_all(
		"Has Role", filters={"parenttype": "Workspace"}, fields=["parent", "role"], limit=0
	):
		ws_roles.setdefault(r.parent, set()).add(r.role)
	module_app = dict(frappe.get_all("Module Def", fields=["name", "app_name"], as_list=True))

	visible = _openable_workspace_check()

	groups = {}
	for w in workspaces:
		if w.get("parent_page"):
			continue
		if w.module and not is_module_visible(w.module):
			continue
		if ws_roles.get(w.name) and not ws_roles[w.name] & roles:
			continue
		if not visible(w):
			continue
		app = module_app.get(w.module) or "frappe"
		if app not in installed:
			continue
		label = w.title or w.name
		groups.setdefault(app, []).append(
			{
				"label": _(label),
				"route": f"{desk}/{label.lower().replace(' ', '-')}",
				"icon": _desk_icon(app, label),
				"module": w.module,
			}
		)

	order = [a for a in installed if a in groups]
	order = [a for a in order if a != "frappe"] + (["frappe"] if "frappe" in order else [])
	return {
		"desk": desk,
		"home": f"{desk}",
		"apps": [
			{"name": a.get("name"), "title": a.get("title"), "route": a.get("route"), "logo": a.get("logo")}
			for a in app_entries
		],
		"groups": [
			{
				"app": app,
				"title": (frappe.get_hooks("app_title", app_name=app) or [app])[0],
				"items": groups[app],
			}
			for app in order
		],
	}


def _openable_workspace_check():
	"""Like the desk, show a workspace only when it holds something this user can open.

	Newer desks decide that per module sidebar (the same payload the desk boots with); older ones
	from the workspace's own links and shortcuts. A workspace with nothing to check either way
	stays visible."""
	try:
		from frappe.boot import get_module_sidebars
		from frappe.desk.doctype.sidebar.sidebar import sidebar_for_module

		sidebars = get_module_sidebars() or {}
		return lambda w: bool(sidebar_for_module(sidebars, w.module or w.name))
	except ImportError:
		pass

	user = frappe.get_user()
	can_read, reports = set(user.get_can_read()), set(user.get_all_reports())
	has_links, openable = set(), set()
	for child, type_field in (("Workspace Link", "link_type"), ("Workspace Shortcut", "type")):
		for r in frappe.get_all(
			child,
			filters={"parenttype": "Workspace"},
			fields=["parent", f"{type_field} as link_type", "link_to"],
			limit=0,
		):
			has_links.add(r.parent)
			if (
				(r.link_type == "DocType" and r.link_to in can_read)
				or (r.link_type == "Report" and r.link_to in reports)
				or r.link_type in ("Page", "URL", "Dashboard")
			):
				openable.add(r.parent)
	return lambda w: w.name in openable or w.name not in has_links


def _desk_icon(app: str, label: str) -> str | None:
	"""The solid desk-grid icon an app ships for this workspace, if any."""
	import os

	name = label.lower().replace(" ", "_") + ".svg"
	for style in ("solid", "subtle"):
		path = os.path.join(frappe.get_app_path(app), "public", "icons", "desktop_icons", style, name)
		if os.path.exists(path):
			return f"/assets/{app}/icons/desktop_icons/{style}/{name}"
	return None


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
