import "./index.css";

import { createApp } from "vue";
import { setConfig, frappeRequest, resourcesPlugin } from "frappe-ui";

import App from "./App.vue";
import router from "./router";

setConfig("resourceFetcher", frappeRequest);

async function start() {
	// Shareable previews answer from recorded data instead of a server (see demo/mock.js).
	if (import.meta.env.VITE_BRISKREW_DEMO) {
		const { installDemo } = await import("./demo/mock.js");
		await installDemo();
	}
	createApp(App).use(router).use(resourcesPlugin).mount("#app");
}

start();
