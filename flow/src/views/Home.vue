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
				:key="q.kind"
				to="/inbox"
				class="flex flex-col gap-1.5 rounded-xl border border-line bg-surf px-5 py-4 hover:border-acc/50"
			>
				<span class="text-[13px] font-semibold text-ink-2">{{ q.label }}</span>
				<span class="font-display text-[32px] font-bold tabular-nums">{{
					counts === null ? "–" : counts[q.kind] || 0
				}}</span>
				<span class="text-[12.5px] text-mut">waiting on you</span>
			</router-link>
		</section>
	</div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import dayjs from "dayjs";
import { fetchInbox } from "@/composables/inbox";

const today = dayjs().format("dddd · D MMMM");
const hour = new Date().getHours();
const partOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

// Same numbers as the Inbox: only requests the current user can decide.
const queues = [
	{ label: "Leave requests", kind: "Leave" },
	{ label: "Expense claims", kind: "Expense" },
	{ label: "Attendance requests", kind: "Attendance" },
	{ label: "Shift requests", kind: "Shift" },
	{ label: "Comp-off requests", kind: "Comp-off" },
];
const counts = ref(null);

onMounted(async () => {
	try {
		counts.value = (await fetchInbox()).counts;
	} catch {
		counts.value = null;
	}
});
</script>
