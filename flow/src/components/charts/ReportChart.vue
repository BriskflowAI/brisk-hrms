<template>
	<!-- A report's chart, as the report defines it (bar, line, pie, donut or percentage). -->
	<TrendChart
		v-if="kind === 'line'"
		:labels="labels"
		:datasets="datasets"
		:height="220"
		:aria-label="title"
	/>
	<RankBars
		v-else-if="kind === 'share'"
		:labels="labels"
		:values="datasets[0]?.values || []"
		:sorted="false"
		:limit="12"
		:aria-label="title"
	/>
	<BarChart v-else :labels="labels" :datasets="datasets" :aria-label="title" />
</template>

<script setup>
import { computed } from "vue";
import BarChart from "./BarChart.vue";
import RankBars from "./RankBars.vue";
import TrendChart from "./TrendChart.vue";

const props = defineProps({
	chart: { type: Object, required: true }, // { data: { labels, datasets }, type }
	title: { type: String, default: "" },
});

const labels = computed(() => (props.chart.data?.labels || []).map((l) => String(l ?? "")));
const datasets = computed(() =>
	(props.chart.data?.datasets || []).map((d) => ({
		name: d.name || "",
		values: (d.values || []).map((v) => Number(v) || 0),
	})),
);
const kind = computed(() => {
	const t = String(props.chart.type || "bar").toLowerCase();
	if (t === "line" || t === "axis-mixed") return "line";
	if (["pie", "donut", "percentage"].includes(t)) return "share";
	return "bar";
});
</script>
