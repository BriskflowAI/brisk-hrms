<template>
	<section
		:aria-label="__('Calendar')"
		class="overflow-hidden rounded-xl border border-line bg-surf"
	>
		<div class="flex items-center gap-2 border-b border-line-2 px-4 py-3">
			<h2 class="mr-auto text-[19px]">{{ month.format("MMMM YYYY") }}</h2>
			<span v-if="loading" class="text-[12.5px] text-mut">{{ __("Loading…") }}</span>
			<button type="button" class="btn-ghost h-8 px-3 text-[13px]" @click="go(0)">
				{{ __("Today") }}
			</button>
			<button
				type="button"
				class="btn-ghost h-8 w-8 justify-center px-0"
				:aria-label="__('Previous month')"
				@click="go(-1)"
			>
				‹
			</button>
			<button
				type="button"
				class="btn-ghost h-8 w-8 justify-center px-0"
				:aria-label="__('Next month')"
				@click="go(1)"
			>
				›
			</button>
		</div>
		<p v-if="error" role="alert" class="bg-neg-tint px-4 py-2 text-[13px] text-neg">
			{{ error }}
		</p>
		<div class="grid grid-cols-7 border-b border-line-2 bg-paper">
			<div
				v-for="d in weekdays"
				:key="d"
				class="px-2.5 py-1.5 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-mut"
			>
				{{ d }}
			</div>
		</div>
		<div class="grid grid-cols-7" @mouseleave="dragEnd = dragStart">
			<div
				v-for="day in days"
				:key="day.key"
				class="group relative min-h-[112px] select-none border-b border-r border-line-2 p-1.5 [&:nth-child(7n)]:border-r-0"
				:class="[
					!day.inMonth && 'bg-paper/60',
					inDrag(day.key) && 'bg-acc-tint/60',
					canCreate && 'cursor-cell',
				]"
				@mousedown="startDrag(day.key, $event)"
				@mouseenter="dragStart && (dragEnd = day.key)"
				@mouseup="finishDrag(day.key)"
			>
				<div class="mb-1 flex items-center">
					<span
						class="flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[12.5px] font-semibold"
						:class="
							day.key === today
								? 'bg-acc text-white'
								: day.inMonth
									? 'text-ink-2'
									: 'text-mut/70'
						"
						>{{ day.date.date() }}</span
					>
				</div>
				<div class="flex flex-col gap-0.5">
					<button
						v-for="e in visible(day)"
						:key="e.key"
						type="button"
						class="flex items-center gap-1.5 truncate rounded px-1.5 py-0.5 text-left text-[12px] font-medium"
						:class="e.tone"
						:title="e.title"
						@mousedown.stop
						@click.stop="openEvent(e)"
					>
						<span
							v-if="e.color"
							class="h-1.5 w-1.5 shrink-0 rounded-full"
							:style="{ background: e.color }"
						/>
						<span class="truncate">{{ e.title }}</span>
					</button>
					<button
						v-if="day.events.length > limit && expanded !== day.key"
						type="button"
						class="px-1.5 text-left text-[11.5px] font-semibold text-mut hover:text-ink"
						@mousedown.stop
						@click.stop="expanded = day.key"
					>
						{{ day.events.length - limit }} {{ __("more") }}{{ " " }}
					</button>
				</div>
			</div>
		</div>
	</section>
</template>

<script setup>
import dayjs from "dayjs";
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { messageOf } from "@/engine/form";
import { fetchEvents } from "@/composables/calendarEvents";

const props = defineProps({
	doctype: { type: String, required: true },
	settings: { type: Object, required: true }, // frappe.views.calendar[doctype]
	filters: { type: Array, required: true }, // current server filters
	canCreate: { type: Boolean, default: false },
});
const router = useRouter();

const limit = 3;
const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const today = dayjs().format("YYYY-MM-DD");
const month = ref(dayjs().startOf("month"));
const events = ref([]);
const loading = ref(false);
const error = ref("");
const expanded = ref(null);
const dragStart = ref(null);
const dragEnd = ref(null);

const map = computed(() => props.settings.field_map || {});
const gridStart = computed(() => {
	const first = month.value;
	return first.subtract((first.day() + 6) % 7, "day");
});
const gridEnd = computed(() => {
	const last = month.value.endOf("month");
	return last.add((7 - last.day()) % 7, "day");
});

const TONES = {
	danger: "bg-neg-tint text-neg",
	warning: "bg-warn-tint text-warn",
	success: "bg-pos-tint text-pos",
	default: "bg-line-2 text-ink-2",
};

const prepared = computed(() =>
	events.value.map((ev, i) => {
		const m = map.value;
		const start = dayjs(ev[m.start] || ev.start);
		const end = dayjs(ev[m.end] || ev.end || ev[m.start] || ev.start);
		let tone = "bg-acc-tint text-acc";
		try {
			const cls = props.settings.get_css_class?.(ev);
			if (cls && TONES[cls]) tone = TONES[cls];
		} catch {
			/* keep the default */
		}
		if (ev.docstatus === 0 && !props.settings.get_css_class) tone = "bg-warn-tint text-warn";
		if (ev.doctype && ev.doctype !== props.doctype) tone = TONES.default;
		const color = ev[m.color] || ev.color;
		return {
			key: `${ev[m.id] || ev.name}-${i}`,
			name: ev[m.id] || ev.name,
			doctype: ev.doctype || props.doctype,
			title: ev[m.title] || ev.title || ev.employee_name || ev.name,
			start: start.format("YYYY-MM-DD"),
			end: (end.isBefore(start) ? start : end).format("YYYY-MM-DD"),
			tone,
			color: typeof color === "string" && color.startsWith("#") ? color : null,
		};
	}),
);

const days = computed(() => {
	const out = [];
	for (let d = gridStart.value; !d.isAfter(gridEnd.value); d = d.add(1, "day")) {
		const key = d.format("YYYY-MM-DD");
		out.push({
			key,
			date: d,
			inMonth: d.month() === month.value.month(),
			events: prepared.value.filter((e) => e.start <= key && e.end >= key),
		});
	}
	return out;
});

const visible = (day) => (expanded.value === day.key ? day.events : day.events.slice(0, limit));

async function load() {
	loading.value = true;
	error.value = "";
	try {
		events.value = await fetchEvents({
			doctype: props.doctype,
			settings: props.settings,
			start: gridStart.value.format("YYYY-MM-DD"),
			end: gridEnd.value.format("YYYY-MM-DD"),
			filters: props.filters,
		});
	} catch (e) {
		error.value = messageOf(e, "Couldn't load the calendar.");
		events.value = [];
	} finally {
		loading.value = false;
	}
}

function go(step) {
	expanded.value = null;
	month.value = step ? month.value.add(step, "month") : dayjs().startOf("month");
}

function openEvent(e) {
	// Holidays and other rows from related types aren't records of this type.
	if (e.doctype !== props.doctype || !e.name) return;
	router.push({ name: "Form", params: { doctype: props.doctype, name: e.name } });
}

// Drag across days (or click one) to start a new record for those dates.
function startDrag(key, ev) {
	if (!props.canCreate || ev.button !== 0) return;
	dragStart.value = dragEnd.value = key;
}
function inDrag(key) {
	if (!dragStart.value) return false;
	const [a, b] = [dragStart.value, dragEnd.value].sort();
	return key >= a && key <= b;
}
function finishDrag(key) {
	if (!dragStart.value) return;
	const [from, to] = [dragStart.value, key].sort();
	dragStart.value = dragEnd.value = null;
	const m = map.value;
	const query = { [m.start]: from };
	if (m.end && m.end !== m.start) query[m.end] = to;
	router.push({ name: "Form", params: { doctype: props.doctype, name: "new" }, query });
}

watch([month, () => JSON.stringify(props.filters)], load, { immediate: true });
</script>
