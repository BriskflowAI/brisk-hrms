import frappe

OLD = "Frappe HR"
NEW = "briskrew"


def execute():
	if frappe.db.exists("Desktop Icon", OLD):
		if frappe.db.exists("Desktop Icon", NEW):
			frappe.delete_doc("Desktop Icon", OLD, force=True, ignore_permissions=True)
		else:
			frappe.rename_doc("Desktop Icon", OLD, NEW, force=True)

	frappe.db.set_value("Desktop Icon", {"parent_icon": OLD}, "parent_icon", NEW, update_modified=False)
	frappe.clear_cache()
