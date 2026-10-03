import { call } from "frappe-ui";

// Events for a record type's desk calendar (or Gantt) between two dates. Most events methods take
// filters as JSON text; a few insist on a list, so a type error retries with one.
export async function fetchEvents({ doctype, settings, start, end, filters }) {
	const method = settings.get_events_method || "frappe.desk.calendar.get_events";
	const args = {
		doctype,
		start,
		end,
		filters: JSON.stringify(filters),
		field_map: JSON.stringify(settings.field_map || {}),
	};
	try {
		return (await call(method, args)) || [];
	} catch (e) {
		const text = [e?.exc, e?.message, ...(e?.messages || [])].join(" ");
		if (!/should be of type '[^']*list/.test(text)) throw e;
		return (await call(method, { ...args, filters })) || [];
	}
}
