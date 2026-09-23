<template>
	<svg
		:width="size"
		:height="size"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		:stroke-width="stroke"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
		v-html="paths[name] || paths.dot"
	/>
</template>

<script setup>
defineProps({
	name: { type: String, required: true },
	size: { type: [Number, String], default: 18 },
	stroke: { type: [Number, String], default: 1.7 },
});

const paths = {
	home: '<path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z"/>',
	inbox: '<path d="M3 13h5l2 3h4l2-3h5"/><path d="M5 5h14l2 8v6H3v-6z"/>',
	users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><path d="M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.8c1.8.8 3 2.6 3.5 5.2"/>',
	cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
	coins: '<ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3V7"/><path d="M9 15v2c0 1.7 2.7 3 6 3s6-1.3 6-3v-5c0-1.7-2.7-3-6-3"/>',
	receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
	door: '<path d="M5 21V4h11v17"/><path d="M3 21h18M13 12h.5"/>',
	spark: '<path d="M12 3v18M3 12h18M6 6l12 12M18 6 6 18"/>',
	chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
	gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
	search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
	plus: '<path d="M12 5v14M5 12h14"/>',
	bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
	ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>',
	collapse: '<path d="M11 17l-5-5 5-5M18 17l-5-5 5-5"/>',
	expand: '<path d="M13 17l5-5-5-5M6 17l5-5-5-5"/>',
	chev: '<path d="m6 9 6 6 6-6"/>',
	chevr: '<path d="m9 6 6 6-6 6"/>',
	chevl: '<path d="m15 6-6 6 6 6"/>',
	file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
	check: '<path d="m5 12 5 5 9-10"/>',
	x: '<path d="M6 6l12 12M18 6 6 18"/>',
	alert: '<path d="M12 3 2 21h20z"/><path d="M12 10v5M12 18v.5"/>',
	user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
	dot: '<circle cx="12" cy="12" r="3"/>',
};
</script>
