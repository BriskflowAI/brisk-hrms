"""Sample stock and assets for trying briskrew's Stock and Assets areas on a test site.

Run on a test site only (never production), after the HR demo or on any site with a company:
    bench --site <site> execute hrms.briskrew.demo_inventory.seed --kwargs "{'company': '<Company>'}"

Creates items (plain, serial-numbered and batch-tracked), a supplier and a customer, stock
received, moved and delivered, a material request, a stock count, and fixed assets with
depreciation, a movement, a maintenance plan and a repair. Safe to re-run: existing demo
records are reused and stock is only received once.
"""

import frappe
from frappe import _
from frappe.utils import add_days, add_months, get_first_day, getdate, nowdate

from hrms.briskrew.demo import _insert

SUPPLIER = "Brisk Office Supplies"
CUSTOMER = "Northwind Studio"
ITEM_GROUP = "briskrew Demo"
# code, name, uom, rate, kind ("stock", "serial", "batch", "asset")
ITEMS = [
	("BR-CHAIR", "Ergonomic Chair", "Nos", 180, "stock"),
	("BR-DESK", "Standing Desk", "Nos", 420, "stock"),
	("BR-PAPER", "A4 Paper (box)", "Nos", 24, "batch"),
	("BR-INK", "Printer Ink Cartridge", "Nos", 35, "stock"),
	("BR-MONITOR", "27-inch Monitor", "Nos", 260, "serial"),
	("BR-LAPTOP", "Laptop 14-inch", "Nos", 1400, "asset"),
]


def seed(company: str | None = None) -> dict:
	if not frappe.conf.developer_mode and not frappe.flags.in_test:
		frappe.throw(_("Demo data is for test sites only. Enable developer_mode on the site first."))

	company = company or frappe.db.get_value("Company", {}, "name")
	if not company:
		frappe.throw(_("Create a company first (finish the setup wizard)."))

	# Serial and batch tracking, entered on the rows themselves (as most small teams do).
	# Saved through the document so the settings reach desk scripts as defaults too.
	settings = frappe.get_single("Stock Settings")
	settings.enable_serial_and_batch_no_for_item = 1
	settings.use_serial_batch_fields = 1
	settings.save()
	co = frappe.get_cached_doc("Company", company)
	stores = _warehouse(company, "Stores")
	showroom = _warehouse(company, "briskrew Showroom")
	_item_group()
	category = _asset_category(co)
	for code, name, uom, rate, kind in ITEMS:
		_item(code, name, uom, rate, kind, category)
	_reorder_level("BR-INK", stores, level=60, qty=40)
	supplier = _party("Supplier", SUPPLIER)
	customer = _party("Customer", CUSTOMER)
	today = getdate(nowdate())

	docs = {}
	if not frappe.db.exists("Purchase Receipt", {"supplier": supplier, "company": company, "docstatus": 1}):
		docs["purchase_receipt"] = _purchase_receipt(company, supplier, stores, today)
		docs["transfer"] = _transfer(company, stores, showroom, today)
		docs["issue"] = _issue(company, stores, today)
		docs["delivery_note"] = _delivery_note(company, customer, showroom, today)
		docs["stock_count"] = _stock_count(company, stores, today)
	docs["material_request"] = _material_request(company, stores, today)
	docs["assets"] = _assets(co, category, today)

	if not frappe.flags.in_test:
		frappe.db.commit()  # nosemgrep
	return docs


def _warehouse(company, name):
	abbr = frappe.get_cached_value("Company", company, "abbr")
	full = f"{name} - {abbr}"
	if not frappe.db.exists("Warehouse", full):
		parent = frappe.db.get_value("Warehouse", {"company": company, "is_group": 1}, "name")
		frappe.get_doc(
			{"doctype": "Warehouse", "warehouse_name": name, "company": company, "parent_warehouse": parent}
		).insert(ignore_permissions=True)
	return full


def _item_group():
	if not frappe.db.exists("Item Group", ITEM_GROUP):
		frappe.get_doc(
			{"doctype": "Item Group", "item_group_name": ITEM_GROUP, "parent_item_group": "All Item Groups"}
		).insert(ignore_permissions=True)


def _asset_category(co):
	name = "Office IT Equipment"
	if not frappe.db.exists("Asset Category", name):
		fixed = frappe.db.get_value(
			"Account", {"company": co.name, "account_type": "Fixed Asset", "is_group": 0}, "name"
		)
		frappe.get_doc(
			{
				"doctype": "Asset Category",
				"asset_category_name": name,
				"accounts": [
					{
						"company_name": co.name,
						"fixed_asset_account": fixed,
						"accumulated_depreciation_account": co.accumulated_depreciation_account,
						"depreciation_expense_account": co.depreciation_expense_account,
					}
				],
				"finance_books": [
					{
						"depreciation_method": "Straight Line",
						"total_number_of_depreciations": 36,
						"frequency_of_depreciation": 1,
					}
				],
			}
		).insert(ignore_permissions=True)
	return name


def _item(code, name, uom, rate, kind, category):
	if frappe.db.exists("Item", code):
		return code
	doc = {
		"doctype": "Item",
		"item_code": code,
		"item_name": name,
		"item_group": ITEM_GROUP,
		"stock_uom": uom,
		"valuation_rate": rate,
		"standard_rate": rate,
		"is_stock_item": 0 if kind == "asset" else 1,
		"safety_stock": 10 if code == "BR-INK" else 0,
	}
	if kind == "serial":
		doc.update({"has_serial_no": 1, "serial_no_series": "BRMON-.####"})
	if kind == "batch":
		doc.update({"has_batch_no": 1, "create_new_batch": 1, "batch_number_series": "BRPAP-.####"})
	if kind == "asset":
		doc.update({"is_fixed_asset": 1, "asset_category": category, "auto_create_assets": 0})
	frappe.get_doc(doc).insert(ignore_permissions=True)
	return code


def _reorder_level(item_code, warehouse, level, qty):
	"""So the stock screens have something to flag for reordering."""
	item = frappe.get_doc("Item", item_code)
	if any(r.warehouse == warehouse for r in item.reorder_levels):
		return
	item.append(
		"reorder_levels",
		{
			"warehouse": warehouse,
			"warehouse_reorder_level": level,
			"warehouse_reorder_qty": qty,
			"material_request_type": "Purchase",
		},
	)
	item.save()


def _party(doctype, name):
	if not frappe.db.exists(doctype, name):
		field = "supplier_name" if doctype == "Supplier" else "customer_name"
		doc = {"doctype": doctype, field: name}
		if doctype == "Customer":
			doc["customer_type"] = "Company"
		frappe.get_doc(doc).insert(ignore_permissions=True)
	return name


def _rows(items, warehouse, field="warehouse"):
	return [{"item_code": code, "qty": qty, field: warehouse, **extra} for code, qty, extra in items]


def _purchase_receipt(company, supplier, warehouse, today):
	return _insert(
		{
			"doctype": "Purchase Receipt",
			"company": company,
			"supplier": supplier,
			"posting_date": add_days(today, -20),
			"set_posting_time": 1,
			"set_warehouse": warehouse,
			"items": [
				{"item_code": "BR-CHAIR", "qty": 24, "rate": 180},
				{"item_code": "BR-DESK", "qty": 12, "rate": 420},
				{"item_code": "BR-PAPER", "qty": 60, "rate": 24},
				{"item_code": "BR-INK", "qty": 30, "rate": 35},
				{"item_code": "BR-MONITOR", "qty": 6, "rate": 260},
			],
		},
		submit=True,
	)


def _transfer(company, source, target, today):
	return _insert(
		{
			"doctype": "Stock Entry",
			"stock_entry_type": "Material Transfer",
			"company": company,
			"posting_date": add_days(today, -12),
			"set_posting_time": 1,
			"items": [
				{"item_code": "BR-CHAIR", "qty": 6, "s_warehouse": source, "t_warehouse": target},
				{"item_code": "BR-DESK", "qty": 3, "s_warehouse": source, "t_warehouse": target},
			],
		},
		submit=True,
	)


def _issue(company, source, today):
	return _insert(
		{
			"doctype": "Stock Entry",
			"stock_entry_type": "Material Issue",
			"company": company,
			"posting_date": add_days(today, -5),
			"set_posting_time": 1,
			"items": [{"item_code": "BR-INK", "qty": 22, "s_warehouse": source}],
		},
		submit=True,
	)


def _delivery_note(company, customer, warehouse, today):
	return _insert(
		{
			"doctype": "Delivery Note",
			"company": company,
			"customer": customer,
			"posting_date": add_days(today, -3),
			"set_posting_time": 1,
			"set_warehouse": warehouse,
			"items": [
				{"item_code": "BR-CHAIR", "qty": 2, "rate": 260},
				{"item_code": "BR-DESK", "qty": 1, "rate": 590},
			],
		},
		submit=True,
	)


def _stock_count(company, warehouse, today):
	return _insert(
		{
			"doctype": "Stock Reconciliation",
			"company": company,
			"purpose": "Stock Reconciliation",
			"posting_date": add_days(today, -1),
			"set_posting_time": 1,
			"items": [{"item_code": "BR-CHAIR", "warehouse": warehouse, "qty": 17, "valuation_rate": 180}],
		},
		submit=True,
	)


def _material_request(company, warehouse, today):
	existing = frappe.db.get_value(
		"Material Request", {"company": company, "docstatus": 1, "material_request_type": "Purchase"}
	)
	if existing:
		return existing
	return _insert(
		{
			"doctype": "Material Request",
			"material_request_type": "Purchase",
			"company": company,
			"transaction_date": today,
			"schedule_date": add_days(today, 7),
			"set_warehouse": warehouse,
			"items": [
				{"item_code": "BR-INK", "qty": 40, "schedule_date": add_days(today, 7)},
				{"item_code": "BR-PAPER", "qty": 20, "schedule_date": add_days(today, 7)},
			],
		},
		submit=True,
	)


def _location(name):
	if not frappe.db.exists("Location", name):
		frappe.get_doc({"doctype": "Location", "location_name": name}).insert(ignore_permissions=True)
	return name


def _assets(co, category, today):
	head_office = _location("briskrew Head Office")
	studio = _location("briskrew Design Studio")
	start = get_first_day(add_months(today, -6))
	names = []
	for n in range(1, 4):
		asset_name = f"Laptop {n:02d}"
		existing = frappe.db.get_value("Asset", {"asset_name": asset_name, "company": co.name})
		if existing:
			names.append(existing)
			continue
		names.append(
			_insert(
				{
					"doctype": "Asset",
					"company": co.name,
					"item_code": "BR-LAPTOP",
					"asset_name": asset_name,
					"asset_category": category,
					"location": head_office,
					"is_existing_asset": 1,
					"purchase_date": start,
					"available_for_use_date": start,
					"net_purchase_amount": 1400,
					"purchase_amount": 1400,
					"gross_purchase_amount": 1400,
					"calculate_depreciation": 1,
					"finance_books": [
						{
							"depreciation_method": "Straight Line",
							"total_number_of_depreciations": 36,
							"frequency_of_depreciation": 1,
							"depreciation_start_date": add_months(start, 1),
						}
					],
				},
				submit=True,
			)
		)

	moved = frappe.db.exists("Asset Movement", {"company": co.name, "docstatus": 1})
	if not moved:
		_insert(
			{
				"doctype": "Asset Movement",
				"company": co.name,
				"purpose": "Transfer",
				"transaction_date": frappe.utils.now_datetime(),
				"assets": [{"asset": names[1], "source_location": head_office, "target_location": studio}],
			},
			submit=True,
		)

	team = "briskrew IT Team"
	# A real user: Administrator has no user record to assign tasks to.
	member = "lead@briskrew.demo" if frappe.db.exists("User", "lead@briskrew.demo") else frappe.session.user
	if not frappe.db.exists("Asset Maintenance Team", team):
		frappe.get_doc(
			{
				"doctype": "Asset Maintenance Team",
				"maintenance_team_name": team,
				"maintenance_manager": member,
				"company": co.name,
				"maintenance_team_members": [
					{"team_member": member, "maintenance_role": "Maintenance Manager"}
				],
			}
		).insert(ignore_permissions=True)
	if not frappe.db.exists("Asset Maintenance", names[0]):
		frappe.db.set_value("Asset", names[0], "maintenance_required", 1, update_modified=False)
		frappe.get_doc(
			{
				"doctype": "Asset Maintenance",
				"asset_name": names[0],
				"company": co.name,
				"maintenance_team": team,
				"asset_maintenance_tasks": [
					{
						"maintenance_task": "Battery check",
						"maintenance_type": "Preventive Maintenance",
						"maintenance_status": "Planned",
						"start_date": today,
						"periodicity": "Quarterly",
						"assign_to": member,
					}
				],
			}
		).insert(ignore_permissions=True)

	if not frappe.db.exists("Asset Repair", {"asset": names[2]}):
		_insert(
			{
				"doctype": "Asset Repair",
				"company": co.name,
				"asset": names[2],
				"failure_date": add_days(today, -2),
				"description": "Cracked screen hinge.",
				"repair_status": "Pending",
			}
		)
	return names
