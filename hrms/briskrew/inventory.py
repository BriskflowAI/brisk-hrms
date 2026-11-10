"""Stock and assets screens: stock levels, an item's page, and the asset register with each
asset's page.

Each endpoint reads only what the user may read (the same permissions as the classic desk) and
returns one payload per screen. Stock levels themselves come from ERPNext's own
erpnext.stock.dashboard.item_dashboard.get_data, as on the desk's Stock Summary page.
"""

import frappe
from frappe import _
from frappe.utils import flt, getdate, nowdate

SORTS = {"actual_qty", "projected_qty", "reserved_qty", "valuation_rate", "item_code", "warehouse"}

ASSET_FIELDS = [
	"name",
	"asset_name",
	"item_code",
	"item_name",
	"asset_category",
	"company",
	"location",
	"custodian",
	"department",
	"status",
	"image",
	"purchase_date",
	"available_for_use_date",
	"net_purchase_amount",
	"value_after_depreciation",
	"next_depreciation_date",
	"maintenance_required",
	"calculate_depreciation",
	"is_fully_depreciated",
	"docstatus",
]


@frappe.whitelist()
def stock_levels(
	warehouse: str | None = None,
	item_group: str | None = None,
	item_code: str | None = None,
	start: int = 0,
	sort_by: str = "actual_qty",
	sort_order: str = "desc",
) -> list:
	"""A page of stock by item and warehouse (ERPNext's own Stock Summary data, 21 rows at a time),
	with each row's reorder level so the screen can flag what needs ordering."""
	from erpnext.stock.dashboard.item_dashboard import get_data

	if sort_by not in SORTS:
		sort_by = "actual_qty"
	sort_order = "asc" if str(sort_order).lower() == "asc" else "desc"
	rows = get_data(
		item_code=item_code or None,
		warehouse=warehouse or None,
		item_group=item_group or None,
		start=frappe.utils.cint(start),
		sort_by=sort_by,
		sort_order=sort_order,
	)
	if not rows:
		return []
	levels = {
		(r.parent, r.warehouse): r
		for r in frappe.get_all(
			"Item Reorder",
			filters={"parent": ["in", list({r.item_code for r in rows})], "parenttype": "Item"},
			fields=["parent", "warehouse", "warehouse_reorder_level", "warehouse_reorder_qty"],
		)
	}
	for row in rows:
		level = levels.get((row.item_code, row.warehouse))
		row.reorder_level = flt(level.warehouse_reorder_level) if level else 0
		row.reorder_qty = flt(level.warehouse_reorder_qty) if level else 0
		row.below_reorder = bool(level and flt(row.projected_qty) < row.reorder_level)
	return rows


@frappe.whitelist()
def stock_summary(warehouse: str | None = None, item_group: str | None = None) -> dict:
	"""Headline numbers and filter choices for the stock levels screen."""
	if not frappe.has_permission("Bin", "read"):
		return {}
	filters = {"actual_qty": ["!=", 0]}
	if warehouse:
		filters["warehouse"] = warehouse
	if item_group:
		lft, rgt = frappe.db.get_value("Item Group", item_group, ["lft", "rgt"]) or (0, 0)
		groups = frappe.get_all("Item Group", filters={"lft": [">=", lft], "rgt": ["<=", rgt]}, pluck="name")
		filters["item_code"] = ["in", frappe.get_all("Item", {"item_group": ["in", groups]}, pluck="name")]
	bins = frappe.get_list("Bin", filters=filters, fields=["item_code", "warehouse", "stock_value"])
	levels = frappe.get_all(
		"Item Reorder",
		filters={"parenttype": "Item"},
		fields=["parent", "warehouse", "warehouse_reorder_level"],
	)
	below = 0
	if levels:
		level_of = {(r.parent, r.warehouse): flt(r.warehouse_reorder_level) for r in levels}
		reorder_filters = {k: v for k, v in filters.items() if k != "actual_qty"}
		reorder_filters.setdefault("item_code", ["in", list({r.parent for r in levels})])
		for b in frappe.get_list(
			"Bin", filters=reorder_filters, fields=["item_code", "warehouse", "projected_qty"]
		):
			if (b.item_code, b.warehouse) in level_of and flt(b.projected_qty) < level_of[
				(b.item_code, b.warehouse)
			]:
				below += 1
	return {
		"currency": _currency(),
		"stock_value": sum(flt(b.stock_value) for b in bins),
		"items": len({b.item_code for b in bins}),
		"warehouses": frappe.get_list(
			"Warehouse", filters={"is_group": 0, "disabled": 0}, pluck="name", order_by="name"
		),
		"item_groups": frappe.get_list("Item Group", pluck="name", order_by="lft"),
		"below_reorder": below,
		"open_requests": frappe.db.count(
			"Material Request", {"docstatus": 1, "status": ["in", ["Pending", "Partially Ordered"]]}
		)
		if frappe.has_permission("Material Request", "read")
		else None,
	}


@frappe.whitelist()
def item_profile(item_code: str) -> dict:
	"""An item's page: what it is, where it is and how much, what moved lately, what it costs."""
	item = frappe.get_doc("Item", item_code)
	item.check_permission("read")

	stock = []
	if frappe.has_permission("Bin", "read"):
		stock = frappe.get_list(
			"Bin",
			filters={"item_code": item_code},
			fields=[
				"warehouse",
				"actual_qty",
				"reserved_qty",
				"reserved_stock",
				"ordered_qty",
				"indented_qty",
				"planned_qty",
				"projected_qty",
				"valuation_rate",
				"stock_value",
			],
			order_by="actual_qty desc",
		)
	reorder = {r.warehouse: r for r in item.get("reorder_levels") or []}
	for row in stock:
		level = reorder.get(row.warehouse)
		row.reorder_level = flt(level.warehouse_reorder_level) if level else 0
		row.reorder_qty = flt(level.warehouse_reorder_qty) if level else 0
		row.below_reorder = bool(level and flt(row.projected_qty) < flt(level.warehouse_reorder_level))

	ledger = []
	if frappe.has_permission("Stock Ledger Entry", "read"):
		ledger = frappe.get_list(
			"Stock Ledger Entry",
			filters={"item_code": item_code, "is_cancelled": 0},
			fields=[
				"posting_date",
				"posting_time",
				"warehouse",
				"actual_qty",
				"qty_after_transaction",
				"voucher_type",
				"voucher_no",
				"valuation_rate",
			],
			order_by="posting_date desc, posting_time desc, creation desc",
			limit=12,
		)

	prices = []
	if frappe.has_permission("Item Price", "read"):
		prices = frappe.get_list(
			"Item Price",
			filters={"item_code": item_code},
			fields=["name", "price_list", "price_list_rate", "currency", "selling", "buying", "uom"],
			order_by="selling desc, price_list asc",
		)

	open_requests = 0
	if frappe.has_permission("Material Request", "read"):
		open_requests = len(
			frappe.get_list(
				"Material Request",
				filters=[
					["Material Request Item", "item_code", "=", item_code],
					["docstatus", "=", 1],
					[
						"status",
						"not in",
						["Stopped", "Cancelled", "Transferred", "Issued", "Received", "Ordered"],
					],
				],
				pluck="name",
				distinct=True,
			)
		)

	counts = {}
	if item.has_batch_no and frappe.has_permission("Batch", "read"):
		counts["batches"] = frappe.db.count("Batch", {"item": item_code, "disabled": 0})
	if item.has_serial_no and frappe.has_permission("Serial No", "read"):
		counts["serial_nos"] = frappe.db.count("Serial No", {"item_code": item_code, "status": "Active"})

	return {
		"item": {
			k: item.get(k)
			for k in (
				"name",
				"item_name",
				"item_group",
				"brand",
				"stock_uom",
				"description",
				"image",
				"disabled",
				"is_stock_item",
				"is_fixed_asset",
				"has_batch_no",
				"has_serial_no",
				"valuation_rate",
				"standard_rate",
				"safety_stock",
				"lead_time_days",
				"asset_category",
			)
		},
		"currency": _currency(),
		"stock": stock,
		"totals": {
			"actual_qty": sum(flt(r.actual_qty) for r in stock),
			"projected_qty": sum(flt(r.projected_qty) for r in stock),
			"reserved_qty": sum(flt(r.reserved_qty) + flt(r.reserved_stock) for r in stock),
			"stock_value": sum(flt(r.stock_value) for r in stock),
		},
		"ledger": ledger,
		"prices": prices,
		"open_requests": open_requests,
		"counts": counts,
	}


@frappe.whitelist()
def asset_register(
	company: str | None = None,
	asset_category: str | None = None,
	location: str | None = None,
	status: str | None = None,
	txt: str | None = None,
) -> dict:
	"""Every asset the user may read, with this month's book value and what's coming up."""
	if not frappe.has_permission("Asset", "read"):
		return {"currency": None, "assets": [], "summary": {}}
	filters = {"docstatus": ["<", 2]}
	for field, value in (
		("company", company),
		("asset_category", asset_category),
		("location", location),
		("status", status),
	):
		if value:
			filters[field] = value
	or_filters = None
	if txt:
		like = f"%{txt}%"
		or_filters = {"name": ["like", like], "asset_name": ["like", like], "item_code": ["like", like]}
	assets = frappe.get_list(
		"Asset",
		filters=filters,
		or_filters=or_filters,
		fields=ASSET_FIELDS,
		order_by="asset_name asc",
		limit=500,
	)
	names = [a.name for a in assets]
	due = _maintenance_due(names)
	next_dep = _next_depreciation(names)
	for a in assets:
		a.maintenance_due = due.get(a.name)
		a.next_depreciation_date = next_dep.get(a.name) or a.next_depreciation_date
	today = getdate(nowdate())
	return {
		"currency": _currency(company),
		"assets": assets,
		"summary": {
			"count": len(assets),
			"purchase_value": sum(flt(a.net_purchase_amount) for a in assets if a.docstatus == 1),
			"book_value": sum(flt(a.value_after_depreciation) for a in assets if a.docstatus == 1),
			"in_maintenance": sum(1 for a in assets if a.status in ("In Maintenance", "Out of Order")),
			"maintenance_due": sum(
				1 for a in assets if a.maintenance_due and getdate(a.maintenance_due) <= today
			),
			"drafts": sum(1 for a in assets if a.docstatus == 0),
		},
	}


@frappe.whitelist()
def asset_profile(name: str) -> dict:
	"""An asset's page: what it is and where, its value over time, its movements and its care."""
	asset = frappe.get_doc("Asset", name)
	asset.check_permission("read")
	next_dep = _next_depreciation([name]).get(name) or asset.get("next_depreciation_date")

	schedule = []
	if frappe.has_permission("Asset Depreciation Schedule", "read"):
		# ERPNext's own lookup of the asset's active schedule (default finance book).
		from erpnext.assets.doctype.asset_depreciation_schedule.asset_depreciation_schedule import (
			get_asset_depr_schedule_doc,
		)

		doc = get_asset_depr_schedule_doc(name, "Active")
		schedule = [
			{
				"schedule_date": r.schedule_date,
				"depreciation_amount": r.depreciation_amount,
				"accumulated_depreciation_amount": r.accumulated_depreciation_amount,
				"journal_entry": r.journal_entry,
			}
			for r in (doc.depreciation_schedule if doc else [])
		]

	movements = []
	if frappe.has_permission("Asset Movement", "read"):
		movements = frappe.get_list(
			"Asset Movement",
			filters=[["Asset Movement Item", "asset", "=", name], ["docstatus", "=", 1]],
			fields=[
				"name",
				"purpose",
				"transaction_date",
				"`tabAsset Movement Item`.source_location",
				"`tabAsset Movement Item`.target_location",
				"`tabAsset Movement Item`.from_employee",
				"`tabAsset Movement Item`.to_employee",
			],
			order_by="transaction_date desc",
			limit=20,
		)

	tasks = []
	if frappe.has_permission("Asset Maintenance", "read") and frappe.db.exists("Asset Maintenance", name):
		tasks = [
			{
				"maintenance_task": t.maintenance_task,
				"maintenance_type": t.maintenance_type,
				"maintenance_status": t.maintenance_status,
				"periodicity": t.periodicity,
				"next_due_date": t.next_due_date,
				"assign_to_name": t.assign_to_name,
			}
			for t in frappe.get_doc("Asset Maintenance", name).asset_maintenance_tasks
		]

	repairs = []
	if frappe.has_permission("Asset Repair", "read"):
		repairs = frappe.get_list(
			"Asset Repair",
			filters={"asset": name, "docstatus": ["<", 2]},
			fields=["name", "failure_date", "repair_status", "description", "repair_cost", "completion_date"],
			order_by="failure_date desc",
			limit=20,
		)

	return {
		"currency": _currency(asset.company),
		"asset": {
			**{k: asset.get(k) for k in ASSET_FIELDS},
			"next_depreciation_date": next_dep,
			"custodian_name": asset.custodian
			and frappe.db.get_value("Employee", asset.custodian, "employee_name"),
			"opening_accumulated_depreciation": asset.get("opening_accumulated_depreciation"),
			"total_number_of_depreciations": asset.get("total_number_of_depreciations"),
			"depreciation_method": asset.get("finance_books")[0].depreciation_method
			if asset.get("finance_books")
			else None,
		},
		"schedule": schedule,
		"movements": movements,
		"maintenance": tasks,
		"repairs": repairs,
	}


def _currency(company: str | None = None) -> str | None:
	"""The company's currency, else the user's default company's, else the site's."""
	company = company or frappe.defaults.get_user_default("company")
	return (
		company and frappe.get_cached_value("Company", company, "default_currency")
	) or frappe.db.get_default("currency")


def _next_depreciation(assets: list[str]) -> dict:
	"""Each asset's next depreciation still to book, from its active schedule."""
	if not assets or not frappe.has_permission("Asset Depreciation Schedule", "read"):
		return {}
	# The assets are ones the user may read; their schedules follow them.
	rows = frappe.db.sql(
		"""select ads.asset, min(ds.schedule_date)
		from `tabAsset Depreciation Schedule` ads
		join `tabDepreciation Schedule` ds on ds.parent = ads.name and ds.parenttype = 'Asset Depreciation Schedule'
		where ads.asset in %(assets)s and ads.docstatus = 1 and ads.status = 'Active'
			and ifnull(ds.journal_entry, '') = ''
		group by ads.asset""",
		{"assets": assets},
	)
	return dict(rows)


def _maintenance_due(assets: list[str]) -> dict:
	"""The next maintenance date of each asset that has a maintenance plan."""
	if not assets or not frappe.has_permission("Asset Maintenance", "read"):
		return {}
	rows = frappe.get_all(
		"Asset Maintenance Task",
		filters={"parent": ["in", assets], "parenttype": "Asset Maintenance"},
		fields=["parent", "next_due_date"],
	)
	due = {}
	for r in rows:
		if r.next_due_date and (r.parent not in due or getdate(r.next_due_date) < getdate(due[r.parent])):
			due[r.parent] = r.next_due_date
	return due


@frappe.whitelist()
def asset_filters() -> dict:
	"""Choices for the register's filters."""
	if not frappe.has_permission("Asset", "read"):
		return {}
	return {
		"categories": frappe.get_list("Asset Category", pluck="name", order_by="name"),
		"locations": frappe.get_list("Location", pluck="name", order_by="name"),
		"statuses": [
			_(s)
			for s in (
				"Draft",
				"Submitted",
				"Partially Depreciated",
				"Fully Depreciated",
				"Sold",
				"Scrapped",
				"In Maintenance",
				"Out of Order",
				"Issue",
				"Receipt",
				"Capitalized",
				"Work In Progress",
			)
		],
	}
