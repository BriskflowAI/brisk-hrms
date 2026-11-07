<template>
	<div
		v-if="shown"
		role="progressbar"
		:aria-label="__('Loading page')"
		class="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] overflow-hidden bg-acc-tint"
	>
		<div class="route-progress-bar h-full w-1/3 bg-acc" />
	</div>
</template>

<script setup>
import { onBeforeUnmount, ref, watch } from "vue";
import { navigating } from "@/router";

// Fast navigations finish before the bar would be noticed; showing it anyway reads as a flicker.
const SHOW_AFTER_MS = 120;

const shown = ref(false);
let timer = null;

watch(navigating, (busy) => {
	clearTimeout(timer);
	if (busy) timer = setTimeout(() => (shown.value = true), SHOW_AFTER_MS);
	else shown.value = false;
});

onBeforeUnmount(() => clearTimeout(timer));
</script>

<style scoped>
.route-progress-bar {
	animation: route-progress 1.1s ease-in-out infinite;
}

@keyframes route-progress {
	from {
		transform: translateX(-100%);
	}
	to {
		transform: translateX(300%);
	}
}
</style>
