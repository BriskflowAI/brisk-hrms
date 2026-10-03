import "@fontsource-variable/geist";
import "./index.css";

import { createApp } from "vue";
import { setConfig, frappeRequest, resourcesPlugin } from "frappe-ui";

import App from "./App.vue";
import router from "./router";
import { __ } from "./composables/i18n";

setConfig("resourceFetcher", frappeRequest);

const app = createApp(App).use(router).use(resourcesPlugin);
// __("…") in every template: Frappe translations for the user's language.
app.config.globalProperties.__ = __;
app.mount("#app");
