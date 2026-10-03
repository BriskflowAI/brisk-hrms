import { createRouter, createWebHistory } from "vue-router";

const routes = [
	{ path: "/", name: "Home", component: () => import("@/views/Home.vue") },
	{ path: "/people", name: "People", component: () => import("@/views/People.vue") },
	{
		path: "/payroll/:name",
		name: "PayrollReview",
		component: () => import("@/views/PayrollReview.vue"),
		props: true,
	},
	{
		path: "/overview/:area",
		name: "Overview",
		component: () => import("@/views/Overview.vue"),
		props: true,
	},
	{
		path: "/leave-policies",
		name: "LeavePolicies",
		component: () => import("@/views/LeavePolicies.vue"),
	},
	{ path: "/org-chart", name: "OrgChart", component: () => import("@/views/OrgChart.vue") },
	{
		path: "/team-updates",
		name: "TeamUpdates",
		component: () => import("@/views/TeamUpdates.vue"),
	},
	{ path: "/inbox", name: "Inbox", component: () => import("@/views/Inbox.vue") },
	{
		path: "/report/:name",
		name: "Report",
		component: () => import("@/views/ReportView.vue"),
		props: true,
	},
	{ path: "/about", name: "About", component: () => import("@/views/About.vue") },
	{
		path: "/r/:doctype",
		name: "List",
		component: () => import("@/views/DocList.vue"),
		props: true,
	},
	{
		path: "/r/:doctype/:name",
		name: "Form",
		component: () => import("@/views/DocForm.vue"),
		props: true,
	},
	{
		path: "/:pathMatch(.*)*",
		name: "NotFound",
		component: () => import("@/views/NotFound.vue"),
	},
];

const router = createRouter({
	history: createWebHistory("/flow"),
	routes,
});

router.beforeEach((to) => {
	// Guests go to Frappe's login page and come back here afterwards.
	const loggedIn = document.cookie
		.split("; ")
		.some((c) => c.startsWith("user_id=") && !c.endsWith("=Guest"));
	if (!loggedIn) {
		window.location.href = `/login?redirect-to=${encodeURIComponent("/flow" + to.fullPath)}`;
		return false;
	}
});

export default router;
