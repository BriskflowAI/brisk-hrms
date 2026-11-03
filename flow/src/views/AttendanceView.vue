<template>
	<div class="flex h-full min-h-0 flex-col">
		<header class="flex flex-wrap items-end gap-3 border-b border-line px-4 pb-4 pt-5 md:px-7">
			<div class="mr-auto">
				<div class="kicker">{{ __("Time · Attendance") }}</div>
				<h1 class="mt-1.5 text-[28px] leading-none md:text-[36px]">
					{{ tab === "today" ? __("Who's in") : __("Attendance") }}
				</h1>
			</div>
			<div role="tablist" class="flex rounded-lg border border-line bg-surf p-0.5">
				<button
					v-for="t in tabs"
					:key="t.key"
					type="button"
					role="tab"
					:aria-selected="tab === t.key"
					class="rounded-md px-3 py-1.5 text-[13.5px] font-semibold"
					:class="tab === t.key ? 'bg-ink text-surf' : 'text-ink-2 hover:text-ink'"
					@click="tab = t.key"
				>
					{{ t.label }}
				</button>
			</div>
			<router-link
				:to="{ name: 'Report', params: { name: 'Monthly Attendance Sheet' } }"
				class="btn-ghost"
				>{{ __("Monthly sheet") }}</router-link
			>
		</header>

		<div class="min-h-0 flex-grow overflow-y-auto px-4 pb-10 md:px-7">
			<!-- Setting it up for everyone (HR managers, until it's done) -->
			<section
				v-if="setup?.can_set_up && !setup.done"
				:aria-label="__('Set up attendance')"
				class="mt-5 rounded-xl border border-acc/40 bg-acc-tint/40 px-5 py-4"
			>
				<h2 class="text-[17px] font-semibold">
					{{ __("Set up check-ins and attendance for everyone") }}
				</h2>
				<ul class="mt-2 space-y-1 text-[13.5px]">
					<li v-for="s in setupSteps" :key="s.key" class="flex items-start gap-2">
						<span
							class="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
							:class="s.done ? 'bg-pos text-surf' : 'border border-line bg-surf'"
							aria-hidden="true"
							>{{ s.done ? "✓" : "" }}</span
						>
						<span :class="s.done && 'text-mut line-through'">{{ s.label }}</span>
					</li>
				</ul>
				<p v-if="setup.without_user" class="mt-2 text-[13px] text-ink-2">
					{{ setup.without_user }}
					{{
						__(
							"active employees have no user, so they can't check in themselves; HR can still add their check-ins.",
						)
					}}
				</p>
				<p class="mt-2 text-[13px] text-ink-2">
					{{
						__(
							"Attendance is marked from today on; earlier days are left as they are. Existing shifts and shift assignments stay as they are.",
						)
					}}
				</p>
				<div class="mt-3 flex flex-wrap items-center gap-3">
					<button
						type="button"
						class="btn-ink"
						:disabled="settingUp"
						@click="applySetup"
					>
						{{ settingUp ? __("Setting up…") : __("Set up attendance") }}
					</button>
					<p v-if="setupError" role="alert" class="text-[13px] text-neg">
						{{ setupError }}
					</p>
				</div>
			</section>
			<p
				v-if="setupDone"
				role="status"
				class="mt-5 rounded-lg bg-pos-tint px-4 py-3 text-[13.5px] text-pos"
			>
				{{ setupDone }}
			</p>

			<!-- Filters -->
			<section
				:aria-label="__('Filters')"
				class="mt-5 flex flex-wrap items-end gap-3 text-[13px]"
			>
				<label v-if="tab === 'today'" class="flex flex-col gap-1">
					<span class="font-semibold text-ink-2">{{ __("Day") }}</span>
					<input v-model="date" type="date" :class="inputCls" />
				</label>
				<label v-else class="flex flex-col gap-1">
					<span class="font-semibold text-ink-2">{{ __("Month") }}</span>
					<input v-model="month" type="month" :class="inputCls" />
				</label>
				<label
					v-if="(data?.companies || []).length > 1"
					class="flex min-w-[180px] flex-col gap-1"
				>
					<span class="font-semibold text-ink-2">{{ __("Company") }}</span>
					<select v-model="company" :class="inputCls">
						<option value="">{{ __("All companies") }}</option>
						<option v-for="c in data.companies" :key="c" :value="c">{{ c }}</option>
					</select>
				</label>
				<label class="flex min-w-[180px] flex-col gap-1">
					<span class="font-semibold text-ink-2">{{ __("Department") }}</span>
					<select v-model="department" :class="inputCls">
						<option value="">{{ __("All departments") }}</option>
						<option v-for="d in data?.departments || []" :key="d" :value="d">
							{{ dept(d) }}
						</option>
					</select>
				</label>
			</section>

			<p
				v-if="error"
				role="alert"
				class="mt-5 rounded-lg bg-neg-tint px-4 py-3 text-[13.5px] text-neg"
			>
				{{ error }}
			</p>

			<!-- One day -->
			<template v-else-if="tab === 'today' && day">
				<section
					:aria-label="__('Summary')"
					class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
				>
					<button
						v-for="c in summaryCards"
						:key="c.key"
						type="button"
						class="rounded-xl border bg-surf px-4 py-3 text-left"
						:class="
							only === c.key
								? 'border-acc shadow-[inset_0_0_0_1px] shadow-acc'
								: 'border-line hover:border-acc'
						"
						:aria-pressed="only === c.key"
						@click="only = only === c.key ? '' : c.key"
					>
						<div class="text-[12.5px] font-semibold text-ink-2">{{ c.label }}</div>
						<div
							class="mt-0.5 font-display text-[26px] font-bold leading-tight"
							:class="c.tone"
						>
							{{ c.count }}
						</div>
					</button>
				</section>

				<div
					class="mt-4 overflow-x-auto rounded-xl border border-line bg-surf"
					:class="loading && 'opacity-60'"
				>
					<table class="w-full text-[13.5px]">
						<thead>
							<tr class="bg-paper">
								<th :class="th">{{ __("Person") }}</th>
								<th :class="th">{{ __("Status") }}</th>
								<th :class="th">{{ __("In") }}</th>
								<th :class="th">{{ __("Out") }}</th>
								<th :class="[th, 'text-right']">{{ __("Hours") }}</th>
								<th :class="th">{{ __("Working on") }}</th>
								<th :class="th">
									<span class="sr-only">{{ __("Where") }}</span>
								</th>
							</tr>
						</thead>
						<tbody>
							<tr v-if="!shownRows.length">
								<td colspan="7" class="px-4 py-10 text-center text-mut">
									{{ __("Nobody to show.") }}
								</td>
							</tr>
							<tr
								v-for="r in shownRows"
								:key="r.employee"
								class="border-t border-line-2 hover:bg-paper"
							>
								<td :class="td">
									<router-link
										:to="{
											name: 'Form',
											params: { doctype: 'Employee', name: r.employee },
										}"
										class="flex items-center gap-2.5 hover:text-acc"
									>
										<Avatar
											:label="r.employee_name"
											:image="r.image || ''"
											:size="28"
										/>
										<span>
											<span class="font-semibold">{{
												r.employee_name
											}}</span>
											<span class="block text-[12px] text-mut">{{
												dept(r.department) || r.designation || ""
											}}</span>
										</span>
									</router-link>
								</td>
								<td :class="td">
									<span class="chip" :class="tones[r.status]">{{
										labels[r.status]
									}}</span>
									<span
										v-if="r.short"
										class="chip ml-1.5 bg-warn-tint text-warn"
										>{{ __("Short") }}</span
									>
									<span v-if="r.leave_type" class="block text-[12px] text-mut">{{
										r.leave_type
									}}</span>
								</td>
								<td :class="[td, 'tabular-nums']">
									{{ time(r.first_in) || "—" }}
								</td>
								<td :class="[td, 'tabular-nums']">
									{{ time(r.last_out) || "—" }}
								</td>
								<td :class="[td, 'text-right tabular-nums']">
									{{ r.hours ? duration(r.hours) : "—" }}
								</td>
								<td :class="[td, 'max-w-[280px] text-ink-2']">
									<span class="line-clamp-2" :title="r.working_on || ''">{{
										r.working_on || "—"
									}}</span>
								</td>
								<td :class="td">
									<a
										v-if="r.location"
										:href="`https://www.openstreetmap.org/?mlat=${r.location.latitude}&mlon=${r.location.longitude}#map=17/${r.location.latitude}/${r.location.longitude}`"
										target="_blank"
										rel="noopener"
										class="text-[12.5px] font-semibold text-acc hover:underline"
										>{{ __("Map") }}</a
									>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</template>

			<!-- A month -->
			<template v-else-if="tab === 'month' && grid">
				<div
					class="mt-4 overflow-x-auto rounded-xl border border-line bg-surf"
					:class="loading && 'opacity-60'"
				>
					<table class="w-full border-collapse text-[12.5px]">
						<thead>
							<tr class="bg-paper">
								<th
									class="sticky left-0 z-10 min-w-[180px] bg-paper px-3 py-2 text-left text-[11.5px] font-semibold uppercase tracking-[0.08em] text-mut"
								>
									{{ __("Person") }}
								</th>
								<th
									v-for="d in grid.days"
									:key="d.date"
									class="min-w-[28px] px-0.5 py-1.5 text-center font-semibold text-mut"
									:class="d.date === today && 'text-acc'"
								>
									<span class="block text-[10px] font-normal">{{
										d.weekday.slice(0, 2)
									}}</span>
									{{ Number(d.date.slice(8)) }}
								</th>
								<th
									v-for="t in totalCols"
									:key="t.key"
									class="px-2 py-1.5 text-center font-semibold text-mut"
									:title="t.title"
								>
									{{ t.key }}
								</th>
							</tr>
						</thead>
						<tbody>
							<tr v-if="!grid.rows.length">
								<td
									:colspan="grid.days.length + 6"
									class="px-4 py-10 text-center text-mut"
								>
									{{ __("Nobody to show.") }}
								</td>
							</tr>
							<tr
								v-for="r in grid.rows"
								:key="r.employee"
								class="border-t border-line-2"
							>
								<th
									scope="row"
									class="sticky left-0 z-10 bg-surf px-3 py-1.5 text-left font-semibold"
								>
									{{ r.employee_name }}
									<span class="block text-[11.5px] font-normal text-mut">{{
										dept(r.department)
									}}</span>
								</th>
								<td
									v-for="(c, i) in r.cells"
									:key="i"
									class="p-0.5 text-center"
									:title="cellTitle(c, grid.days[i])"
								>
									<span
										class="relative mx-auto flex h-6 w-6 items-center justify-center rounded text-[11px] font-bold"
										:class="cellTone[c.code] || ''"
										>{{ cellText(c)
										}}<span
											v-if="c.short"
											class="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-warn"
											aria-hidden="true"
									/></span>
								</td>
								<td
									v-for="t in totalCols"
									:key="t.key"
									class="px-2 py-1.5 text-center tabular-nums"
								>
									{{ r.totals[t.field] || 0 }}
								</td>
							</tr>
						</tbody>
					</table>
				</div>
				<p class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-2">
					<span v-for="l in legend" :key="l.code" class="flex items-center gap-1.5">
						<span
							class="flex h-5 w-5 items-center justify-center rounded text-[10.5px] font-bold"
							:class="cellTone[l.code]"
							>{{ l.text }}</span
						>{{ l.label }}
					</span>
					<span class="flex items-center gap-1.5">
						<span class="h-2 w-2 rounded-full bg-warn" aria-hidden="true" />{{
							__("Short day (under 9 hours)")
						}}
					</span>
				</p>
			</template>
		</div>
	</div>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { call } from "frappe-ui";
import Avatar from "@/components/Avatar.vue";
import { messageOf } from "@/engine/form";
import { __ } from "@/composables/i18n";
import { dept } from "@/composables/format";

const M = "hrms.briskrew.attendance";
const route = useRoute();
const router = useRouter();

const inputCls =
	"h-9 w-full rounded-lg border border-line bg-surf px-3 text-[13.5px] text-ink focus:border-acc focus:ring-1 focus:ring-acc";
const th =
	"px-3 py-2.5 text-left text-[11.5px] font-semibold uppercase tracking-[0.08em] text-mut whitespace-nowrap";
const td = "px-3 py-2 align-middle whitespace-nowrap";

const tabs = [
	{ key: "today", label: __("Day") },
	{ key: "month", label: __("Month") },
];
const pad = (n) => String(n).padStart(2, "0");
const now = new Date();
const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

const tab = ref(route.query.tab === "month" ? "month" : "today");
const date = ref(route.query.date || today);
const month = ref(route.query.month || today.slice(0, 7));
const company = ref(route.query.company || "");
const department = ref(route.query.department || "");
const only = ref("");

const day = ref(null);
const grid = ref(null);
const loading = ref(false);
const error = ref("");
const setup = ref(null);
const settingUp = ref(false);
const setupError = ref("");
const setupDone = ref("");

const data = computed(() => (tab.value === "today" ? day.value : grid.value));

const labels = {
	in: __("In"),
	out: __("Checked out"),
	not_in: __("Not in"),
	absent: __("Absent"),
	leave: __("On leave"),
	off: __("Day off"),
	not_yet: __("Not started"),
};
const tones = {
	in: "bg-pos-tint text-pos",
	out: "bg-line-2 text-ink-2",
	not_in: "bg-neg-tint text-neg",
	absent: "bg-neg-tint text-neg",
	leave: "bg-acc-tint text-acc",
	off: "bg-line-2 text-mut",
	not_yet: "bg-line-2 text-mut",
};
const summaryCards = computed(() => {
	const s = day.value?.summary || {};
	return [
		{ key: "in", label: __("In now"), count: s.in || 0, tone: "text-pos" },
		{ key: "short", label: __("Short day"), count: s.short || 0, tone: s.short ? "text-warn" : "" },
		{ key: "out", label: __("Checked out"), count: s.out || 0 },
		{
			key: "not_in",
			label: date.value === today ? __("Not in") : __("Absent"),
			count: (s.not_in || 0) + (s.absent || 0),
			tone: s.not_in || s.absent ? "text-neg" : "",
		},
		{ key: "leave", label: __("On leave"), count: s.leave || 0 },
		{ key: "off", label: __("Day off / later"), count: (s.off || 0) + (s.not_yet || 0) },
	];
});
const shownRows = computed(() => {
	const rows = day.value?.rows || [];
	if (!only.value) return rows;
	if (only.value === "short") return rows.filter((r) => r.short);
	if (only.value === "not_in")
		return rows.filter((r) => ["not_in", "absent"].includes(r.status));
	if (only.value === "off") return rows.filter((r) => ["off", "not_yet"].includes(r.status));
	return rows.filter((r) => r.status === only.value);
});

const cellTone = {
	P: "bg-pos-tint text-pos",
	W: "bg-pos-tint text-pos",
	H: "bg-warn-tint text-warn",
	A: "bg-neg-tint text-neg",
	L: "bg-acc-tint text-acc",
	off: "bg-line-2 text-mut",
	"?": "border border-dashed border-line text-mut",
};
const legend = [
	{ code: "P", text: "P", label: __("Present") },
	{ code: "H", text: "H", label: __("Half day") },
	{ code: "A", text: "A", label: __("Absent") },
	{ code: "L", text: "L", label: __("On leave") },
	{ code: "W", text: "W", label: __("Work from home") },
	{ code: "off", text: "·", label: __("Day off") },
	{ code: "?", text: "", label: __("Not marked") },
];
const totalCols = [
	{ key: "P", field: "P", title: __("Present") },
	{ key: "H", field: "H", title: __("Half days") },
	{ key: "A", field: "A", title: __("Absent") },
	{ key: "L", field: "L", title: __("On leave") },
	{ key: "short", field: "short", title: __("Short days") },
];
const cellText = (c) => (c.code === "off" ? "·" : c.code === "?" || c.code === "-" ? "" : c.code);
function cellTitle(c, d) {
	const what =
		{
			P: __("Present"),
			A: __("Absent"),
			H: __("Half day"),
			L: __("On leave"),
			W: __("Work from home"),
			off: __("Day off"),
			"?": __("Not marked"),
			"-": __("Not joined yet"),
		}[c.code] || "";
	const hours = c.hours ? ` · ${duration(c.hours)}` : "";
	return `${d.date}${what ? ` · ${what}` : ""}${hours}${c.short ? ` · ${__("Short day")}` : ""}`;
}

const time = (t) =>
	t
		? new Date(String(t).replace(" ", "T")).toLocaleTimeString([], {
				hour: "2-digit",
				minute: "2-digit",
		  })
		: "";
const duration = (h) => {
	const m = Math.round(h * 60);
	return `${Math.floor(m / 60)}h ${pad(m % 60)}m`;
};

const setupSteps = computed(() => {
	const s = setup.value;
	if (!s?.steps) return [];
	const t = s.shift_settings;
	return [
		{
			key: "app_checkin",
			done: s.steps.app_checkin,
			label: __("Everyone can check in from briskrew and the employee app"),
		},
		{
			key: "location",
			done: s.steps.location,
			label: __("Each check-in records where it was made"),
		},
		{
			key: "shift",
			done: s.steps.shift && s.steps.holidays,
			label: `${__("Flexible hours, Monday to Saturday: check in at any time")}. ${__(
				"Every hour clocked is recorded; under",
			)} ${t.absent_below}h ${__("is absent and under")} ${t.target_hours}h ${__(
				"is flagged as a short day",
			)}`,
		},
		{
			key: "everyone_has_shift",
			done: s.steps.everyone_has_shift,
			label: s.without_shift
				? `${s.without_shift} ${__("of")} ${s.employees} ${__(
						"active employees get it as their default shift (they have no shift yet)",
				  )}`
				: __("Every active employee has a shift"),
		},
	];
});

let seq = 0;
async function load() {
	const mine = ++seq;
	loading.value = true;
	error.value = "";
	try {
		const filters = { company: company.value || null, department: department.value || null };
		if (tab.value === "today") {
			const res = await call(`${M}.team_day`, { date: date.value, ...filters });
			if (mine === seq) day.value = res;
		} else {
			const res = await call(`${M}.team_month`, { month: month.value, ...filters });
			if (mine === seq) grid.value = res;
		}
	} catch (e) {
		if (mine === seq) error.value = messageOf(e);
	} finally {
		if (mine === seq) loading.value = false;
	}
}

async function loadSetup() {
	try {
		setup.value = await call(`${M}.attendance_setup_status`);
	} catch {
		setup.value = null;
	}
}

async function applySetup() {
	settingUp.value = true;
	setupError.value = "";
	try {
		const res = await call(`${M}.apply_attendance_setup`);
		setup.value = res;
		setupDone.value = `${__("Attendance is set up.")} ${
			res.given_shift ? `${res.given_shift} ${__("people got the flexible shift.")} ` : ""
		}${__(
			"Check-ins from today turn into attendance automatically, every hour after the shift ends.",
		)}`;
		load();
	} catch (e) {
		setupError.value = messageOf(e);
	} finally {
		settingUp.value = false;
	}
}

watch(
	[tab, date, month, company, department],
	([t, d, m, c, dep]) => {
		router.replace({
			query: {
				...(t === "month" && { tab: "month" }),
				...(t === "today" && d !== today && { date: d }),
				...(t === "month" && m !== today.slice(0, 7) && { month: m }),
				...(c && { company: c }),
				...(dep && { department: dep }),
			},
		});
		only.value = "";
		load();
	},
	{ immediate: true },
);
loadSetup();
</script>
