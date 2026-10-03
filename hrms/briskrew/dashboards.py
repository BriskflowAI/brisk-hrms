"""Area overviews: Frappe HR's own number cards and dashboard charts, computed server-side so
briskrew can draw them. Values come from Frappe's card and chart logic, so they match the
classic desk dashboards."""

import frappe
from frappe import _
from frappe.utils import flt, getdate, nowdate, scrub

# Which of Frappe HR's dashboards (and extra cards/charts) make up each briskrew area.
AREAS = {
	"people": {
		"title": "People",
		"dashboards": ["Human Resource", "Employee Lifecycle"],
	},
	"time": {
		"title": "Time",
		"cards": [
			"Number of Employees on Leave (Today)",
			"Number of Employees on Leave (This Month)",
			"Holidays in this month",
		],
		"dashboards": ["Attendance"],
	},
	"pay": {"title": "Pay", "dashboards": ["Payroll"]},
	"expenses": {"title": "Expenses", "dashboards": ["Expense Claims"]},
	"hiring": {"title": "Hiring", "dashboards": ["Recruitment"]},
	"growth": {
		"title": "Growth",
		"cards": ["Trainings (This Month)", "Promotions (This Month)"],
		"charts": ["Appraisal Overview", "Training Type", "Y-O-Y Promotions"],
	},
}


@frappe.whitelist()
def get_overview(area: str, company: str | None = None) -> dict:
	if area not in AREAS:
		frappe.throw(_("Unknown area {0}").format(area))
	# Every card and chart is scoped to one company, shown and switchable on screen.
	frappe.local.briskrew_company = company or None
	conf = AREAS[area]
	cards, charts = list(conf.get("cards", [])), list(conf.get("charts", []))
	for name in conf.get("dashboards", []):
		if frappe.db.exists("Dashboard", name):
			dash = frappe.get_doc("Dashboard", name)
			cards += [c.card for c in dash.cards]
			charts += [c.chart for c in dash.charts]
	cards, charts = list(dict.fromkeys(cards)), list(dict.fromkeys(charts))
	return {
		"area": area,
		"title": _(conf["title"]),
		"company": _default_company(),
		# The picker only offers companies this user may read; without access there's no picker.
		"companies": frappe.get_list("Company", pluck="name", order_by="name asc", limit=100)
		if frappe.has_permission("Company", "read")
		else [],
		"cards": [_card(n) for n in cards if frappe.db.exists("Number Card", n)],
		"charts": [_chart(n) for n in charts if frappe.db.exists("Dashboard Chart", n)],
	}


# ---------------------------------------------------------------------------------------
# Number cards
# ---------------------------------------------------------------------------------------


def _card(name):
	doc = frappe.get_doc("Number Card", name)
	out = {
		"name": doc.name,
		"label": _(doc.label or doc.name),
		"doctype": doc.document_type,
		"function": doc.function,
		"value": None,
		"change": None,
		"interval": doc.stats_time_interval,
		"filters": [],
		"currency": None,
	}
	try:
		if doc.type == "Custom":
			res = frappe.get_attr(doc.method)()
			if isinstance(res, dict):
				out["value"] = flt(res.get("value"))
				out["fieldtype"] = res.get("fieldtype")
				out["route"] = res.get("route")
			else:
				out["value"] = flt(res)
		else:
			if not frappe.has_permission(doc.document_type, "read"):
				return {**out, "error": _("No access")}
			from frappe.desk.doctype.number_card.number_card import (
				get_percentage_difference,
				get_result,
			)

			filters = _filters(doc.filters_json, doc.dynamic_filters_json, doc.document_type)
			out["filters"] = filters
			out["value"] = get_result(doc.as_dict(), list(filters))
			if doc.show_percentage_stats:
				out["change"] = get_percentage_difference(doc.as_dict(), list(filters), out["value"])
			if doc.function != "Count" and doc.aggregate_function_based_on:
				df = frappe.get_meta(doc.document_type).get_field(doc.aggregate_function_based_on)
				if df and df.fieldtype == "Currency":
					out["currency"] = frappe.db.get_default("currency")
	except Exception as e:
		out["error"] = _message(e)
	return out


# ---------------------------------------------------------------------------------------
# Charts
# ---------------------------------------------------------------------------------------


def _chart(name):
	chart = frappe.get_doc("Dashboard Chart", name)
	out = {
		"name": chart.name,
		"label": _(chart.chart_name or chart.name),
		"type": chart.type,
		"chart_type": chart.chart_type,
		"doctype": chart.document_type,
		"report": chart.report_name,
		"group_by": chart.group_by_based_on,
		"labels": [],
		"datasets": [],
	}
	try:
		if chart.chart_type == "Report":
			data = _report_chart(chart)
		elif chart.chart_type == "Custom":
			data = _custom_chart(chart)
		else:
			if chart.document_type and not frappe.has_permission(chart.document_type, "read"):
				return {**out, "error": _("No access")}
			from frappe.desk.doctype.dashboard_chart.dashboard_chart import get

			filters = _filters(chart.filters_json, chart.dynamic_filters_json, chart.document_type)
			data = get(chart_name=chart.name, filters=filters, refresh=1)
			out["filters"] = filters
		out["labels"] = [str(x) for x in (data or {}).get("labels") or []]
		out["datasets"] = [
			{"name": d.get("name") or out["label"], "values": [flt(v) for v in d.get("values") or []]}
			for d in (data or {}).get("datasets") or []
		]
	except Exception as e:
		out["error"] = _message(e)
	return out


def _report_chart(chart):
	from frappe.desk.query_report import run

	filters = frappe.parse_json(chart.filters_json or "{}") or {}
	if isinstance(filters, list):
		filters = {}
	for key, expr in (frappe.parse_json(chart.dynamic_filters_json or "{}") or {}).items():
		value = _dynamic(expr)
		if value is not None:
			filters[key] = value
	# Saved company names are often from the site the chart was made on; use the user's.
	if "company" in filters or chart.report_name == "Appraisal Overview":
		filters["company"] = _default_company()
	res = run(chart.report_name, filters=filters)
	if chart.use_report_chart and res.get("chart"):
		return res["chart"].get("data") or {}
	# Otherwise build it from the report's rows: x_field against each y-axis field.
	rows = res.get("result") or []
	y_fields = [y.y_field for y in chart.y_axis]
	labels, datasets = [], {f: [] for f in y_fields}
	for row in rows:
		if isinstance(row, dict) and chart.x_field in row:
			labels.append(row[chart.x_field])
			for f in y_fields:
				datasets[f].append(row.get(f))
	return {"labels": labels, "datasets": [{"name": f, "values": v} for f, v in datasets.items()]}


def _custom_chart(chart):
	source = frappe.get_doc("Dashboard Chart Source", chart.source)
	module = scrub(source.module)
	app = frappe.local.module_app.get(module)
	method = f"{app}.{module}.dashboard_chart_source.{scrub(source.name)}.{scrub(source.name)}.get_data"
	filters = frappe.parse_json(chart.filters_json or "{}") or {}
	for key, expr in (frappe.parse_json(chart.dynamic_filters_json or "{}") or {}).items():
		value = _dynamic(expr)
		if value is not None:
			filters[key] = value
	return frappe.get_attr(method)(chart_name=chart.name, filters=frappe.as_json(filters), refresh=1)


# ---------------------------------------------------------------------------------------
# Filters
# ---------------------------------------------------------------------------------------


def _filters(filters_json, dynamic_json, doctype):
	"""A card's or chart's saved filters plus its dynamic ones, evaluated for this user."""
	filters = frappe.parse_json(filters_json or "[]") or []
	if isinstance(filters, dict):
		filters = [[doctype, k, "=", v] for k, v in filters.items()]
	dynamic = frappe.parse_json(dynamic_json or "[]") or []
	if isinstance(dynamic, dict):
		dynamic = [[doctype, k, "=", v] for k, v in dynamic.items()]
	for row in dynamic:
		value = _dynamic(row[-1])
		if value is not None:
			filters.append([*row[:-1], value])
	return filters


def _dynamic(expr):
	"""Evaluate the JavaScript expressions the desk uses in dynamic filters. Unknown ones are skipped."""
	expr = str(expr or "").strip().rstrip(";").replace("'", '"')
	today = getdate(nowdate())
	known = {
		'frappe.defaults.get_user_default("Company")': _default_company,
		'frappe.defaults.get_user_default("year_start_date")': lambda: _fiscal_year()[0],
		'frappe.defaults.get_user_default("year_end_date")': lambda: _fiscal_year()[1],
		"frappe.datetime.get_today()": lambda: str(today),
		"frappe.datetime.nowdate()": lambda: str(today),
		"frappe.datetime.str_to_obj(frappe.datetime.get_today()).getFullYear()": lambda: str(today.year),
		"frappe.datetime.str_to_obj(frappe.datetime.get_today()).getMonth() + 1": lambda: str(today.month),
	}
	fn = known.get(expr)
	return (fn() or None) if fn else None


def _default_company():
	"""The company chosen on screen, else the user's default, else their own employee record's,
	else the site default, else the one most active employees work for."""
	company = (
		getattr(frappe.local, "briskrew_company", None)
		or frappe.defaults.get_user_default("Company")
		or frappe.db.get_value("Employee", {"user_id": frappe.session.user}, "company")
		or frappe.db.get_single_value("Global Defaults", "default_company")
	)
	if not company:
		top = frappe.get_all(
			"Employee",
			filters={"status": "Active"},
			fields=["company", {"COUNT": "*", "as": "n"}],
			group_by="company",
			order_by="n desc",
			limit=1,
		)
		company = top[0].company if top else frappe.db.get_value("Company", {}, "name")
	return company


def _fiscal_year():
	try:
		from erpnext.accounts.utils import get_fiscal_year

		fy = get_fiscal_year(nowdate(), company=_default_company())
		return str(fy[1]), str(fy[2])
	except Exception:
		today = getdate(nowdate())
		return f"{today.year}-01-01", f"{today.year}-12-31"


def _message(e):
	frappe.clear_messages()
	return frappe.utils.strip_html(str(e)) or _("Couldn't load this.")
