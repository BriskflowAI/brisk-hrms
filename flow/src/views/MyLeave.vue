<template>
	<div class="flex h-full min-h-0 flex-col">
		<header class="border-b border-line px-4 pt-5 md:px-7">
			<div class="flex flex-wrap items-end gap-3">
				<div class="mr-auto">
					<div class="kicker">{{ __("Leave · My data") }}</div>
					<h1 class="mt-1.5 text-[28px] leading-none md:text-[36px]">
						{{ __("My leave") }}
					</h1>
				</div>
				<router-link
					:to="{ name: 'ApplyLeave', query: periodQuery }"
					class="btn-ink"
					data-testid="apply-leave"
				>
					<Icon name="plus" :size="16" />{{ __("Apply leave") }}
				</router-link>
			</div>
			<nav
				role="tablist"
				:aria-label="__('My leave')"
				class="-mb-px mt-4 flex gap-5 overflow-x-auto"
			>
				<router-link
					v-for="t in tabs"
					:key="t.key"
					role="tab"
					:aria-selected="tab === t.key"
					:to="{ query: { ...route.query, tab: t.key } }"
					replace
					class="whitespace-nowrap border-b-2 pb-2.5 text-[13.5px] font-semibold"
					:class="
						tab === t.key
							? 'border-acc text-ink'
							: 'border-transparent text-ink-2 hover:text-ink'
					"
					>{{ t.label }}</router-link
				>
			</nav>
		</header>

		<div class="min-h-0 flex-grow overflow-y-auto bg-paper px-4 pb-10 md:px-7">
			<div v-if="data" class="mt-4 flex flex-wrap items-center gap-3">
				<div class="mx-auto flex items-center gap-2 text-[13.5px] font-semibold text-ink">
					<button
						type="button"
						class="rounded-md p-1 text-acc hover:bg-side"
						:aria-label="__('Previous period')"
						@click="setPeriod(-1)"
					>
						<Icon name="chevl" :size="16" />
					</button>
					<span class="tabular-nums"
						>{{ periodDate(data.period.from_date) }} –
						{{ periodDate(data.period.to_date) }}</span
					>
					<button
						type="button"
						class="rounded-md p-1 text-acc hover:bg-side"
						:aria-label="__('Next period')"
						@click="setPeriod(1)"
					>
						<Icon name="chevr" :size="16" />
					</button>
				</div>
				<div
					v-if="tab === 'summary'"
					role="group"
					:aria-label="__('View')"
					class="flex rounded-lg border border-line bg-surf p-0.5"
				>
					<button
						v-for="v in views"
						:key="v.key"
						type="button"
						:aria-pressed="view === v.key"
						:title="v.label"
						class="rounded-md p-1.5"
						:class="view === v.key ? 'bg-ink text-surf' : 'text-ink-2 hover:text-ink'"
						@click="setView(v.key)"
					>
						<Icon :name="v.icon" :size="16" /><span class="sr-only">{{
							v.label
						}}</span>
					</button>
				</div>
			</div>

			<p
				v-if="error"
				role="alert"
				class="mt-5 rounded-lg bg-neg-tint px-4 py-3 text-[13.5px] text-neg"
			>
				{{ error }}
			</p>
			<p
				v-if="notice"
				role="status"
				class="mt-4 rounded-lg bg-pos-tint px-4 py-3 text-[13.5px] text-pos"
			>
				{{ notice }}
			</p>
			<p v-if="!data && !error" class="mt-8 text-[13.5px] text-mut">{{ __("Loading…") }}</p>

			<!-- Leave summary -->
			<template v-if="data && tab === 'summary'">
				<section :aria-label="__('Leave balances')" class="mt-4">
					<div
						v-if="data.balances.length"
						class="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap"
					>
						<LeaveBalanceCard
							v-for="c in data.balances"
							:key="c.leave_type"
							:card="c"
						/>
					</div>
					<p
						v-else
						class="rounded-xl border border-line bg-surf px-4 py-5 text-[13.5px] text-ink-2"
					>
						{{
							__(
								"No leave has been allocated to you for this period yet. HR allocates leave at the start of the leave year.",
							)
						}}
					</p>
				</section>

				<LeaveCalendar
					v-if="view === 'calendar'"
					class="mt-4"
					:period="data.period"
					:today="data.today"
					:requests="data.requests"
					:holidays="data.holidays"
				/>

				<template v-else>
					<section
						v-if="data.absent.length"
						:aria-label="__('Absent')"
						class="mt-4 rounded-xl border border-line bg-surf"
					>
						<h2 class="border-b border-line-2 px-4 py-3 text-[14px] font-semibold">
							{{ __("Absent") }}
							<span class="font-normal text-mut"
								>· {{ days(data.absent.length) }}</span
							>
						</h2>
						<ul>
							<li
								v-for="d in data.absent"
								:key="d"
								class="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-line-2 px-4 py-2.5 text-[13.5px] last:border-b-0 sm:grid-cols-[180px_1fr_auto]"
							>
								<span>{{ dayLabel(d) }}</span>
								<span class="hidden text-ink-2 sm:block">{{ days(1) }}</span>
								<router-link
									:to="{ name: 'ApplyLeave', query: { from: d, to: d } }"
									class="btn-ghost h-8 text-acc"
									>{{ __("Apply leave") }}</router-link
								>
							</li>
						</ul>
					</section>

					<section
						v-for="part in parts"
						:key="part.key"
						:aria-label="part.title"
						class="mt-4 rounded-xl border border-line bg-surf"
					>
						<header class="flex items-center gap-3 border-b border-line-2 px-4 py-2.5">
							<h2 class="text-[14px] font-semibold">{{ part.title }}</h2>
							<select
								v-model="show"
								class="ml-auto h-8 rounded-lg border border-line bg-surf px-2 py-0 pr-7 text-[12.5px] text-ink"
								:aria-label="__('Show')"
							>
								<option value="all">{{ __("Leave and holidays") }}</option>
								<option value="leave">{{ __("Leave") }}</option>
								<option value="holiday">{{ __("Holidays") }}</option>
							</select>
						</header>
						<ul v-if="part.rows.length">
							<li
								v-for="row in part.rows"
								:key="row.key"
								class="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-line-2 px-4 py-2.5 text-[13.5px] last:border-b-0 sm:grid-cols-[180px_1fr_auto]"
							>
								<span
									class="flex items-center gap-2 tabular-nums"
									:class="row.leave && 'text-acc'"
								>
									<Icon
										v-if="!row.leave"
										name="cal"
										:size="15"
										class="text-mut"
									/>
									<span
										>{{ dayLabel(row.from)
										}}<template v-if="row.to !== row.from">
											<span class="text-mut"> – </span
											>{{ dayLabel(row.to) }}</template
										></span
									>
								</span>
								<span
									v-if="row.leave"
									class="min-w-0 border-l-2 border-warn-bar pl-3"
								>
									<router-link
										:to="{
											name: 'Form',
											params: {
												doctype: 'Leave Application',
												name: row.name,
											},
										}"
										class="block truncate font-semibold hover:underline"
										>{{ row.title }}</router-link
									>
									<span class="text-[12px] text-mut">{{ days(row.days) }}</span>
								</span>
								<span v-else class="text-ink">{{ row.title }}</span>
								<span
									v-if="row.leave"
									class="chip justify-self-end"
									:class="STATUS_TONE[row.status]"
									>{{ __(row.status) }}</span
								>
							</li>
						</ul>
						<p v-else class="px-4 py-4 text-[13px] text-mut">{{ part.empty }}</p>
					</section>
				</template>
			</template>

			<!-- Leave requests -->
			<section
				v-if="data && tab === 'requests'"
				:aria-label="__('Leave requests')"
				class="mt-4"
			>
				<div class="mb-3 flex justify-end">
					<select
						v-model="statusFilter"
						class="h-9 rounded-lg border border-line bg-surf px-3 py-0 pr-8 text-[13px] text-ink"
						:aria-label="__('Status')"
					>
						<option value="">{{ __("All requests") }}</option>
						<option v-for="s in statuses" :key="s" :value="s">{{ __(s) }}</option>
					</select>
				</div>
				<div class="overflow-x-auto rounded-xl border border-line bg-surf">
					<table class="w-full min-w-[720px] text-left text-[13.5px]">
						<thead class="border-b border-line-2 text-[12px] font-semibold text-ink-2">
							<tr>
								<th class="px-4 py-2.5">{{ __("Status") }}</th>
								<th class="px-4 py-2.5">{{ __("Leave type") }}</th>
								<th class="px-4 py-2.5">{{ __("Type") }}</th>
								<th class="px-4 py-2.5">{{ __("Leave period") }}</th>
								<th class="px-4 py-2.5">{{ __("Days taken") }}</th>
								<th class="px-4 py-2.5">{{ __("Date of request") }}</th>
								<th class="px-4 py-2.5">{{ __("Approver") }}</th>
								<th class="px-4 py-2.5">
									<span class="sr-only">{{ __("Actions") }}</span>
								</th>
							</tr>
						</thead>
						<tbody>
							<tr
								v-for="r in filteredRequests"
								:key="r.name"
								class="border-b border-line-2 last:border-b-0"
							>
								<td class="px-4 py-2.5">
									<span class="chip" :class="STATUS_TONE[requestStatus(r)]">{{
										__(requestStatus(r))
									}}</span>
								</td>
								<td class="px-4 py-2.5">
									<router-link
										:to="{
											name: 'Form',
											params: { doctype: 'Leave Application', name: r.name },
										}"
										class="font-semibold hover:underline"
										>{{ r.leave_type }}</router-link
									>
								</td>
								<td class="px-4 py-2.5 text-ink-2">
									{{ r.paid ? __("Paid") : __("Unpaid") }}
								</td>
								<td class="px-4 py-2.5 tabular-nums">
									{{ periodDate(r.from_date)
									}}<template v-if="r.to_date !== r.from_date">
										– {{ periodDate(r.to_date) }}</template
									>
								</td>
								<td class="px-4 py-2.5 tabular-nums">
									{{ days(r.total_leave_days) }}
								</td>
								<td class="px-4 py-2.5 tabular-nums text-ink-2">
									{{ periodDate(r.posting_date) }}
								</td>
								<td class="px-4 py-2.5 text-ink-2">
									{{ r.leave_approver_name || r.leave_approver || "—" }}
								</td>
								<td class="whitespace-nowrap px-4 py-2.5 text-right">
									<template v-if="r.can_withdraw">
										<span
											v-if="confirming === r.name"
											class="inline-flex items-center gap-2"
										>
											<span class="text-[12.5px] text-ink-2">{{
												__("Withdraw?")
											}}</span>
											<button
												type="button"
												class="btn-ghost h-8 text-neg"
												:disabled="busy"
												@click="withdraw(r)"
											>
												{{ __("Yes, withdraw") }}
											</button>
											<button
												type="button"
												class="btn-ghost h-8"
												@click="confirming = null"
											>
												{{ __("Keep") }}
											</button>
										</span>
										<button
											v-else
											type="button"
											class="btn-ghost h-8"
											@click="confirming = r.name"
										>
											{{ __("Withdraw") }}
										</button>
									</template>
								</td>
							</tr>
							<tr v-if="!filteredRequests.length">
								<td colspan="8" class="px-4 py-5 text-[13px] text-mut">
									{{ __("No leave requests in this period.") }}
								</td>
							</tr>
						</tbody>
					</table>
				</div>
				<p class="mt-3 text-[12.5px] text-mut">
					{{
						__(
							"You can withdraw a request until it's decided. To cancel approved leave, ask your approver.",
						)
					}}
				</p>
			</section>

			<!-- Holidays -->
			<section v-if="data && tab === 'holidays'" :aria-label="__('Holidays')" class="mt-4">
				<div class="overflow-x-auto rounded-xl border border-line bg-surf">
					<table class="w-full text-left text-[13.5px]">
						<thead class="border-b border-line-2 text-[12px] font-semibold text-ink-2">
							<tr>
								<th class="px-4 py-2.5">{{ __("Name") }}</th>
								<th class="px-4 py-2.5">{{ __("Date") }}</th>
							</tr>
						</thead>
						<tbody>
							<tr
								v-for="h in data.holidays"
								:key="h.date"
								class="border-b border-line-2 last:border-b-0"
								:class="isBefore(h.date, data.today) && 'text-mut'"
							>
								<td class="px-4 py-3">{{ h.name }}</td>
								<td class="px-4 py-3 tabular-nums">
									{{ periodDate(h.date) }}
									<span class="text-mut">{{ weekday(h.date) }}</span>
								</td>
							</tr>
							<tr v-if="!data.holidays.length">
								<td colspan="2" class="px-4 py-5 text-[13px] text-mut">
									{{ __("No holidays in this period.") }}
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</section>
		</div>
	</div>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { call } from "frappe-ui";
import Icon from "@/components/Icon.vue";
import LeaveBalanceCard from "@/components/leave/LeaveBalanceCard.vue";
import LeaveCalendar from "@/components/leave/LeaveCalendar.vue";
import { messageOf } from "@/engine/form";
import { __ } from "@/composables/i18n";
import {
	M,
	STATUS_TONE,
	dayLabel,
	days,
	isBefore,
	loadSummary,
	periodDate,
	requestStatus,
	shiftPeriod,
} from "@/composables/leave";

const route = useRoute();
const router = useRouter();

const tabs = [
	{ key: "summary", label: __("Leave summary") },
	{ key: "requests", label: __("Leave requests") },
	{ key: "holidays", label: __("Holidays") },
];
const views = [
	{ key: "list", label: __("List view"), icon: "list" },
	{ key: "calendar", label: __("Calendar view"), icon: "cal" },
];
const statuses = ["Pending", "Approved", "Rejected", "Cancelled"];

const tab = computed(() =>
	tabs.some((t) => t.key === route.query.tab) ? route.query.tab : "summary",
);
const view = computed(() => (route.query.view === "calendar" ? "calendar" : "list"));
const periodQuery = computed(() =>
	route.query.from && route.query.to ? { from: route.query.from, to: route.query.to } : {},
);

const data = ref(null);
const error = ref("");
const notice = ref(route.query.sent ? __("Your leave request has been sent for approval.") : "");
const show = ref("all");
const statusFilter = ref("");
const confirming = ref(null);
const busy = ref(false);

let seq = 0;
async function load() {
	const mine = ++seq;
	error.value = "";
	try {
		const period = periodQuery.value.from
			? { from_date: periodQuery.value.from, to_date: periodQuery.value.to }
			: null;
		const res = await loadSummary(period);
		if (mine === seq) data.value = res;
	} catch (e) {
		if (mine === seq) error.value = messageOf(e, "Couldn't load your leave.");
	}
}
watch(periodQuery, load, { immediate: true });

function setPeriod(step) {
	const p = shiftPeriod(data.value.period, step);
	router.replace({
		query: { ...route.query, from: p.from_date, to: p.to_date, sent: undefined },
	});
}
const setView = (v) =>
	router.replace({ query: { ...route.query, view: v === "list" ? undefined : v } });

const weekday = (d) =>
	new Date(String(d).slice(0, 10) + "T00:00:00").toLocaleDateString(undefined, {
		weekday: "short",
	});

const rows = computed(() => {
	if (!data.value) return [];
	const leaves = data.value.requests
		.filter((r) => requestStatus(r) !== "Cancelled")
		.map((r) => ({
			key: r.name,
			leave: true,
			name: r.name,
			from: r.from_date,
			to: r.to_date,
			title: r.leave_type,
			days: r.total_leave_days,
			status: requestStatus(r),
		}));
	const holidays = data.value.holidays.map((h) => ({
		key: `h-${h.date}`,
		leave: false,
		from: h.date,
		to: h.date,
		title: h.name,
	}));
	return [...leaves, ...holidays].filter(
		(r) => show.value === "all" || (show.value === "leave") === r.leave,
	);
});

const parts = computed(() => {
	const today = data.value?.today;
	const upcoming = rows.value.filter((r) => !isBefore(r.to, today));
	const past = rows.value.filter((r) => isBefore(r.to, today));
	return [
		{
			key: "upcoming",
			title: __("Upcoming leave & holidays"),
			rows: upcoming.sort((a, b) => a.from.localeCompare(b.from)),
			empty: __("Nothing coming up in this period."),
		},
		{
			key: "past",
			title: __("Past leave & holidays"),
			rows: past.sort((a, b) => b.from.localeCompare(a.from)),
			empty: __("Nothing earlier in this period."),
		},
	];
});

const filteredRequests = computed(() =>
	(data.value?.requests || []).filter(
		(r) => !statusFilter.value || requestStatus(r) === statusFilter.value,
	),
);

async function withdraw(r) {
	busy.value = true;
	error.value = "";
	notice.value = "";
	try {
		await call(`${M}.withdraw`, { name: r.name });
		confirming.value = null;
		notice.value = __("Your request has been withdrawn.");
		await load();
	} catch (e) {
		error.value = messageOf(e, "Couldn't withdraw the request.");
	} finally {
		busy.value = false;
	}
}
</script>
