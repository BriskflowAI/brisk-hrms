<template>
	<ul class="space-y-1.5" :aria-label="ariaLabel">
		<li
			v-for="(r, i) in rows"
			:key="r.label"
			class="group relative grid grid-cols-[minmax(0,38%)_1fr] items-center gap-3 rounded-md px-1 py-0.5 text-[13px] hover:bg-paper focus:bg-paper focus:outline-none"
			tabindex="0"
			@pointerenter="hover = i"
			@pointerleave="hover = null"
			@focus="hover = i"
			@blur="hover = null"
		>
			<span class="truncate text-ink-2" :title="r.label">{{ r.label }}</span>
			<span class="flex items-center gap-2">
				<span
					class="block h-3.5 rounded-r-[4px] transition-opacity"
					:class="hover !== null && hover !== i ? 'opacity-60' : ''"
					:style="{
						width: `${Math.max(1.5, (r.value / max) * 85)}%`,
						background: r.other ? '#9AA3C7' : '#2B3FE0',
					}"
				/>
				<span
					class="whitespace-nowrap text-[12.5px] font-semibold tabular-nums text-ink"
					>{{ format(r.value) }}</span
				>
			</span>
			<span
				v-if="hover === i"
				role="status"
				class="pointer-events-none absolute right-0 top-full z-10 mt-1 rounded-lg border border-line bg-surf px-3 py-1.5 text-[12.5px] shadow-lg"
			>
				<b class="tabular-nums text-ink">{{ format(r.value) }}</b>
				<span class="text-ink-2"> · {{ share(r.value) }} · {{ r.label }}</span>
			</span>
		</li>
	</ul>
</template>

<script setup>
// Shares and counts by category, as sorted horizontal bars (easier to compare than pie slices).
import { computed, ref } from "vue";

const props = defineProps({
	labels: { type: Array, required: true },
	values: { type: Array, required: true },
	sorted: { type: Boolean, default: true },
	limit: { type: Number, default: 8 },
	format: { type: Function, default: (v) => Number(v || 0).toLocaleString() },
	ariaLabel: { type: String, default: "" },
});
const hover = ref(null);

const rows = computed(() => {
	let rows = props.labels.map((l, i) => ({
		label: !l || l === "None" || l === "null" ? "Not set" : String(l),
		value: props.values[i] || 0,
	}));
	if (props.sorted) rows.sort((a, b) => b.value - a.value);
	// Ordered scales (age bands) keep every row; rankings fold their tail into one row.
	if (props.sorted && rows.length > props.limit) {
		const rest = rows.slice(props.limit - 1);
		rows = [
			...rows.slice(0, props.limit - 1),
			{
				label: `${rest.length} others`,
				value: rest.reduce((s, r) => s + r.value, 0),
				other: true,
			},
		];
	}
	return rows;
});
const max = computed(() => Math.max(1, ...rows.value.map((r) => r.value)));
const total = computed(() => props.values.reduce((s, v) => s + (v || 0), 0) || 1);
const share = (v) => `${Math.round((v / total.value) * 100)}%`;
</script>
