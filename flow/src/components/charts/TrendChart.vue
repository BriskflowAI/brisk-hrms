<template>
	<div ref="root" class="relative" @pointerleave="active = null">
		<ul
			v-if="series.length > 1"
			class="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-2"
		>
			<li v-for="s in series" :key="s.name" class="flex items-center gap-1.5">
				<span
					class="inline-block h-[2px] w-3.5 rounded"
					:style="{ background: s.color }"
				/>
				{{ s.name }}
			</li>
		</ul>
		<svg
			:width="width"
			:height="height"
			role="img"
			:aria-label="ariaLabel"
			tabindex="0"
			class="block touch-none overflow-visible outline-none focus-visible:ring-2 focus-visible:ring-acc"
			@pointermove="onMove"
			@keydown.left.prevent="step(-1)"
			@keydown.right.prevent="step(1)"
			@focus="active ??= labels.length - 1"
			@blur="active = null"
		>
			<!-- gridlines and y ticks -->
			<g v-for="t in ticks" :key="t">
				<line
					:x1="pad.l"
					:x2="width - pad.r"
					:y1="y(t)"
					:y2="y(t)"
					stroke="#E5E9F2"
					stroke-width="1"
				/>
				<text
					:x="pad.l - 8"
					:y="y(t) + 4"
					text-anchor="end"
					class="fill-mut text-[11px] tabular-nums"
				>
					{{ compact(t) }}
				</text>
			</g>
			<!-- x labels -->
			<text
				v-for="i in xTicks"
				:key="`x${i}`"
				:x="x(i)"
				:y="height - 6"
				text-anchor="middle"
				class="fill-mut text-[11px]"
			>
				{{ shortLabel(labels[i]) }}
			</text>
			<!-- a single series gets a light wash under its line -->
			<path
				v-if="series.length === 1"
				:d="area(series[0].values)"
				:fill="series[0].color"
				fill-opacity="0.1"
			/>
			<path
				v-for="s in series"
				:key="s.name"
				:d="line(s.values)"
				fill="none"
				:stroke="s.color"
				stroke-width="2"
				stroke-linejoin="round"
				stroke-linecap="round"
			/>
			<!-- crosshair -->
			<template v-if="active !== null">
				<line
					:x1="x(active)"
					:x2="x(active)"
					:y1="pad.t"
					:y2="height - pad.b"
					stroke="#9AA3C7"
					stroke-width="1"
				/>
				<circle
					v-for="s in series"
					:key="`d${s.name}`"
					:cx="x(active)"
					:cy="y(s.values[active] || 0)"
					r="4"
					:fill="s.color"
					stroke="#FDFDFF"
					stroke-width="2"
				/>
			</template>
		</svg>
		<div
			v-if="active !== null"
			role="status"
			class="pointer-events-none absolute z-10 min-w-[140px] rounded-lg border border-line bg-surf px-3 py-2 text-[12.5px] shadow-lg"
			:style="tipStyle"
		>
			<div class="mb-1 text-mut">{{ labels[active] }}</div>
			<div v-for="s in series" :key="`t${s.name}`" class="flex items-center gap-2">
				<span class="inline-block h-[2px] w-3 rounded" :style="{ background: s.color }" />
				<span class="font-bold tabular-nums text-ink">{{ format(s.values[active]) }}</span>
				<span v-if="series.length > 1" class="text-ink-2">{{ s.name }}</span>
			</div>
		</div>
	</div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { compact, niceTicks, PALETTE } from "./scale";

const props = defineProps({
	labels: { type: Array, required: true },
	datasets: { type: Array, required: true },
	height: { type: Number, default: 190 },
	format: { type: Function, default: (v) => Number(v || 0).toLocaleString() },
	ariaLabel: { type: String, default: "" },
});

const root = ref(null);
const width = ref(480);
const active = ref(null);
const pad = { t: 10, r: 12, b: 24, l: 44 };

// At most three series share a plot; the table view has the rest.
const series = computed(() =>
	props.datasets.slice(0, 3).map((d, i) => ({ ...d, color: PALETTE[i] })),
);
const max = computed(() => Math.max(0, ...series.value.flatMap((s) => s.values)));
const ticks = computed(() =>
	niceTicks(max.value, 4, series.value.every((s) => s.values.every((v) => Number.isInteger(v)))),
);
const top = computed(() => ticks.value[ticks.value.length - 1] || 1);
const n = computed(() => Math.max(props.labels.length, 1));

const x = (i) => pad.l + (n.value === 1 ? 0.5 : i / (n.value - 1)) * (width.value - pad.l - pad.r);
const y = (v) => props.height - pad.b - (v / top.value) * (props.height - pad.t - pad.b);
const line = (vals) => vals.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v || 0)}`).join("");
const area = (vals) =>
	vals.length ? `${line(vals)}L${x(vals.length - 1)},${y(0)}L${x(0)},${y(0)}Z` : "";

const xTicks = computed(() => {
	const count = Math.min(n.value, Math.max(2, Math.floor(width.value / 90)));
	const every = Math.ceil(n.value / count);
	return [...Array(n.value).keys()].filter((i) => i % every === 0);
});
const shortLabel = (l) => String(l ?? "").slice(0, 10);

function onMove(e) {
	const box = e.currentTarget.getBoundingClientRect();
	const rel = (e.clientX - box.left - pad.l) / (width.value - pad.l - pad.r);
	active.value = Math.max(0, Math.min(n.value - 1, Math.round(rel * (n.value - 1))));
}
function step(d) {
	active.value = Math.max(0, Math.min(n.value - 1, (active.value ?? n.value - 1) + d));
}
const tipStyle = computed(() => {
	const left = x(active.value);
	return left > width.value / 2
		? { right: `${width.value - left + 12}px`, top: "28px" }
		: { left: `${left + 12}px`, top: "28px" };
});

let ro;
onMounted(() => {
	ro = new ResizeObserver(([e]) => (width.value = Math.max(240, e.contentRect.width)));
	ro.observe(root.value);
});
onBeforeUnmount(() => ro?.disconnect());
</script>
