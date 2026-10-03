<template>
	<div class="flex max-w-[1240px] flex-col gap-6 px-4 md:px-9 py-7">
		<p
			v-if="error"
			role="alert"
			class="rounded-lg bg-neg-tint px-4 py-3 text-[13.5px] text-neg"
		>
			{{ error }}
		</p>

		<header>
			<div class="kicker">{{ dateLine }}</div>
			<h1 class="mt-2 text-[38px] leading-none md:text-[52px]">
				{{ " " }}{{ __("Good") }} {{ partOfDay }}<span class="text-acc">.</span>
			</h1>
			<p
				v-if="data"
				class="mt-3.5 max-w-[860px] text-[16px] leading-relaxed text-ink-2 md:text-[19px]"
			>
				<template v-if="data.headcount">
					<router-link
						:to="{ name: 'People', query: { view: 'away' } }"
						class="sentence-link"
						>{{ plural(awayToday.length, "person", "people") }}</router-link
					>
					{{ awayToday.length === 1 ? "is" : "are" }} {{ __("away today,") }}{{ " " }}
				</template>
				<router-link to="/inbox" class="sentence-link">{{
					plural(data.inbox.items.length, "request")
				}}</router-link>
				{{ data.inbox.items.length === 1 ? "is" : "are" }} {{ __("waiting on you")
				}}<template v-if="data.payroll"
					>{{ __(", and") }}
					<router-link :to="payrollLink" class="sentence-link"
						>{{ monthName }} {{ __("payroll") }}</router-link
					>
					{{ payrollSentence }}</template
				>.
			</p>
		</header>

		<!-- The week -->
		<section
			v-if="data"
			:aria-label="__('This week')"
			class="overflow-x-auto rounded-2xl border border-line bg-surf px-5 pb-4 pt-4"
		>
			<div class="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
				<h2 class="text-[22px]">{{ __("The week") }}</h2>
				<span class="text-[13px] text-mut">{{
					__("Who's away, what's due, what to celebrate")
				}}</span>
			</div>
			<!-- Phones scroll the week sideways rather than squeezing seven days. -->
			<div class="relative min-w-[680px]">
				<div
					class="grid grid-cols-[110px_repeat(7,minmax(0,1fr))] border-b border-line-2 pb-2"
				>
					<div />
					<div
						v-for="d in days"
						:key="d.iso"
						class="px-2.5 text-[12px]"
						:class="d.today ? 'font-bold text-ink' : 'text-mut'"
					>
						<span class="uppercase tracking-wider">{{ d.dow }}</span>
						<span
							class="ml-1 font-display text-[20px] font-bold"
							:class="d.today ? 'text-acc' : 'text-ink'"
							>{{ d.dom }}</span
						>
						<div v-if="d.holiday" class="truncate text-[11px] font-semibold text-acc">
							{{ d.holiday }}
						</div>
					</div>
				</div>
				<!-- column shading: today and holidays -->
				<div
					class="pointer-events-none absolute inset-0 grid grid-cols-[110px_repeat(7,minmax(0,1fr))]"
				>
					<div />
					<div
						v-for="d in days"
						:key="d.iso"
						:class="
							d.today
								? 'rounded-lg bg-acc-tint/50'
								: d.holiday
									? 'bg-[repeating-linear-gradient(90deg,transparent_0_3px,theme(colors.line.2)_3px_4px)] opacity-60'
									: ''
						"
					/>
				</div>

				<div class="relative flex flex-col gap-0.5 pt-2">
					<div
						v-for="(lane, i) in lanes"
						:key="i"
						class="grid h-8 grid-cols-[110px_repeat(7,minmax(0,1fr))] items-center"
					>
						<div
							class="text-[11.5px] font-semibold uppercase tracking-wider text-mut"
							style="grid-column: 1; grid-row: 1"
						>
							{{ i === 0 ? "Away" : "" }}
						</div>
						<router-link
							v-for="bar in lane"
							:key="bar.name"
							:to="{
								name: 'Form',
								params: { doctype: 'Leave Application', name: bar.name },
							}"
							class="mx-1 flex h-7 min-w-0 items-center gap-2 rounded-full px-1 text-[12.5px] font-semibold"
							:class="
								bar.status === 'Open'
									? 'border-[1.5px] border-dashed border-acc bg-surf text-acc'
									: 'bg-acc-tint text-acc'
							"
							:style="{
								gridColumn: `${bar.start + 2} / ${bar.end + 3}`,
								gridRow: 1,
							}"
							:title="`${bar.employee_name} · ${bar.leave_type}${
								bar.status === 'Open' ? ' (waiting for approval)' : ''
							}`"
						>
							<Avatar :label="bar.employee_name" :size="22" />
							<span class="truncate"
								>{{ first(bar.employee_name) }}
								<span class="font-medium opacity-75"
									>· {{ bar.half_day ? "½ day" : bar.leave_type }}</span
								></span
							>
						</router-link>
					</div>
					<div v-if="!bars.length" class="grid h-8 grid-cols-[110px_1fr] items-center">
						<div class="text-[11.5px] font-semibold uppercase tracking-wider text-mut">
							{{ __("Away") }}
						</div>
						<div class="text-[13px] text-mut">{{ __("Nobody this week") }}</div>
					</div>

					<div class="my-1.5 h-px bg-line-2" />
					<div
						class="grid min-h-8 grid-cols-[110px_repeat(7,minmax(0,1fr))] items-start"
					>
						<div
							class="pt-1.5 text-[11.5px] font-semibold uppercase tracking-wider text-mut"
						>
							{{ __("Moments") }}
						</div>
						<div v-for="d in days" :key="d.iso" class="flex flex-col gap-1 px-1">
							<router-link
								v-for="m in d.moments"
								:key="m.kind + m.employee"
								:to="{ name: 'People', query: { peek: m.employee } }"
								class="truncate rounded-md px-2 py-1 text-[12px] font-semibold"
								:class="momentTone(m.kind)"
							>
								{{ first(m.employee_name) }} · {{ m.label }}
							</router-link>
						</div>
					</div>
				</div>
			</div>
		</section>

		<!-- Bottom row -->
		<div
			v-if="data"
			class="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.8fr)]"
		>
			<section :aria-label="__('Waiting on you')">
				<div class="mb-1.5 flex items-baseline gap-2.5">
					<h2 class="text-[22px]">{{ __("Waiting on you") }}</h2>
					<span class="text-[13px] text-mut">{{
						data.inbox.items.length
							? `${Math.min(4, data.inbox.items.length)} of ${
									data.inbox.items.length
								}`
							: ""
					}}</span>
					<router-link to="/inbox" class="ml-auto text-[13px] font-semibold text-acc">{{
						__("Open inbox →")
					}}</router-link>
				</div>
				<p
					v-if="!data.inbox.items.length"
					class="border-t border-line-2 py-3 text-[13.5px] text-mut"
				>
					{{ __("All clear.") }}
				</p>
				<div
					v-for="item in data.inbox.items.slice(0, 4)"
					:key="item.doctype + item.name"
					class="flex items-center gap-3 border-t border-line-2 py-2.5"
				>
					<Avatar :label="item.employee_name" :size="32" />
					<div class="min-w-0 flex-grow">
						<div class="text-[14px] font-semibold">
							{{ item.employee_name }}
							<span class="font-medium text-mut">· {{ item.kind }}</span>
						</div>
						<div class="truncate text-[13px] text-ink-2">{{ summary(item) }}</div>
					</div>
					<router-link
						to="/inbox"
						:aria-label="`Review ${item.employee_name}'s request`"
						class="flex h-8 items-center rounded-lg border border-line px-2.5 text-[12.5px] font-semibold hover:bg-side"
						>{{ __("Review") }}</router-link
					>
					<button
						type="button"
						:aria-label="`Approve ${item.employee_name}'s request`"
						class="flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-surf disabled:opacity-40"
						:disabled="busy === item.name"
						@click="approve(item)"
					>
						<Icon name="check" :size="15" :stroke="2" />
					</button>
				</div>
			</section>

			<section v-if="data.payroll" :aria-label="__('Payroll')">
				<div class="flex items-baseline gap-2.5">
					<h2 class="text-[22px]">{{ monthName }} {{ __("payroll") }}</h2>
					<span
						class="chip ml-auto"
						:class="
							data.payroll.stage === 'Slips submitted'
								? 'bg-pos-tint text-pos'
								: 'bg-warn-tint text-warn'
						"
						>{{ data.payroll.stage }}</span
					>
				</div>
				<div class="mt-3 flex gap-1.5">
					<div v-for="(s, i) in stages" :key="s" class="flex flex-grow flex-col gap-1.5">
						<div
							class="h-1 rounded-sm"
							:class="
								i < stageIndex ? 'bg-ink' : i === stageIndex ? 'bg-acc' : 'bg-line'
							"
						/>
						<span
							class="text-[11.5px]"
							:class="i <= stageIndex ? 'font-semibold text-ink' : 'text-mut'"
							>{{ s }}</span
						>
					</div>
				</div>
				<div v-if="data.payroll.totals.slips" class="mt-3.5 flex items-baseline gap-2">
					<span class="font-display text-[30px] font-bold tabular-nums">{{
						money(data.payroll.totals.net)
					}}</span>
					<span class="text-[13px] text-mut"
						>{{ __("net ·") }} {{ data.payroll.totals.slips }} {{ __("slips") }}</span
					>
				</div>
				<router-link
					:to="payrollLink"
					class="mt-2 inline-flex text-[13.5px] font-semibold text-acc"
					>{{
						data.payroll.entry ? "Open payroll run →" : "Start this month's run →"
					}}</router-link
				>
			</section>

			<section v-if="data.headcount" :aria-label="__('Headcount')">
				<div class="mb-2.5 flex flex-col">
					<span class="font-display text-[22px] font-bold"
						>{{ totalPeople }} {{ __("people") }}</span
					>
					<span class="text-[13px] text-mut">{{
						data.joining_soon
							? `${data.joining_soon} joining soon`
							: "Active employees"
					}}</span>
				</div>
				<div class="flex h-2.5 gap-0.5 overflow-hidden rounded">
					<div
						v-for="(h, i) in data.headcount"
						:key="h.department"
						:style="{ flexGrow: h.count, background: palette[i % palette.length] }"
						:title="`${h.department}: ${h.count}`"
					/>
				</div>
				<ul class="mt-2.5 flex flex-col gap-1">
					<li
						v-for="(h, i) in data.headcount.slice(0, 6)"
						:key="h.department"
						class="flex items-center gap-2 text-[12.5px] text-ink-2"
					>
						<span
							class="h-2 w-2 rounded-sm"
							:style="{ background: palette[i % palette.length] }"
						/>
						<span class="flex-grow truncate">{{ dept(h.department) }}</span>
						<span class="tabular-nums text-mut">{{ h.count }}</span>
					</li>
				</ul>
			</section>
		</div>

		<div v-if="!data && !error" class="text-[13.5px] text-mut">{{ __("Loading…") }}</div>
	</div>
</template>

<script setup>
import { dept } from "@/composables/format";
import { computed, onMounted, ref } from "vue";
import { call } from "frappe-ui";
import dayjs from "dayjs";
import Icon from "@/components/Icon.vue";
import Avatar from "@/components/Avatar.vue";
import { decide, inboxCount } from "@/composables/inbox";
import { messageOf } from "@/engine/form";

const data = ref(null);
const error = ref("");
const busy = ref("");
const palette = ["#1864C8", "#B8286E", "#1E7F3C", "#6A3BD0", "#B24F06", "#394264"];
const stages = ["Period", "Employees", "Slips", "Submitted"];

const hour = new Date().getHours();
const partOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
const dateLine = computed(() => `${dayjs().format("dddd · D MMMM")} · Week ${weekOfYear()}`);
const monthName = computed(() => dayjs(data.value?.payroll?.month).format("MMMM"));

function weekOfYear() {
	const d = dayjs();
	const start = d.startOf("year");
	return Math.ceil((d.diff(start, "day") + start.day() + 1) / 7);
}

const days = computed(() => {
	if (!data.value) return [];
	const start = dayjs(data.value.week.start);
	const holidays = Object.fromEntries(
		(data.value.holidays || []).map((h) => [
			h.holiday_date,
			strip(h.description) || (h.weekly_off ? "Weekly off" : "Holiday"),
		]),
	);
	return Array.from({ length: 7 }, (_, i) => {
		const d = start.add(i, "day");
		const iso = d.format("YYYY-MM-DD");
		return {
			iso,
			dow: d.format("ddd"),
			dom: d.format("D"),
			today: iso === data.value.today,
			holiday:
				holidays[iso] && !/weekly off|sunday|saturday/i.test(holidays[iso])
					? holidays[iso]
					: null,
			moments: (data.value.moments || []).filter((m) => m.date === iso),
		};
	});
});

const bars = computed(() => {
	if (!data.value) return [];
	const start = dayjs(data.value.week.start);
	return (data.value.away || []).map((a) => ({
		...a,
		start: Math.max(0, dayjs(a.from_date).diff(start, "day")),
		end: Math.min(6, dayjs(a.to_date).diff(start, "day")),
	}));
});
// Bars that don't overlap share a row, so the week stays compact.
const lanes = computed(() => {
	const out = [];
	for (const bar of [...bars.value].sort((a, b) => a.start - b.start)) {
		const lane = out.find((l) => l[l.length - 1].end < bar.start);
		lane ? lane.push(bar) : out.push([bar]);
	}
	return out;
});
const awayToday = computed(() =>
	(data.value?.away || []).filter(
		(a) => a.from_date <= data.value.today && a.to_date >= data.value.today,
	),
);
const totalPeople = computed(() => (data.value?.headcount || []).reduce((a, h) => a + h.count, 0));

const payrollLink = computed(() =>
	data.value?.payroll?.entry
		? {
				name: "Form",
				params: { doctype: "Payroll Entry", name: data.value.payroll.entry.name },
			}
		: { name: "Form", params: { doctype: "Payroll Entry", name: "new" } },
);
const stageIndex = computed(
	() =>
		({ "Not started": 0, Draft: 1, Submitted: 2, "Slips created": 2, "Slips submitted": 3 })[
			data.value?.payroll?.stage
		] ?? 0,
);
const payrollSentence = computed(() => {
	const p = data.value.payroll;
	const left = dayjs(p.pay_date).diff(dayjs(), "day");
	if (p.stage === "Slips submitted") return "is done";
	if (p.stage === "Not started")
		return `hasn't started yet${left >= 0 ? ` (${left} days left)` : ""}`;
	return `is at “${p.stage.toLowerCase()}”${left >= 0 ? ` with ${left} days to go` : ""}`;
});

const first = (n) => String(n || "").split(" ")[0];
const strip = (html) =>
	new DOMParser().parseFromString(String(html || ""), "text/html").body.textContent;
const plural = (n, one, many) => `${n === 0 ? "No" : n} ${n === 1 ? one : many || `${one}s`}`;
const money = (n) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
const momentTone = (k) =>
	({
		birthday: "bg-[#FCE1EF] text-[#B8286E]",
		anniversary: "bg-[#EBE2FE] text-[#6A3BD0]",
		joining: "bg-pos-tint text-pos",
		probation: "bg-warn-tint text-warn",
		leaving: "bg-neg-tint text-neg",
	})[k] || "bg-line-2 text-ink-2";

function summary(i) {
	const range = (a, b) =>
		a === b || !b
			? dayjs(a).format("D MMM")
			: `${dayjs(a).format("D MMM")} – ${dayjs(b).format("D MMM")}`;
	if (i.doctype === "Leave Application")
		return `${i.leave_type} · ${range(i.from_date, i.to_date)}`;
	if (i.doctype === "Expense Claim")
		return `${Number(i.total_claimed_amount || 0).toLocaleString()} claimed`;
	if (i.doctype === "Shift Request") return `${i.shift_type} · ${range(i.from_date, i.to_date)}`;
	if (i.doctype === "Attendance Request")
		return `${i.reason || "Attendance"} · ${range(i.from_date, i.to_date)}`;
	return i.name;
}

async function approve(item) {
	busy.value = item.name;
	try {
		await decide(item.doctype, item.name, "Approve");
		data.value.inbox.items = data.value.inbox.items.filter(
			(x) => !(x.doctype === item.doctype && x.name === item.name),
		);
		inboxCount.value = data.value.inbox.items.length;
	} catch (e) {
		error.value = messageOf(e, "Couldn't approve that request.");
	} finally {
		busy.value = "";
	}
}

onMounted(async () => {
	try {
		data.value = await call("hrms.briskrew.today.get_today");
		inboxCount.value = data.value.inbox.items.length;
	} catch (e) {
		error.value = messageOf(e, "Couldn't load today.");
	}
});
</script>

<style scoped>
.sentence-link {
	@apply text-ink underline decoration-acc decoration-2 underline-offset-[5px] hover:text-acc;
}
</style>
