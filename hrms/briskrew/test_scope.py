import json
import os

import frappe

from hrms.briskrew.api import apps
from hrms.tests.utils import HRMSTestSuite

ICON_DIR = os.path.join(os.path.dirname(__file__), "..", "desktop_icon")


def _standard_icons() -> dict[str, dict]:
	icons = {}
	for file in os.listdir(ICON_DIR):
		if file.endswith(".json"):
			with open(os.path.join(ICON_DIR, file)) as f:
				doc = json.load(f)
			icons[doc["name"]] = doc
	return icons


class TestBriskrewScope(HRMSTestSuite):
	def test_every_erpnext_module_is_kept_out_of_navigation(self):
		erpnext_modules = set(frappe.get_all("Module Def", filters={"app_name": "erpnext"}, pluck="name"))
		code_only = set(frappe.get_hooks("code_only_modules"))

		self.assertEqual(
			erpnext_modules - code_only,
			set(),
			"New ERPNext modules must be added to code_only_modules in hrms/hooks.py",
		)

	def test_hr_modules_stay_in_navigation(self):
		hr_modules = set(frappe.get_all("Module Def", filters={"app_name": "hrms"}, pluck="name"))
		code_only = set(frappe.get_hooks("code_only_modules"))

		self.assertEqual(hr_modules & code_only - {"HR"}, set())

	def test_hidden_modules_hand_their_navigation_to_hr_setup(self):
		# ERPNext names its own heirs for some modules; those are hidden too, so HR Setup is
		# the only heir left that a user can navigate to.
		code_only_modules = frappe.get_hooks("code_only_modules")
		erpnext_modules = frappe.get_all("Module Def", filters={"app_name": "erpnext"}, pluck="name")
		for module in erpnext_modules:
			visible_heirs = [h for h in code_only_modules[module] if h not in code_only_modules]
			self.assertEqual(visible_heirs, ["HR Setup"], module)

	def test_app_switcher_lists_hr_only(self):
		frappe.set_user("Administrator")
		result = apps()

		self.assertLessEqual({g["app"] for g in result["groups"]}, {"hrms"})
		self.assertLessEqual({a["name"] for a in result["apps"]}, {"hrms", "briskrew"})

	def test_overviews_cover_hr_areas_only(self):
		from hrms.briskrew.dashboards import AREAS

		self.assertEqual(set(AREAS) & {"stock", "assets"}, set())

	def test_app_switcher_names_no_frappe_product(self):
		frappe.set_user("Administrator")
		titles = [g["title"] for g in apps()["groups"]] + [a["title"] for a in apps()["apps"]]

		for title in titles:
			self.assertNotIn("frappe", title.lower())

	def test_desktop_icons_carry_no_frappe_name(self):
		icons = _standard_icons()

		for name, doc in icons.items():
			self.assertNotIn("frappe", name.lower())
			self.assertNotIn("frappe", (doc.get("logo_url") or "").lower())
			parent = doc.get("parent_icon")
			if parent:
				self.assertIn(parent, icons, f"{name} points at a parent icon that does not exist")
