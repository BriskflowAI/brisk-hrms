<template>
	<div class="relative" @pointerleave="active = null">
		<ul
			v-if="series.length > 1 || series[0]?.name"
			class="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-2"
		>
			<li v-for="s in series" :key="s.name" class="flex items-center gap-1.5">
				<span
					class="inline-block h-2.5 w-2.5 rounded-sm"
					:style="{ background: s.color }"
				/>
				{{ s.name }}
			</li>
		</ul>
		<svg
			ref="root"
			:viewBox="`0 0 ${width} ${height}`"
			class="block w-full"
			:style="{ height: `${height}px` }"
			role="img"
			:aria-label="ariaLabel"
		>
			<g v-for="t in ticks" :key="t">
				<line
					:x1="left"
					:x2="width"
					:y1="y(t)"
					:y2="y(t)"
					stroke="#E6E8F0"
					stroke-width="1"
				/>
				<text
					:x="left - 6"
					:y="y(t) + 4"
					text-anchor="end"
					class="fill-[#6B7083] text-[11px]"
				>
					{{ compact(t) }}
				</text>
			</g>
			<g v-for="(label, i) in labels" :key="i" @pointerenter="active = i">
				<rect
					:x="left + i * band"
					:y="0"
					:width="band"
					:height="plotBottom"
					:fill="active === i ? '#EEF0FB' : 'transparent'"
				/>
				<rect
					v-for="(s, j) in series"
					:key="s.name"
					:x="left + i * band + offset + j * barWidth"
					:y="y(Math.max(0, s.values[i] || 0))"
					:width="Math.max(1, barWidth - 2)"
					:height="Math.abs(y(0) - y(Math.max(0, s.values[i] || 0)))"
					rx="2"
					:fill="s.color"
				/>
				<text
					v-if="showLabel(i)"
					:x="left + i * band + band / 2"
					:y="height - 6"
					text-anchor="middle"
					class="fill-[#6B7083] text-[11px]"
				>
					{{ short(label) }}
				</text>
			</g>
		</svg>
		<div
			v-if="active !== null"
			class="pointer-events-none absolute top-0 z-10 min-w-[140px] rounded-lg border border-line bg-surf px-3 py-2 text-[12px] shadow-lg"
			:style="{ left: `${tipLeft}%` }"
		>
			<div class="mb-1 font-semibold text-ink">{{ labels[active] }}</div>
			<div v-for="s in series" :key="`t${s.name}`" class="flex items-center gap-2">
				<span class="inline-block h-2 w-2 rounded-sm" :style="{ background: s.color }" />
				<span class="font-bold tabular-nums text-ink">{{ format(s.values[active]) }}</span>
				<span v-if="series.length > 1" class="truncate text-ink-2">{{ s.name }}</span>
			</div>
		</div>
	</div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { compact, niceTicks, PALETTE } from "./scale";

const props = defineProps({
	labels: { type: Array, required: true },
	datasets: { type: Array, required: true }, // [{ name, values }]
	height: { type: Number, default: 220 },
	format: { type: Function, default: (v) => Number(v || 0).toLocaleString() },
	ariaLabel: { type: String, default: "" },
});

const COLORS = [...PALETTE, "#7B61FF", "#C2410C", "#0E7490"];
const root = ref(null);
const width = ref(800);
const active = ref(null);
const left = 44;
const plotBottom = computed(() => props.height - 24);

const series = computed(() =>
	props.datasets.slice(0, COLORS.length).map((d, i) => ({
		name: d.name || (props.datasets.length > 1 ? `Series ${i + 1}` : ""),
		values: (d.values || []).map((v) => Number(v) || 0),
		color: COLORS[i],
	})),
);
const max = computed(() => Math.max(0, ...series.value.flatMap((s) => s.values)));
const ticks = computed(() =>
	niceTicks(
		max.value,
		4,
		series.value.every((s) => s.values.every((v) => Number.isInteger(v))),
	),
);
const top = computed(() => ticks.value[ticks.value.length - 1] || 1);
const y = (v) => 8 + (plotBottom.value - 8) * (1 - v / top.value);
const band = computed(() => (width.value - left) / Math.max(1, props.labels.length));
const pad = computed(() => Math.min(band.value * 0.18, 14));
const barWidth = computed(() =>
	Math.min(40, (band.value - pad.value * 2) / Math.max(1, series.value.length)),
);
// Bars stay a readable width and sit in the middle of their slot.
const offset = computed(() => (band.value - barWidth.value * series.value.length) / 2);
const every = computed(() =>
	Math.ceil(props.labels.length / Math.max(1, Math.floor(width.value / 70))),
);
const showLabel = (i) => i % every.value === 0;
const short = (l) => {
	const s = String(l ?? "");
	const room = Math.max(4, Math.floor((band.value * every.value) / 7));
	return s.length > room ? `${s.slice(0, room - 1)}…` : s;
};
const tipLeft = computed(() => {
	const x = left + (active.value + 0.5) * band.value;
	return Math.min(78, Math.max(0, (x / width.value) * 100 - 8));
});

let observer;
onMounted(() => {
	observer = new ResizeObserver(([e]) => (width.value = Math.max(320, e.contentRect.width)));
	observer.observe(root.value);
});
onBeforeUnmount(() => observer?.disconnect());
</script>
