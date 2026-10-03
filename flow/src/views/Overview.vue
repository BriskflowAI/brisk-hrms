<template>
	<div class="h-full overflow-y-auto">
		<header class="flex flex-wrap items-end gap-3 px-4 md:px-7 pb-2 pt-5">
			<div class="mr-auto">
				<div class="kicker">{{ data?.title || "" }} {{ __("· Overview") }}</div>
				<h1 class="mt-1.5 text-[28px] leading-none md:text-[36px]">
					{{ data?.title || "Overview" }} {{ __("at a glance") }}{{ " " }}
				</h1>
			</div>
			<label v-if="data?.companies?.length > 1" class="flex items-center gap-2 text-[13px]">
				<span class="font-semibold text-ink-2">{{ __("Company") }}</span>
				<select
					:value="data.company"
					class="h-9 rounded-lg border border-line bg-surf py-0 pl-3 pr-8 text-[13.5px] font-semibold text-ink focus:border-acc focus:ring-1 focus:ring-acc"
					@change="
						company = $event.target.value;
						load();
					"
				>
					<option v-for="c in data.companies" :key="c" :value="c">{{ c }}</option>
				</select>
			</label>
			<button type="button" class="btn-ghost" :disabled="loading" @click="load">
				{{ loading ? "Refreshing…" : "Refresh" }}
			</button>
		</header>

		<p
			v-if="error"
			role="alert"
			class="mx-7 my-4 rounded-lg bg-neg-tint px-4 py-3 text-[13.5px] text-neg"
		>
			{{ error }}
		</p>
		<div v-else-if="!data" class="px-4 md:px-7 py-10 text-[13.5px] text-mut">
			{{ __("Loading…") }}
		</div>

		<div v-else class="px-4 md:px-7 pb-10 transition-opacity" :class="loading && 'opacity-60'">
			<!-- headline numbers -->
			<section
				v-if="data.cards.length"
				:aria-label="__('Key numbers')"
				class="mt-4 grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3"
			>
				<component
					:is="c.doctype && !c.error ? 'router-link' : 'div'"
					v-for="c in data.cards"
					:key="c.name"
					:to="c.doctype ? cardLink(c) : undefined"
					class="flex flex-col rounded-xl border border-line bg-surf px-4 py-3.5"
					:class="c.doctype && !c.error && 'hover:border-acc'"
				>
					<span class="text-[12.5px] font-semibold text-ink-2">{{ c.label }}</span>
					<span v-if="c.error" class="mt-1.5 text-[13px] text-mut">{{ c.error }}</span>
					<template v-else>
						<span
							class="mt-1 font-display text-[30px] font-bold leading-tight text-ink"
							>{{ cardValue(c) }}</span
						>
						<span
							v-if="c.change !== null && c.change !== undefined"
							class="text-[12px] text-ink-2"
						>
							{{ c.change > 0 ? "↑" : c.change < 0 ? "↓" : "" }}
							{{ Math.abs(Math.round(c.change)) }}{{ __("% vs") }}
							{{ previous(c.interval) }}
						</span>
					</template>
				</component>
			</section>

			<!-- charts -->
			<section :aria-label="__('Charts')" class="mt-5 grid gap-4 xl:grid-cols-2">
				<article
					v-for="ch in data.charts"
					:key="ch.name"
					class="min-w-0 rounded-xl border border-line bg-surf"
				>
					<header class="flex items-center gap-2 border-b border-line-2 px-4 py-2.5">
						<h2 class="mr-auto truncate font-body text-[14px] font-bold">
							{{ ch.label }}
						</h2>
						<button
							v-if="hasData(ch)"
							type="button"
							class="rounded px-2 py-1 text-[12px] font-semibold text-ink-2 hover:bg-side"
							:aria-pressed="!!tables[ch.name]"
							@click="tables[ch.name] = !tables[ch.name]"
						>
							{{ tables[ch.name] ? "Chart" : "Table" }}
						</button>
						<router-link
							v-if="chartLink(ch)"
							:to="chartLink(ch)"
							class="rounded px-2 py-1 text-[12px] font-semibold text-acc hover:bg-acc-tint"
							>{{ __("Open") }}</router-link
						>
					</header>
					<div class="px-4 py-3.5">
						<p v-if="ch.error" class="py-6 text-center text-[13px] text-mut">
							{{ ch.error }}
						</p>
						<p v-else-if="!hasData(ch)" class="py-6 text-center text-[13px] text-mut">
							{{ __("Nothing to show yet.") }}
						</p>
						<table v-else-if="tables[ch.name]" class="w-full text-[12.5px]">
							<thead>
								<tr class="text-left text-mut">
									<th class="py-1 pr-3 font-semibold">
										{{ ch.group_by ? label(ch.group_by) : "" }}
									</th>
									<th
										v-for="d in ch.datasets"
										:key="d.name"
										class="py-1 pl-3 text-right font-semibold"
									>
										{{ d.name }}
									</th>
								</tr>
							</thead>
							<tbody>
								<tr
									v-for="(l, i) in ch.labels"
									:key="i"
									class="border-t border-line-2"
								>
									<td class="py-1 pr-3">{{ l }}</td>
									<td
										v-for="d in ch.datasets"
										:key="d.name"
										class="py-1 pl-3 text-right tabular-nums"
									>
										{{ fmt(d.values[i]) }}
									</td>
								</tr>
							</tbody>
						</table>
						<RankBars
							v-else-if="isShare(ch)"
							:labels="ch.labels"
							:values="ch.datasets[0].values"
							:sorted="ch.chart_type === 'Group By'"
							:format="fmt"
							:aria-label="ch.label"
						/>
						<TrendChart
							v-else
							:labels="ch.labels"
							:datasets="ch.datasets"
							:format="fmt"
							:aria-label="ch.label"
						/>
						<p
							v-if="
								hasData(ch) &&
								!ch.error &&
								!tables[ch.name] &&
								ch.datasets.length > 3
							"
							class="mt-2 text-[12px] text-mut"
						>
							{{ " " }}{{ __("Showing 3 of") }} {{ ch.datasets.length }}
							{{ __("series. The table has them all.") }}{{ " " }}
						</p>
					</div>
				</article>
			</section>
		</div>
	</div>
</template>

<script setup>
import { onMounted, reactive, ref, watch } from "vue";
import { call } from "frappe-ui";
import TrendChart from "@/components/charts/TrendChart.vue";
import RankBars from "@/components/charts/RankBars.vue";
import { compact } from "@/components/charts/scale";
import { messageOf } from "@/engine/form";

const props = defineProps({ area: { type: String, required: true } });

const data = ref(null);
const error = ref("");
const loading = ref(false);
const company = ref(null); // the company picked on screen; the server picks one when empty
const tables = reactive({});

async function load() {
	loading.value = true;
	error.value = "";
	try {
		data.value = await call("hrms.briskrew.dashboards.get_overview", {
			area: props.area,
			company: company.value,
		});
	} catch (e) {
		error.value = messageOf(e, "Couldn't load this overview.");
	} finally {
		loading.value = false;
	}
}

const fmt = (v) => compact(v);
const label = (s) =>
	String(s || "")
		.replace(/_/g, " ")
		.replace(/^\w/, (c) => c.toUpperCase());
const hasData = (ch) => ch.labels.length && ch.datasets.some((d) => d.values.some((v) => v));
// Categorical breakdowns read as ranked bars; anything over time as a line.
const isShare = (ch) =>
	ch.chart_type === "Group By" ||
	(["Bar", "Pie", "Donut", "Percentage"].includes(ch.type) && ch.datasets.length === 1);

function cardValue(c) {
	if (c.currency) {
		try {
			return Number(c.value || 0).toLocaleString(undefined, {
				style: "currency",
				currency: c.currency,
				notation: Math.abs(c.value) >= 1e5 ? "compact" : "standard",
				maximumFractionDigits: Math.abs(c.value) >= 1e5 ? 1 : 0,
			});
		} catch {
			/* unknown currency code */
		}
	}
	return c.fieldtype === "Percent" ? `${Math.round(c.value)}%` : compact(c.value);
}
const previous = (interval) =>
	({ Daily: "yesterday", Weekly: "last week", Monthly: "last month" })[interval] || "last year";

// A card opens its records, filtered the same way.
function cardLink(c) {
	const query = {};
	for (const f of c.filters || []) {
		if (f.length >= 4 && (!f[0] || f[0] === c.doctype))
			query[f[1]] = JSON.stringify([f[2], f[3]]);
	}
	return { name: "List", params: { doctype: c.doctype }, query };
}
function chartLink(ch) {
	if (ch.chart_type === "Report" && ch.report)
		return { name: "Report", params: { name: ch.report } };
	if (ch.doctype && ch.chart_type !== "Custom")
		return { name: "List", params: { doctype: ch.doctype } };
	return null;
}

onMounted(load);
watch(
	() => props.area,
	() => {
		data.value = null;
		load();
	},
);
</script>
