<template>
	<section :aria-label="__('Leave calendar')" class="rounded-xl border border-line bg-surf">
		<header class="flex items-center justify-center gap-3 border-b border-line-2 py-2.5">
			<button
				type="button"
				class="rounded-md p-1 text-acc hover:bg-side disabled:opacity-30"
				:disabled="!canGo(-1)"
				:aria-label="__('Previous month')"
				@click="go(-1)"
			>
				<Icon name="chevl" :size="16" />
			</button>
			<h3 class="min-w-[130px] text-center text-[14px] font-semibold text-acc">
				{{ monthLabel }}
			</h3>
			<button
				type="button"
				class="rounded-md p-1 text-acc hover:bg-side disabled:opacity-30"
				:disabled="!canGo(1)"
				:aria-label="__('Next month')"
				@click="go(1)"
			>
				<Icon name="chevr" :size="16" />
			</button>
		</header>
		<div
			class="grid grid-cols-7 border-b border-line-2 text-center text-[12px] font-semibold text-ink-2"
		>
			<div v-for="w in weekdays" :key="w" class="py-2">{{ w }}</div>
		</div>
		<div class="grid grid-cols-7">
			<div
				v-for="(cell, i) in cells"
				:key="i"
				class="min-h-[92px] border-b border-r border-line-2 p-1.5 [&:nth-child(7n)]:border-r-0"
				:class="!cell && 'bg-paper/60'"
			>
				<template v-if="cell">
					<span
						class="inline-flex h-6 w-6 items-center justify-center rounded-full text-[12.5px]"
						:class="
							cell.iso === today ? 'bg-acc font-semibold text-surf' : 'text-ink-2'
						"
						>{{ cell.day }}</span
					>
					<div class="mt-1 flex flex-col gap-1">
						<span
							v-for="h in cell.holidays"
							:key="h.name"
							class="truncate rounded border-l-[3px] border-acc bg-acc-tint px-1.5 py-0.5 text-[11.5px] text-ink"
							:title="h.name"
							>{{ h.name }}</span
						>
						<router-link
							v-for="r in cell.leaves"
							:key="r.name"
							:to="{
								name: 'Form',
								params: { doctype: 'Leave Application', name: r.name },
							}"
							class="truncate rounded border-l-[3px] px-1.5 py-0.5 text-[11.5px] text-ink hover:underline"
							:class="tone(r)"
							:title="`${r.leave_type} · ${status(r)}`"
							>{{
								r.half_day && isHalf(r, cell.iso)
									? `${r.leave_type} · ½`
									: r.leave_type
							}}</router-link
						>
					</div>
				</template>
			</div>
		</div>
	</section>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import Icon from "@/components/Icon.vue";
import { __ } from "@/composables/i18n";
import { iso, requestStatus } from "@/composables/leave";

const props = defineProps({
	period: { type: Object, required: true },
	today: { type: String, required: true },
	requests: { type: Array, default: () => [] },
	holidays: { type: Array, default: () => [] },
});

const firstOf = (d) => {
	const x = new Date(String(d).slice(0, 10) + "T00:00:00");
	return new Date(x.getFullYear(), x.getMonth(), 1);
};
const startMonth = () => {
	const { from_date, to_date } = props.period;
	const t = props.today;
	return firstOf(t >= from_date && t <= to_date ? t : from_date);
};
const month = ref(startMonth());
watch(
	() => props.period,
	() => (month.value = startMonth()),
);

const monthLabel = computed(() =>
	month.value.toLocaleDateString(undefined, { month: "short", year: "numeric" }),
);

const weekdays = Array.from({ length: 7 }, (_, i) =>
	new Date(2026, 1, 1 + i).toLocaleDateString(undefined, { weekday: "short" }),
);

const shifted = (step) => new Date(month.value.getFullYear(), month.value.getMonth() + step, 1);
const canGo = (step) => {
	const m = iso(shifted(step));
	return step < 0 ? m >= iso(firstOf(props.period.from_date)) : m <= props.period.to_date;
};
const go = (step) => canGo(step) && (month.value = shifted(step));

const live = computed(() => props.requests.filter((r) => requestStatus(r) !== "Cancelled"));

const cells = computed(() => {
	const y = month.value.getFullYear();
	const m = month.value.getMonth();
	const blanks = new Date(y, m, 1).getDay();
	const count = new Date(y, m + 1, 0).getDate();
	const out = Array(blanks).fill(null);
	for (let d = 1; d <= count; d++) {
		const at = iso(new Date(y, m, d));
		out.push({
			day: d,
			iso: at,
			holidays: props.holidays.filter((h) => h.date === at),
			leaves: live.value.filter((r) => r.from_date <= at && r.to_date >= at),
		});
	}
	while (out.length % 7) out.push(null);
	return out;
});

const status = (r) => __(requestStatus(r));
const tone = (r) =>
	({
		Pending: "border-warn-bar bg-warn-tint",
		Approved: "border-pos bg-pos-tint",
		Rejected: "border-neg bg-neg-tint line-through",
	})[requestStatus(r)];
const isHalf = (r, at) => r.from_date === r.to_date || r.half_day_date === at;
</script>
