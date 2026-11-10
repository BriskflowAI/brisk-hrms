import json
import os
import re
from unittest.mock import patch

import frappe

from hrms.tests.utils import HRMSTestSuite

ICON_DIR = os.path.join(os.path.dirname(__file__), "..", "desktop_icon")
FLOW_SRC = os.path.join(os.path.dirname(__file__), "..", "..", "flow", "src")
# Desk route shim for form scripts that call set_route on a screen briskrew does not have.
DESK_ROUTE_SHIM = os.path.join("engine", "compat.js")
DESK_LINK = re.compile(r"[\"'`](/app|/desk)(/|[\"'`?])")


def _standard_icons() -> dict[str, dict]:
	icons = {}
	for file in os.listdir(ICON_DIR):
		if file.endswith(".json"):
			with open(os.path.join(ICON_DIR, file)) as f:
				doc = json.load(f)
			icons[doc["name"]] = doc
	return icons


class TestBriskrewScope(HRMSTestSuite):
	def test_erpnext_modules_stay_in_navigation(self):
		# ERPNext hides a few of its own modules; this app must not hide any more.
		erpnext_modules = set(frappe.get_all("Module Def", filters={"app_name": "erpnext"}, pluck="name"))
		hidden_by_hrms = set(frappe.get_hooks("code_only_modules", app_name="hrms"))

		self.assertEqual(erpnext_modules & hidden_by_hrms, set())

	def test_hr_modules_stay_in_navigation(self):
		hr_modules = set(frappe.get_all("Module Def", filters={"app_name": "hrms"}, pluck="name"))
		code_only = set(frappe.get_hooks("code_only_modules"))

		self.assertEqual(hr_modules & code_only - {"HR"}, set())

	def test_sign_in_lands_on_briskrew(self):
		from frappe.apps import get_default_path

		from hrms.subscription_utils import set_hrms_as_default_app

		frappe.set_user("Administrator")
		frappe.db.set_single_value("System Settings", "default_app", "")
		set_hrms_as_default_app()
		frappe.clear_cache()

		self.assertEqual(get_default_path(), "/flow")

	def test_keeps_a_default_app_an_admin_chose(self):
		from hrms.subscription_utils import set_hrms_as_default_app

		frappe.db.set_single_value("System Settings", "default_app", "erpnext")
		set_hrms_as_default_app()

		self.assertEqual(frappe.db.get_single_value("System Settings", "default_app"), "erpnext")

	def test_ships_no_desk_onboarding_checklists(self):
		hrms_dir = os.path.join(os.path.dirname(__file__), "..")
		shipped = [
			os.path.relpath(root, hrms_dir)
			for root, _dirs, _files in os.walk(hrms_dir)
			if os.path.basename(root) in ("module_onboarding", "onboarding_step")
		]

		self.assertEqual(shipped, [])

	def test_patch_removes_desk_onboarding_from_a_site(self):
		from hrms.patches.v16_0.delete_desk_onboarding import execute

		# Developer mode writes these records into the app as files.
		with patch.dict(frappe.conf, {"developer_mode": 0}):
			step = frappe.get_doc(
				{
					"doctype": "Onboarding Step",
					"name": "briskrew scope test step",
					"title": "briskrew scope test step",
					"action": "Create Entry",
					"reference_document": "Employee",
				}
			).insert(ignore_permissions=True)
			frappe.get_doc(
				{
					"doctype": "Module Onboarding",
					"name": "briskrew scope test",
					"title": "briskrew scope test",
					"module": "Leaves",
					"subtitle": "test",
					"success_message": "test",
					"documentation_url": "https://example.com",
					"allow_roles": [{"role": "HR Manager"}],
					"steps": [{"step": step.name}],
				}
			).insert(ignore_permissions=True)

		execute()

		hr_modules = frappe.get_all("Module Def", filters={"app_name": "hrms"}, pluck="name")
		self.assertFalse(frappe.db.exists("Module Onboarding", {"module": ["in", hr_modules]}))
		self.assertFalse(frappe.db.exists("Onboarding Step", step.name))

	def test_overviews_include_stock_and_assets(self):
		from hrms.briskrew.dashboards import AREAS

		self.assertLessEqual({"stock", "assets"}, set(AREAS))

	def test_briskrew_never_links_to_the_classic_desk(self):
		offenders = []
		for root, _dirs, files in os.walk(FLOW_SRC):
			for file in files:
				path = os.path.join(root, file)
				if not file.endswith((".vue", ".js")) or path.endswith(DESK_ROUTE_SHIM):
					continue
				with open(path) as f:
					for number, line in enumerate(f, 1):
						if DESK_LINK.search(line):
							offenders.append(f"{os.path.relpath(path, FLOW_SRC)}:{number}")

		self.assertEqual(offenders, [])

	def test_desktop_icons_carry_no_frappe_name(self):
		icons = _standard_icons()

		for name, doc in icons.items():
			self.assertNotIn("frappe", name.lower())
			self.assertNotIn("frappe", (doc.get("logo_url") or "").lower())
			parent = doc.get("parent_icon")
			if parent:
				self.assertIn(parent, icons, f"{name} points at a parent icon that does not exist")
