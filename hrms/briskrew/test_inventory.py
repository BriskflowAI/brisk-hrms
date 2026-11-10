import frappe
from frappe.utils import flt

from hrms.briskrew.api import boot
from hrms.briskrew.demo_inventory import seed
from hrms.briskrew.inventory import (
	asset_filters,
	asset_profile,
	asset_register,
	item_profile,
	stock_levels,
	stock_summary,
)
from hrms.tests.utils import HRMSTestSuite

COMPANY = "_Test Company"


class TestBriskrewInventory(HRMSTestSuite):
	def setUp(self):
		frappe.set_user("Administrator")
		self.addCleanup(frappe.set_user, "Administrator")
		# Each test rolls back, so each one seeds (the seed skips what already exists).
		self.docs = seed(COMPANY)
		self.stores = frappe.db.get_value("Warehouse", {"warehouse_name": "Stores", "company": COMPANY})

	def test_stock_levels_flag_what_needs_reordering(self):
		rows = stock_levels(item_code="BR-INK", warehouse=self.stores)
		self.assertEqual(len(rows), 1)
		ink = rows[0]
		self.assertEqual(ink.reorder_level, 60)
		self.assertTrue(ink.below_reorder)
		self.assertEqual(ink.stock_uom, "Nos")

	def test_stock_levels_ignore_unknown_sort(self):
		rows = stock_levels(warehouse=self.stores, sort_by="actual_qty; select 1", sort_order="sideways")
		qtys = [flt(r.actual_qty) for r in rows]
		self.assertEqual(qtys, sorted(qtys, reverse=True))

	def test_stock_summary(self):
		res = stock_summary()
		self.assertIn(self.stores, res["warehouses"])
		self.assertGreaterEqual(res["below_reorder"], 1)
		self.assertGreater(res["stock_value"], 0)
		self.assertTrue(res["currency"])

	def test_item_profile(self):
		res = item_profile("BR-INK")
		self.assertEqual(res["item"]["name"], "BR-INK")
		self.assertTrue(res["ledger"])
		self.assertTrue(any(r.below_reorder for r in res["stock"]))
		self.assertEqual(res["totals"]["actual_qty"], sum(flt(r.actual_qty) for r in res["stock"]))
		self.assertGreaterEqual(res["open_requests"], 1)

	def test_item_profile_counts_batches_and_serial_numbers(self):
		self.assertIn("batches", item_profile("BR-PAPER")["counts"])
		self.assertIn("serial_nos", item_profile("BR-MONITOR")["counts"])

	def test_asset_register(self):
		res = asset_register(company=COMPANY)
		names = {a.name for a in res["assets"]}
		self.assertTrue(set(self.docs["assets"]) <= names)
		self.assertGreater(res["summary"]["book_value"], 0)
		self.assertEqual(res["summary"]["count"], len(res["assets"]))

		laptop = frappe.db.get_value("Asset", self.docs["assets"][0], "asset_name")
		found = asset_register(company=COMPANY, txt=laptop)["assets"]
		self.assertIn(self.docs["assets"][0], [a.name for a in found])
		self.assertEqual(asset_register(company=COMPANY, status="Scrapped", txt=laptop)["assets"], [])

	def test_asset_profile(self):
		res = asset_profile(self.docs["assets"][0])
		self.assertTrue(res["schedule"])
		self.assertTrue(res["asset"]["next_depreciation_date"])
		self.assertTrue(res["movements"])
		self.assertIn("Office IT Equipment", asset_filters()["categories"])

	def test_screens_respect_permissions(self):
		frappe.set_user("Guest")
		self.assertRaises(frappe.PermissionError, item_profile, "BR-INK")
		self.assertRaises(frappe.PermissionError, asset_profile, self.docs["assets"][0])
		self.assertEqual(asset_register()["assets"], [])
		self.assertEqual(stock_levels(), [])

	def test_boot_carries_desk_lookups(self):
		desk = boot()["desk"]
		self.assertIn(":Company", {d["doctype"] for d in desk["docs"]})
		self.assertIsInstance(desk["user_permissions"], dict)
