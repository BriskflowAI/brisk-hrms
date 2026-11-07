import frappe


def execute():
	hr_modules = frappe.get_all("Module Def", filters={"app_name": "hrms"}, pluck="name")
	checklists = frappe.get_all("Module Onboarding", filters={"module": ["in", hr_modules]}, pluck="name")
	if not checklists:
		return

	steps = frappe.get_all("Onboarding Step Map", filters={"parent": ["in", checklists]}, pluck="step")
	for name in checklists:
		frappe.delete_doc("Module Onboarding", name, force=True, ignore_permissions=True)

	still_used = set(frappe.get_all("Onboarding Step Map", filters={"step": ["in", steps]}, pluck="step"))
	for step in set(steps) - still_used:
		frappe.delete_doc("Onboarding Step", step, force=True, ignore_permissions=True)
