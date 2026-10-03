import { onBeforeUnmount, onMounted } from "vue";

// Keeps a screen current while it's open: runs `check` every `ms` while the tab is visible,
// and as soon as someone comes back to the tab.
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
	onMounted(() => {
		timer = setInterval(run, ms);
		document.addEventListener("visibilitychange", run);
	});
	onBeforeUnmount(() => {
		clearInterval(timer);
		document.removeEventListener("visibilitychange", run);
	});
}
