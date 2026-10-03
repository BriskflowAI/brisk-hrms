import { onBeforeUnmount, onMounted } from "vue";
import { connected } from "@/composables/realtime";

// Keeps a screen current while it's open: runs `check` every `ms` while the tab is visible and
// Frappe's realtime server isn't connected (when it is, its events call the returned function
// instead), and always as soon as someone comes back to the tab.
export function useLiveCheck(check, ms = 20_000) {
	let timer;
	let busy = false;
	const run = async () => {
		if (busy || document.visibilityState !== "visible") return;
		busy = true;
		try {
			await check();
		} catch {
			/* the next check tries again */
		} finally {
			busy = false;
		}
	};
	const tick = () => !connected.value && run();
	onMounted(() => {
		timer = setInterval(tick, ms);
		document.addEventListener("visibilitychange", run);
	});
	onBeforeUnmount(() => {
		clearInterval(timer);
		document.removeEventListener("visibilitychange", run);
	});
	return run;
}
