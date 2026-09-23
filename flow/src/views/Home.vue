<template>
	<div class="flex max-w-[1100px] flex-col gap-8 px-9 py-8">
		<header>
			<div class="kicker">{{ today }}</div>
			<h1 class="mt-2 text-[48px] leading-none">
				Good {{ partOfDay }}<span class="text-acc">.</span>
			</h1>
			<p class="mt-3 text-[17px] text-ink-2">
				Everything waiting on a decision, in one place. Press
				<kbd class="rounded border border-current px-1 text-[12px] font-semibold">⌘K</kbd>
				to jump to any person or record.
			</p>
		</header>

		<section aria-label="Waiting on you" class="grid grid-cols-2 gap-4 lg:grid-cols-3">
			<router-link
				v-for="q in queues"
				:key="q.doctype"
				:to="{ name: 'List', params: { doctype: q.doctype } }"
				class="flex flex-col gap-1.5 rounded-xl border border-line bg-surf px-5 py-4 hover:border-acc/50"
			>
				<span class="text-[13px] font-semibold text-ink-2">{{ q.label }}</span>
				<span class="font-display text-[32px] font-bold tabular-nums">{{
					q.count ?? "–"
				}}</span>
				<span class="text-[12.5px] text-mut">{{ q.hint }}</span>
			</router-link>
		</section>
	</div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import dayjs from "dayjs";
import { getCount } from "@/composables/api";

const today = dayjs().format("dddd · D MMMM");
const hour = new Date().getHours();
const partOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

// Counts come straight from the server with the user's own permissions applied.
const queues = ref([
	{
		label: "Leave requests",
		doctype: "Leave Application",
		filters: { status: "Open", docstatus: 0 },
		hint: "open",
		count: null,
	},
	{
		label: "Expense claims",
		doctype: "Expense Claim",
		filters: { approval_status: "Draft", docstatus: 0 },
		hint: "awaiting approval",
		count: null,
	},
	{
		label: "Attendance requests",
		doctype: "Attendance Request",
		filters: { docstatus: 0 },
		hint: "not yet submitted",
		count: null,
	},
	{
		label: "Shift requests",
		doctype: "Shift Request",
		filters: { status: "Draft", docstatus: 0 },
		hint: "awaiting approval",
		count: null,
	},
	{
		label: "Comp-off requests",
		doctype: "Compensatory Leave Request",
		filters: { docstatus: 0 },
		hint: "not yet submitted",
		count: null,
	},
]);

onMounted(() => {
	queues.value.forEach(async (q) => {
		try {
			q.count = await getCount(q.doctype, q.filters);
		} catch {
			q.count = null;
		}
	});
});
</script>
