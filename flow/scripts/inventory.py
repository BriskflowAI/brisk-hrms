#!/usr/bin/env python3
"""Build the feature-parity inventory for the new UI.

Walks the hrms app and lists every user-facing capability the classic Desk
exposes: doctypes and their fields, form buttons, link filters, server calls,
dialogs, list/tree/calendar customisations, reports, dashboard charts, number
cards, print formats, workspaces, whitelisted methods and Desk overrides of
other apps' doctypes. The new UI is done when every item is ticked.

Usage: python3 flow/scripts/inventory.py  (from the repo root)
Writes flow/inventory/feature-inventory.{json,md}.
"""

import ast
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "hrms"
OUT = ROOT / "flow" / "inventory"

LAYOUT_FIELDS = {"Section Break", "Column Break", "Tab Break", "HTML", "Heading", "Fold"}

RE_BUTTON = re.compile(r"add_custom_button\(\s*__\(\s*([\"'`])(.+?)\1")
RE_QUERY = re.compile(r"set_query\(\s*[\"'](\w+)[\"']")
RE_CALL = re.compile(r"(?:method\s*:\s*|frappe\.xcall\(\s*|frappe\.call\(\s*)[\"']([\w.]+)[\"']")
RE_DIALOG = re.compile(r"new\s+frappe\.ui\.Dialog")


def rel(p):
	return str(p.relative_to(ROOT))


def load_json(p):
	try:
		data = json.loads(p.read_text())
	except Exception:
		return None
	return data if isinstance(data, dict) else None


def scan_js(text):
	return {
		"buttons": sorted({m[1] for m in RE_BUTTON.findall(text)}),
		"link_filters": sorted(set(RE_QUERY.findall(text))),
		"server_calls": sorted(set(RE_CALL.findall(text))),
		"dialogs": len(RE_DIALOG.findall(text)),
	}


def doctypes():
	out = []
	for p in sorted(APP.glob("**/doctype/*/*.json")):
		d = load_json(p)
		if not d or d.get("doctype") != "DocType" or p.stem != p.parent.name:
			continue
		fields = [f for f in d.get("fields", []) if f.get("fieldtype") not in LAYOUT_FIELDS]
		item = {
			"name": d["name"],
			"module": d.get("module"),
			"path": rel(p.parent),
			"child_table": bool(d.get("istable")),
			"single": bool(d.get("issingle")),
			"submittable": bool(d.get("is_submittable")),
			"tree": bool(d.get("is_tree")),
			"fields": len(fields),
			"required_fields": sum(1 for f in fields if f.get("reqd")),
			"child_tables": sorted(
				{
					f["options"]
					for f in fields
					if f.get("fieldtype") in ("Table", "Table MultiSelect") and f.get("options")
				}
			),
			"form_js": None,
			"views": [],
		}
		js = p.with_suffix(".js")
		if js.exists():
			item["form_js"] = scan_js(js.read_text())
		for suffix in ("list", "tree", "calendar", "kanban", "dashboard"):
			view = p.parent / f"{p.stem}_{suffix}.js"
			if view.exists():
				item["views"].append({"kind": suffix, **scan_js(view.read_text())})
		out.append(item)
	return out


def simple(glob, kind_key=None):
	out = []
	for p in sorted(APP.glob(glob)):
		d = load_json(p)
		if not d or p.stem != p.parent.name:
			continue
		row = {
			"name": d.get("name") or d.get("chart_name") or d.get("label"),
			"module": d.get("module"),
			"path": rel(p),
		}
		if kind_key:
			row["kind"] = d.get(kind_key)
		out.append(row)
	return out


def workspaces():
	out = []
	for p in sorted(APP.glob("*/workspace/*/*.json")):
		d = load_json(p)
		if not d:
			continue
		links = [l for l in d.get("links", []) if l.get("type") == "Link"]
		out.append(
			{
				"name": d.get("name"),
				"links": [
					{"label": l.get("label"), "type": l.get("link_type"), "to": l.get("link_to")}
					for l in links
				],
				"charts": [c.get("chart_name") for c in d.get("charts", [])],
				"number_cards": [c.get("number_card_name") for c in d.get("number_cards", [])],
			}
		)
	return out


def _is_whitelist(dec):
	target = dec.func if isinstance(dec, ast.Call) else dec
	return isinstance(target, ast.Attribute) and target.attr == "whitelist"


def whitelisted():
	out = []
	for p in sorted(APP.glob("**/*.py")):
		if "/tests/" in str(p) or p.name.startswith("test_"):
			continue
		try:
			tree = ast.parse(p.read_text())
		except SyntaxError:
			continue
		mod = ".".join(p.relative_to(ROOT).with_suffix("").parts)
		for node in ast.walk(tree):
			if isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef) and any(
				_is_whitelist(d) for d in node.decorator_list
			):
				out.append(f"{mod}.{node.name}")
	return sorted(set(out))


def other_scripts():
	"""Desk pages and shared scripts outside doctype folders."""
	out = []
	paths = sorted(APP.glob("**/page/*/*.js")) + sorted(
		p for p in (APP / "public" / "js").glob("**/*.js") if "erpnext" not in p.parts
	)
	for p in paths:
		info = scan_js(p.read_text())
		if any(info[k] for k in ("buttons", "link_filters", "server_calls", "dialogs")) or "/page/" in str(p):
			out.append({"path": rel(p), **info})
	return out


def hook_overrides():
	"""Desk scripts hrms injects into other apps' doctypes (ERPNext, Frappe)."""
	tree = ast.parse((APP / "hooks.py").read_text())
	result = {}
	for node in tree.body:
		if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
			name = node.targets[0].id
			if name in (
				"doctype_js",
				"doctype_list_js",
				"doctype_tree_js",
				"doctype_calendar_js",
				"doc_events",
				"override_doctype_class",
			):
				try:
					result[name] = sorted(ast.literal_eval(node.value).keys())
				except Exception:
					pass
	scripts = {}
	for dt in result.get("doctype_js", []):
		slug = dt.lower().replace(" ", "_")
		p = APP / "public" / "js" / "erpnext" / f"{slug}.js"
		if p.exists():
			scripts[dt] = scan_js(p.read_text())
	result["doctype_js_details"] = scripts
	return result


def build():
	data = {
		"doctypes": doctypes(),
		"reports": simple("**/report/*/*.json", "report_type"),
		"dashboard_charts": simple("**/dashboard_chart/*/*.json", "chart_type"),
		"number_cards": simple("**/number_card/*/*.json", "type"),
		"print_formats": simple("**/print_format/*/*.json", "print_format_type"),
		"web_forms": simple("**/web_form/*/*.json"),
		"workspaces": workspaces(),
		"whitelisted_methods": whitelisted(),
		"pages_and_shared_scripts": other_scripts(),
		"hook_overrides": hook_overrides(),
	}
	dts = data["doctypes"]
	data["totals"] = {
		"doctypes": len(dts),
		"child_tables": sum(d["child_table"] for d in dts),
		"submittable": sum(d["submittable"] for d in dts),
		"fields": sum(d["fields"] for d in dts),
		"form_buttons": sum(len(d["form_js"]["buttons"]) for d in dts if d["form_js"]),
		"link_filters": sum(len(d["form_js"]["link_filters"]) for d in dts if d["form_js"]),
		"form_server_calls": sum(len(d["form_js"]["server_calls"]) for d in dts if d["form_js"]),
		"dialogs": sum(d["form_js"]["dialogs"] for d in dts if d["form_js"]),
		"custom_views": sum(len(d["views"]) for d in dts),
		"reports": len(data["reports"]),
		"dashboard_charts": len(data["dashboard_charts"]),
		"number_cards": len(data["number_cards"]),
		"print_formats": len(data["print_formats"]),
		"workspace_links": sum(len(w["links"]) for w in data["workspaces"]),
		"whitelisted_methods": len(data["whitelisted_methods"]),
		"overridden_external_doctypes": len(data["hook_overrides"].get("doctype_js", [])),
		"pages_and_shared_scripts": len(data["pages_and_shared_scripts"]),
	}
	return data


def markdown(data):
	t = data["totals"]
	lines = [
		"# Feature inventory for the new UI",
		"",
		"Generated by `flow/scripts/inventory.py` from the hrms source. Do not edit by hand;",
		"re-run the script after every upstream merge and diff the result.",
		"",
		"Tick an item only when the new UI supports it and a browser test covers it.",
		"",
		"## Totals",
		"",
		"| Item | Count |",
		"|---|---|",
	]
	lines += [f"| {k.replace('_', ' ').capitalize()} | {v} |" for k, v in t.items()]

	by_module = defaultdict(list)
	for d in data["doctypes"]:
		by_module[d["module"]].append(d)
	lines += ["", "## Doctypes", ""]
	for module in sorted(by_module):
		lines += [f"### {module}", ""]
		for d in sorted(by_module[module], key=lambda x: x["name"]):
			flags = [
				f
				for f, on in (
					("child table", d["child_table"]),
					("single", d["single"]),
					("submittable", d["submittable"]),
					("tree", d["tree"]),
				)
				if on
			]
			flag = f" _({', '.join(flags)})_" if flags else ""
			lines.append(
				f"- [ ] **{d['name']}**{flag} · {d['fields']} fields, {d['required_fields']} required"
			)
			js = d["form_js"]
			if js:
				for b in js["buttons"]:
					lines.append(f"  - [ ] Button: {b}")
				for q in js["link_filters"]:
					lines.append(f"  - [ ] Link filter: `{q}`")
				for c in js["server_calls"]:
					lines.append(f"  - [ ] Server call: `{c}`")
				if js["dialogs"]:
					lines.append(f"  - [ ] Dialogs: {js['dialogs']}")
			for v in d["views"]:
				lines.append(f"  - [ ] {v['kind'].capitalize()} view customisation")
		lines.append("")

	ov = data["hook_overrides"]
	lines += ["## Behaviour added to other apps' doctypes", ""]
	for dt in ov.get("doctype_js", []):
		det = ov["doctype_js_details"].get(dt, {})
		lines.append(f"- [ ] **{dt}** form script")
		for b in det.get("buttons", []):
			lines.append(f"  - [ ] Button: {b}")
	for dt in ov.get("doctype_list_js", []):
		lines.append(f"- [ ] **{dt}** list script")
	lines.append("")

	for key, title in (
		("reports", "Reports"),
		("dashboard_charts", "Dashboard charts"),
		("number_cards", "Number cards"),
		("print_formats", "Print formats"),
		("web_forms", "Web forms"),
	):
		lines += [f"## {title}", ""]
		for r in data[key]:
			kind = f" · {r['kind']}" if r.get("kind") else ""
			lines.append(f"- [ ] {r['name']}{kind}")
		lines.append("")

	lines += ["## Desk pages and shared scripts", ""]
	for sc in data["pages_and_shared_scripts"]:
		lines.append(f"- [ ] `{sc['path']}`")
		for b in sc["buttons"]:
			lines.append(f"  - [ ] Button: {b}")
		for c in sc["server_calls"]:
			lines.append(f"  - [ ] Server call: `{c}`")
		if sc["dialogs"]:
			lines.append(f"  - [ ] Dialogs: {sc['dialogs']}")
	lines.append("")

	lines += ["## Workspaces (classic navigation to re-home)", ""]
	for w in data["workspaces"]:
		lines.append(f"- [ ] **{w['name']}** · {len(w['links'])} links")
		for l in w["links"]:
			lines.append(f"  - [ ] {l['label']} → {l['type']} `{l['to']}`")
	lines += [
		"",
		"## Whitelisted server methods",
		"",
		"Every one must be reachable from the new UI or confirmed as internal-only.",
		"",
	]
	lines += [f"- [ ] `{m}`" for m in data["whitelisted_methods"]]
	lines.append("")
	return "\n".join(lines)


if __name__ == "__main__":
	OUT.mkdir(parents=True, exist_ok=True)
	data = build()
	(OUT / "feature-inventory.json").write_text(json.dumps(data, indent=1, sort_keys=False) + "\n")
	(OUT / "feature-inventory.md").write_text(markdown(data))
	for k, v in data["totals"].items():
		print(f"{k:32} {v}")
