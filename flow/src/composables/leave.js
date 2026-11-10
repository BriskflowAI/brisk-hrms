import { call } from "frappe-ui";
import { qty } from "@/composables/format";
import { __ } from "@/composables/i18n";

export const M = "hrms.briskrew.my_leave";

export const loadSummary = (period) => call(`${M}.summary`, period || {});

const asDate = (d) => new Date(String(d).slice(0, 10) + "T00:00:00");

// "2026-10-12", in local time (toISOString would shift the day east of UTC).
export const iso = (d) => isoOf(d instanceof Date ? d : asDate(d));
function isoOf(x) {
	const p = (n) => String(n).padStart(2, "0");
	return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
}

// "12 Oct, Mon"
export const dayLabel = (d) =>
	asDate(d).toLocaleDateString(undefined, { day: "2-digit", month: "short", weekday: "short" });

// "01-Jan-2026"
export const periodDate = (d) => {
	const x = asDate(d);
	const mon = x.toLocaleDateString(undefined, { month: "short" });
	return `${String(x.getDate()).padStart(2, "0")}-${mon}-${x.getFullYear()}`;
};

export const days = (n) => `${qty(n)} ${Number(n) === 1 ? __("day") : __("days")}`;

export const isBefore = (a, b) => String(a).slice(0, 10) < String(b).slice(0, 10);

// The same period one step earlier or later, keeping its length (a leave year, usually).
export function shiftPeriod({ from_date, to_date }, step) {
	const from = asDate(from_date);
	const to = asDate(to_date);
	const months =
		(to.getFullYear() - from.getFullYear()) * 12 + to.getMonth() - from.getMonth() + 1;
	const f = new Date(from.getFullYear(), from.getMonth() + step * months, from.getDate());
	const t = new Date(f.getFullYear(), f.getMonth() + months, f.getDate() - 1);
	return { from_date: isoOf(f), to_date: isoOf(t) };
}

// Frappe calls an undecided request "Open"; people read it as "Pending".
export function requestStatus(r) {
	if (r.docstatus === 2 || r.status === "Cancelled") return "Cancelled";
	if (r.status === "Open") return "Pending";
	return r.status;
}

export const STATUS_TONE = {
	Pending: "bg-warn-tint text-warn",
	Approved: "bg-pos-tint text-pos",
	Rejected: "bg-neg-tint text-neg",
	Cancelled: "bg-line-2 text-mut",
};
