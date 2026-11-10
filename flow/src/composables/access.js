import { call } from "frappe-ui";
import { computed, ref } from "vue";
import { allNavItems, areas, HR } from "@/nav";
import { loadTranslations } from "@/composables/i18n";

// What the signed-in user may open. Until it loads, every menu item shows; the server
// still checks each request, so this only keeps people from following dead ends.
const access = ref(null);
let loading = null;

export function loadAccess() {
	loading ||= call("hrms.briskrew.api.access")
		.then((res) => {
			access.value = res;
			return loadTranslations(res?.lang);
		})
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
	"/overview/attendance": "Attendance",
	"/overview/pay": "Salary Slip",
	"/overview/expenses": "Expense Claim",
	"/overview/hiring": "Job Opening",
	"/overview/growth": "Appraisal",
	"/leave-policies": "Leave Policy",
	"/leave": "Leave Application",
	"/leave/apply": "Leave Application",
	"/attendance": "Attendance",
	"/overview/stock": "Bin",
	"/stock-levels": "Bin",
	"/overview/assets": "Asset",
	"/asset-register": "Asset",
};

function hasRole(node) {
	const roles = access.value?.roles;
	return !node.roles || !roles || node.roles.some((role) => roles.includes(role));
}

export function canOpen(item) {
	const a = access.value;
	if (!a) return true;
	if (!hasRole(item)) return false;
	if (item.doctype) return a.can_read.includes(item.doctype);
	if (item.report) return a.reports.includes(item.report);
	if (item.route && ROUTE_NEEDS[item.route]) return a.can_read.includes(ROUTE_NEEDS[item.route]);
	return true;
}

export const canReadDoctype = (doctype) =>
	!access.value || access.value.can_read.includes(doctype);

export const visibleAreas = computed(() =>
	areas
		.filter((area) => !access.value || hasRole(area))
		.map((area) => ({
			...area,
			sections: area.sections
				.filter((s) => !access.value || hasRole(s))
				.map((s) => ({ ...s, items: s.items.filter(canOpen) }))
				// "All reports" alone isn't worth a section.
				.filter((s) => s.items.some((i) => !i.href)),
		}))
		.filter((area) => area.key === "home" || area.key === "inbox" || area.sections.length),
);

// Typing a URL must not get further than the menu would. A screen the menus list is open when any
// listing of it is; one they never list falls back to plain read access. Records (forms) follow
// read access alone, because People and the inbox link to colleagues' records that no menu lists.
export async function canVisit(to) {
	await loadAccess();
	if (!access.value) return true;
	const { name, params, path } = to;
	if (name === "Form") return canReadDoctype(params.doctype);
	if (name === "PayrollReview") return hasRole({ roles: HR });

	const listings = allNavItems();
	const match =
		name === "List"
			? (i) => i.doctype === params.doctype
			: name === "Report"
			  ? (i) => i.report === params.name
			  : (i) => i.route === path;
	const found = listings.filter(match);
	if (found.length) return found.some((i) => canOpen(i));

	const area = areas.find((a) => a.to === path);
	if (area) return hasRole(area);
	if (name === "List") return canReadDoctype(params.doctype);
	if (name === "Report") return access.value.reports.includes(params.name);
	if (ROUTE_NEEDS[path]) return canReadDoctype(ROUTE_NEEDS[path]);
	return true;
}
