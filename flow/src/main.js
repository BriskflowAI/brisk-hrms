import "@fontsource-variable/geist";
import "./index.css";

import { createApp } from "vue";
import { setConfig, frappeRequest, resourcesPlugin } from "frappe-ui";

import App from "./App.vue";
import router from "./router";

setConfig("resourceFetcher", frappeRequest);

createApp(App).use(router).use(resourcesPlugin).mount("#app");
