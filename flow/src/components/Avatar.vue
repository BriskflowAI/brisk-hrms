<template>
	<img
		v-if="image && !broken"
		:src="image"
		:alt="label"
		:title="label"
		class="shrink-0 rounded-full object-cover"
		:style="{ width: `${size}px`, height: `${size}px` }"
		@error="broken = true"
	/>
	<span
		v-else
		class="inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold leading-none"
		:style="{
			width: `${size}px`,
			height: `${size}px`,
			fontSize: `${Math.round(size * 0.42)}px`,
			background: tone.bg,
			color: tone.fg,
		}"
		:title="label"
	>
		{{ initials }}
	</span>
</template>

<script setup>
import { computed, ref } from "vue";

const props = defineProps({
	label: { type: String, default: "" },
	size: { type: Number, default: 28 },
	image: { type: String, default: "" },
});
const broken = ref(false);

// Stable colour per person, picked from the team palette.
const tones = [
	{ fg: "#B8286E", bg: "#FCE1EF" },
	{ fg: "#1864C8", bg: "#DCEAFD" },
	{ fg: "#1E7F3C", bg: "#DBF2E0" },
	{ fg: "#B24F06", bg: "#FFE7D3" },
	{ fg: "#6A3BD0", bg: "#EBE2FE" },
];

const initials = computed(() =>
	(props.label || "?")
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((w) => w[0].toUpperCase())
		.join(""),
);

const tone = computed(() => {
	let h = 0;
	for (const ch of props.label || "") h = (h * 31 + ch.charCodeAt(0)) >>> 0;
	return tones[h % tones.length];
});
</script>
