"""Each person's arrangement of the cards on the Home screen."""

import json

import frappe

HOME_CARDS = ("checkin", "week", "waiting", "payroll", "headcount")
DEFAULT_KEY = "briskrew_home_layout"


@frappe.whitelist()
def get_home_layout() -> dict:
	raw = frappe.defaults.get_user_default(DEFAULT_KEY)
	try:
		stored = json.loads(raw) if raw else {}
	except ValueError:
		stored = {}
	return _clean(stored.get("order"), stored.get("hidden"))


@frappe.whitelist(methods=["POST"])
def save_home_layout(order: str | list, hidden: str | list | None = None) -> dict:
	layout = _clean(_as_list(order), _as_list(hidden))
	frappe.defaults.set_user_default(DEFAULT_KEY, json.dumps(layout))
	return layout


def _as_list(value) -> list:
	if isinstance(value, str):
		value = frappe.parse_json(value)
	return value if isinstance(value, list) else []


def _clean(order, hidden) -> dict:
	"""Known cards only, each once; cards added to Home after the layout was saved go last."""
	known = [card for card in dict.fromkeys(order or []) if card in HOME_CARDS]
	order = known + [card for card in HOME_CARDS if card not in known]
	hidden = [card for card in dict.fromkeys(hidden or []) if card in HOME_CARDS]
	return {"order": order, "hidden": hidden}
