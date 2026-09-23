import { createRouter, createWebHistory } from "vue-router";

const routes = [
	{ path: "/", name: "Home", component: () => import("@/views/Home.vue") },
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
