import { call } from "frappe-ui";

// Thin wrappers over Frappe's standard endpoints. The new UI never bypasses
// server-side permissions or validation: every read and write goes through
// the same methods the classic desk uses.

const metaCache = new Map();

export async function getMeta(doctype) {
	if (metaCache.has(doctype)) return metaCache.get(doctype);
	const res = await call("frappe.desk.form.load.getdoctype", { doctype, with_parent: 0 });
	const docs = res?.docs || res || [];
	const byName = Object.fromEntries(docs.map((d) => [d.name, d]));
	for (const d of docs) metaCache.set(d.name, { meta: d, byName });
	return metaCache.get(doctype);
}

// Synchronous access for code that can't await (desk scripts); undefined if not loaded yet.
export function metaFromCache(doctype) {
	return metaCache.get(doctype)?.meta;
}

export function listFields(meta) {
	const fields = (meta.fields || []).filter(
		(f) => f.in_list_view && !isLayout(f) && !isTable(f),
	);
	return fields.slice(0, 6);
}

export function titleField(meta) {
	return (
		meta.title_field ||
		(meta.fields || []).find((f) => f.fieldname === "employee_name")?.fieldname ||
		null
	);
}

export const isLayout = (f) =>
	["Section Break", "Column Break", "Tab Break", "HTML", "Heading", "Fold", "Button"].includes(
		f.fieldtype,
	);
export const isTable = (f) => ["Table", "Table MultiSelect"].includes(f.fieldtype);

export function getList(doctype, { fields, filters, orderBy, start = 0, pageLength = 30 } = {}) {
	return call("frappe.client.get_list", {
		doctype,
		fields,
		filters,
		order_by: orderBy,
		limit_start: start,
		limit_page_length: pageLength,
	});
}

export function getCount(doctype, filters) {
	return call("frappe.client.get_count", { doctype, filters });
}

export function getDoc(doctype, name) {
	return call("frappe.client.get", { doctype, name });
}

export function saveDoc(doc) {
	return call("frappe.client.save", { doc });
}

export function searchDoctypes(txt) {
	return call("frappe.client.get_list", {
		doctype: "DocType",
		filters: { istable: 0, name: ["like", `%${txt}%`] },
		fields: ["name", "module"],
		limit_page_length: 8,
		order_by: "name asc",
	});
}

export function searchEmployees(txt) {
	return call("frappe.client.get_list", {
		doctype: "Employee",
		filters: { status: "Active" },
		or_filters: { employee_name: ["like", `%${txt}%`], name: ["like", `%${txt}%`] },
		fields: ["name", "employee_name", "designation", "department"],
		limit_page_length: 6,
	});
}
