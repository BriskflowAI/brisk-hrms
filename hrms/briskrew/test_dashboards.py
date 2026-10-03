import frappe
from frappe.utils import getdate, nowdate

from hrms.briskrew.dashboards import AREAS, _dynamic, _filters, get_overview
from hrms.tests.utils import HRMSTestSuite


class TestBriskrewDashboards(HRMSTestSuite):
	def setUp(self):
		frappe.set_user("Administrator")

	def test_every_area_loads_without_errors(self):
		for area in AREAS:
			res = get_overview(area)
			self.assertTrue(res["cards"] or res["charts"], area)
			errors = [x["label"] for x in res["cards"] + res["charts"] if x.get("error")]
			self.assertEqual(errors, [], f"{area}: {errors}")
			for chart in res["charts"]:
				for d in chart["datasets"]:
					self.assertEqual(len(d["values"]), len(chart["labels"]), chart["label"])

	def test_dynamic_filters(self):
		today = getdate(nowdate())
		self.assertEqual(_dynamic("frappe.datetime.get_today()"), str(today))
		self.assertEqual(
			_dynamic("frappe.datetime.str_to_obj(frappe.datetime.get_today()).getMonth() + 1"),
			str(today.month),
		)
		self.assertTrue(_dynamic('frappe.defaults.get_user_default("Company")'))
		self.assertIsNone(_dynamic("someUnknownFunction()"))

	def test_filters_merge_saved_and_dynamic(self):
		f = _filters(
			'[["Employee","status","=","Active"]]',
			'[["Employee","company","=","frappe.defaults.get_user_default(\\"Company\\")"]]',
			"Employee",
		)
		self.assertEqual(f[0], ["Employee", "status", "=", "Active"])
		self.assertEqual(f[1][:3], ["Employee", "company", "="])
		self.assertTrue(f[1][3])

	def test_unknown_area(self):
		self.assertRaises(frappe.ValidationError, get_overview, "nope")

	def test_cards_respect_permissions(self):
		frappe.set_user("Guest")
		res = get_overview("people")
		self.assertTrue(all(c.get("error") or c["value"] in (None, 0) for c in res["cards"] if c["doctype"]))
