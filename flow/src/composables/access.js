import { call } from "frappe-ui";
import { computed, ref } from "vue";
import { areas } from "@/nav";

// What the signed-in user may open. Until it loads, every menu item shows; the server
// still checks each request, so this only keeps people from following dead ends.
const access = ref(null);
let loading = null;

export function loadAccess() {
	loading ||= call("hrms.briskrew.api.access")
		.then((res) => (access.value = res))
		.catch(() => {});
	return loading;
}

// Screens that aren't a single record type, and what they need to read.
const ROUTE_NEEDS = {
	"/people": "Employee",
	"/org-chart": "Employee",
	"/team-updates": "Employee",
	"/overview/people": "Employee",
	"/overview/time": "Leave Application",
	"/overview/pay": "Salary Slip",
	"/overview/expenses": "Expense Claim",
	"/overview/hiring": "Job Opening",
	"/overview/growth": "Appraisal",
	"/leave-policies": "Leave Policy",
};

export function canOpen(item) {
	const a = access.value;
	if (!a) return true;
	if (item.doctype) return a.can_read.includes(item.doctype);
	if (item.report) return a.reports.includes(item.report);
	if (item.route && ROUTE_NEEDS[item.route]) return a.can_read.includes(ROUTE_NEEDS[item.route]);
	return true;
}

export const canReadDoctype = (doctype) =>
	!access.value || access.value.can_read.includes(doctype);

export const visibleAreas = computed(() =>
	areas
		.map((area) => ({
			...area,
			sections: area.sections
				.map((s) => ({ ...s, items: s.items.filter(canOpen) }))
				// "All reports" alone isn't worth a section.
				.filter((s) => s.items.some((i) => !i.href)),
		}))
		.filter((area) => area.key === "home" || area.key === "inbox" || area.sections.length),
);
