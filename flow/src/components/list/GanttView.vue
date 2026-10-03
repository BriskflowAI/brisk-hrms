<template>
	<!-- The desk's Gantt view: each record as a bar from its start to its end date, using the same
	     calendar settings (dates, title, events method) as the Calendar view. -->
	<section aria-label="Gantt" class="overflow-hidden rounded-xl border border-line bg-surf">
		<div class="flex flex-wrap items-center gap-2 border-b border-line-2 px-4 py-3">
			<h2 class="mr-auto text-[19px]">{{ title }}</h2>
			<span v-if="loading" class="text-[12.5px] text-mut">Loading…</span>
			<div role="group" aria-label="Zoom" class="flex rounded-lg border border-line p-0.5">
				<button
					v-for="z in zooms"
					:key="z.key"
					type="button"
					:aria-pressed="zoom === z.key"
					class="rounded-md px-2.5 py-1 text-[12.5px] font-semibold"
					:class="zoom === z.key ? 'bg-ink text-surf' : 'text-ink-2 hover:bg-side'"
					@click="zoom = z.key"
				>
					{{ z.label }}
				</button>
			</div>
			<button type="button" class="btn-ghost h-8 px-3 text-[13px]" @click="go(0)">
				Today
			</button>
			<button
				type="button"
				class="btn-ghost h-8 w-8 justify-center px-0"
				aria-label="Earlier"
				@click="go(-1)"
			>
				‹
			</button>
			<button
				type="button"
				class="btn-ghost h-8 w-8 justify-center px-0"
				aria-label="Later"
				@click="go(1)"
			>
				›
			</button>
		</div>
		<p v-if="error" role="alert" class="bg-neg-tint px-4 py-2 text-[13px] text-neg">
			{{ error }}
		</p>
		<div class="overflow-x-auto">
			<div :style="{ minWidth: `${labelW + days.length * dayW}px` }">
				<div class="flex border-b border-line-2 bg-paper text-[11.5px] text-mut">
					<div
						class="shrink-0 px-3 py-1.5 font-semibold uppercase tracking-[0.08em]"
						:style="{ width: `${labelW}px` }"
					>
						{{ __(doctype) }}
					</div>
					<div
						v-for="d in days"
						:key="d.key"
						class="shrink-0 border-l border-line-2 py-1.5 text-center"
						:class="[
							d.key === today && 'bg-acc-tint font-bold text-acc',
							d.weekend && 'bg-side/60',
						]"
						:style="{ width: `${dayW}px` }"
					>
						{{
							dayW >= 28
								? d.date.format(dayW >= 60 ? "ddd D" : "D")
								: d.date.date() === 1 || d.date.day() === 1
									? d.date.format("D MMM")
									: ""
						}}
					</div>
				</div>
				<div
					v-for="e in bars"
					:key="e.key"
					class="flex h-9 items-center border-b border-line-2 text-[13px] hover:bg-paper"
				>
					<router-link
						:to="{ name: 'Form', params: { doctype, name: e.name } }"
						class="shrink-0 truncate px-3 font-medium hover:text-acc"
						:style="{ width: `${labelW}px` }"
						:title="e.title"
						>{{ e.title }}</router-link
					>
					<div class="relative h-full flex-grow">
						<router-link
							:to="{ name: 'Form', params: { doctype, name: e.name } }"
							class="absolute top-1.5 flex h-6 items-center truncate rounded-md px-2 text-[12px] font-semibold"
							:class="e.tone"
							:style="{
								left: `${e.offset * dayW + 2}px`,
								width: `${Math.max(e.span * dayW - 4, 18)}px`,
							}"
							:title="`${e.title}: ${e.start} → ${e.end}`"
							>{{ e.span * dayW > 140 ? e.title : "" }}</router-link
						>
					</div>
				</div>
				<p
					v-if="!loading && !bars.length"
					class="px-4 py-10 text-center text-[13.5px] text-mut"
				>
					Nothing in this period.
				</p>
			</div>
		</div>
	</section>
</template>

<script setup>
import dayjs from "dayjs";
import { computed, ref, watch } from "vue";
import { fetchEvents } from "@/composables/calendarEvents";
import { messageOf } from "@/engine/form";

const props = defineProps({
	doctype: { type: String, required: true },
	settings: { type: Object, required: true },
	filters: { type: Array, required: true },
});

const zooms = [
	{ key: "week", label: "Week", days: 14, dayW: 72, step: [1, "week"] },
	{ key: "month", label: "Month", days: 42, dayW: 32, step: [1, "month"] },
	{ key: "quarter", label: "Quarter", days: 98, dayW: 14, step: [3, "month"] },
];
const labelW = 220;
const today = dayjs().format("YYYY-MM-DD");
const zoom = ref("month");
const anchor = ref(dayjs().startOf("week"));
const events = ref([]);
const loading = ref(false);
const error = ref("");

const z = computed(() => zooms.find((x) => x.key === zoom.value));
const dayW = computed(() => z.value.dayW);
const start = computed(() => anchor.value.subtract(z.value.key === "week" ? 0 : 7, "day"));
const days = computed(() =>
	Array.from({ length: z.value.days }, (_, i) => {
		const d = start.value.add(i, "day");
		return { key: d.format("YYYY-MM-DD"), date: d, weekend: [0, 6].includes(d.day()) };
	}),
);
const end = computed(() => days.value[days.value.length - 1].date);
const title = computed(() => `${start.value.format("D MMM")} – ${end.value.format("D MMM YYYY")}`);

const TONES = {
	danger: "bg-neg-tint text-neg",
	warning: "bg-warn-tint text-warn",
	success: "bg-pos-tint text-pos",
	default: "bg-line-2 text-ink-2",
};
const bars = computed(() => {
	const m = props.settings.field_map || {};
	return events.value
		.filter((ev) => !ev.doctype || ev.doctype === props.doctype)
		.map((ev, i) => {
			const s = dayjs(ev[m.start] || ev.start);
			const e = dayjs(ev[m.end] || ev.end || ev[m.start] || ev.start);
			const from = s.isBefore(start.value) ? start.value : s;
			const to = e.isAfter(end.value) ? end.value : e;
			let tone = "bg-acc text-white";
			try {
				const cls = props.settings.get_css_class?.(ev);
				if (cls && TONES[cls]) tone = TONES[cls];
			} catch {
				/* default */
			}
			return {
				key: `${ev[m.id] || ev.name}-${i}`,
				name: ev[m.id] || ev.name,
				title: ev[m.title] || ev.title || ev.name,
				start: s.format("D MMM YYYY"),
				end: e.format("D MMM YYYY"),
				offset: from.startOf("day").diff(start.value.startOf("day"), "day"),
				span: to.startOf("day").diff(from.startOf("day"), "day") + 1,
				sortKey: s.valueOf(),
				tone,
			};
		})
		.filter((b) => b.span > 0)
		.sort((a, b) => a.sortKey - b.sortKey);
});

async function load() {
	loading.value = true;
	error.value = "";
	try {
		events.value = await fetchEvents({
			doctype: props.doctype,
			settings: props.settings,
			start: start.value.format("YYYY-MM-DD"),
			end: end.value.format("YYYY-MM-DD"),
			filters: props.filters,
		});
	} catch (e) {
		error.value = messageOf(e, "Couldn't load the timeline.");
		events.value = [];
	} finally {
		loading.value = false;
	}
}
function go(dir) {
	anchor.value = dir
		? anchor.value.add(dir * z.value.step[0], z.value.step[1])
		: dayjs().startOf("week");
}
watch([start, zoom, () => JSON.stringify(props.filters)], load, { immediate: true });
</script>
