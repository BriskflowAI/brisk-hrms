<template>
	<div class="flex h-full min-h-0">
		<!-- Queue -->
		<section
			aria-label="Requests"
			class="flex w-[340px] shrink-0 flex-col gap-3 border-r border-line px-3.5 pt-6"
		>
			<div class="flex items-baseline gap-2.5 px-2">
				<h1 class="text-[36px] leading-none">Inbox</h1>
				<span class="text-[13px] text-mut">{{
					loading ? "Loading…" : `${pending.length} to decide`
				}}</span>
			</div>

			<div
				role="tablist"
				aria-label="Inbox view"
				class="mx-2 flex gap-0.5 rounded-[9px] bg-side p-[3px]"
			>
				<button
					v-for="t in tabs"
					:key="t.key"
					type="button"
					role="tab"
					:aria-selected="tab === t.key"
					class="h-[30px] flex-grow rounded-[7px] text-[13px]"
					:class="
						tab === t.key
							? 'bg-surf font-bold text-ink shadow-sm'
							: 'font-medium text-ink-2'
					"
					@click="tab = t.key"
				>
					{{ t.label }} <span class="tabular-nums text-mut">{{ t.count }}</span>
				</button>
			</div>

			<div v-if="tab === 'decide'" class="flex flex-wrap gap-1.5 px-2">
				<button
					v-for="k in kinds"
					:key="k.key"
					type="button"
					class="h-7 rounded-full border px-2.5 text-[12.5px] font-semibold"
					:class="
						kind === k.key
							? 'border-ink bg-ink text-surf'
							: 'border-line bg-surf text-ink'
					"
					@click="kind = k.key"
				>
					{{ k.label }} <span class="tabular-nums opacity-70">{{ k.count }}</span>
				</button>
			</div>

			<div
				v-if="tab === 'decide' && visible.length > 1"
				class="mx-2 flex items-center gap-2 rounded-[10px] bg-acc-tint px-3 py-2 text-[12.5px] text-ink"
			>
				<Icon name="check" :size="15" :stroke="2.2" class="text-acc" />
				<span class="flex-grow">Approve the ones that pass every check</span>
				<button
					type="button"
					class="font-bold text-acc hover:text-acc-hover"
					@click="confirmBulk = true"
				>
					Review {{ visible.length }}
				</button>
			</div>

			<ul class="-mx-1 flex min-h-0 flex-grow flex-col gap-0.5 overflow-y-auto px-1 pb-4">
				<li v-if="!loading && !listed.length" class="px-3 py-10 text-center">
					<p class="font-display text-[18px] font-bold">
						{{ tab === "decide" ? "All clear" : "Nothing decided yet" }}
					</p>
					<p class="mt-1.5 text-[13px] text-mut">
						{{
							tab === "decide"
								? "New requests assigned to you land here."
								: "Requests you approve or reject in this session show up here."
						}}
					</p>
				</li>
				<li v-for="item in listed" :key="key(item)">
					<button
						type="button"
						class="flex w-full gap-2.5 rounded-[10px] px-3 py-2.5 text-left"
						:class="
							key(item) === key(current)
								? 'bg-surf shadow-[0_0_0_1.5px] shadow-ink'
								: 'hover:bg-surf/70'
						"
						@click="select(item)"
					>
						<Avatar :label="item.employee_name" :size="30" />
						<span class="min-w-0 flex-grow">
							<span class="flex items-baseline gap-2">
								<span class="flex-grow truncate text-[13.5px] font-bold">{{
									item.employee_name
								}}</span>
								<span class="text-[12px] tabular-nums text-mut">{{
									item.outcome || ago(item.creation)
								}}</span>
							</span>
							<span class="mt-0.5 block truncate text-[12.5px] text-ink-2">
								<span class="font-semibold text-acc">{{ item.kind }}</span> ·
								{{ summary(item) }}
							</span>
						</span>
					</button>
				</li>
			</ul>
		</section>

		<!-- Decision -->
		<section aria-label="Decision" class="flex min-w-0 flex-grow flex-col">
			<div
				v-if="!current"
				class="flex flex-grow items-center justify-center p-10 text-center"
			>
				<div>
					<p class="font-display text-[26px] font-bold">
						{{ pending.length ? "Pick a request" : "Nothing waiting on you" }}
					</p>
					<p class="mt-2 text-[14px] text-mut">
						Tip: J and K move through the list, A approves, R rejects.
					</p>
				</div>
			</div>

			<template v-else>
				<div class="min-h-0 flex-grow overflow-y-auto px-11 pb-6 pt-8">
					<p
						v-if="error"
						class="mb-5 rounded-lg bg-neg-tint px-4 py-2.5 text-[13.5px] text-neg"
					>
						{{ error }}
					</p>
					<div class="kicker text-acc">
						{{ current.kind }} request · sent {{ ago(current.creation) }} ago
					</div>
					<h2 class="mt-3 max-w-[640px] text-[40px] leading-[1.05]">{{ headline }}</h2>
					<p
						v-if="subline"
						class="mt-3 max-w-[620px] text-[15.5px] leading-relaxed text-ink-2"
					>
						{{ subline }}
					</p>
					<blockquote
						v-if="quote"
						class="mt-4 max-w-[620px] border-0 p-0 font-display text-[19px] font-medium leading-snug text-ink"
					>
						“{{ quote }}”
					</blockquote>

					<div v-if="ctx" class="mt-7 flex flex-col gap-7">
						<!-- Leave: balance + team week -->
						<div
							v-if="current.doctype === 'Leave Application'"
							class="grid grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] gap-9"
						>
							<div>
								<div class="mb-3 text-[13px] font-bold">
									{{ current.leave_type }} balance
								</div>
								<div
									class="flex max-w-[190px] flex-wrap gap-1.5"
									aria-hidden="true"
								>
									<span
										v-for="(d, i) in dots"
										:key="i"
										class="h-5 w-5 rounded-full"
										:class="d"
									/>
								</div>
								<ul class="mt-3 flex flex-col gap-1 text-[12.5px] text-ink-2">
									<li>{{ fmt(ctx.leave_balance) }} available now</li>
									<li>{{ fmt(current.total_leave_days) }} in this request</li>
									<li :class="ctx.balance_after < 0 ? 'font-bold text-neg' : ''">
										{{ fmt(ctx.balance_after) }} left after
									</li>
								</ul>
							</div>
							<div v-if="ctx.team.members.length">
								<div class="mb-2.5 text-[13px] font-bold">
									{{ current.department }} those days
								</div>
								<div class="overflow-x-auto">
									<table class="border-separate border-spacing-1 text-[12px]">
										<thead>
											<tr>
												<th />
												<th
													v-for="d in ctx.team.days"
													:key="d.date"
													class="px-1 text-left font-semibold uppercase tracking-wide text-mut"
												>
													{{ dayLabel(d.date) }}
												</th>
											</tr>
										</thead>
										<tbody>
											<tr v-for="m in teamRows" :key="m.name">
												<td
													class="whitespace-nowrap pr-2 text-[12.5px]"
													:class="
														m.name === current.employee
															? 'font-bold'
															: ''
													"
												>
													{{ m.employee_name }}
												</td>
												<td v-for="d in ctx.team.days" :key="d.date">
													<span
														class="block h-6 w-10 rounded-md"
														:class="cell(m, d)"
														:title="
															isHoliday(d.date)
																? 'Holiday'
																: d.away.includes(m.name)
																  ? 'Away'
																  : 'In'
														"
													/>
												</td>
											</tr>
										</tbody>
									</table>
								</div>
							</div>
						</div>

						<!-- Expense lines -->
						<div
							v-if="ctx.expenses"
							class="max-w-[720px] overflow-hidden rounded-xl border border-line bg-surf"
						>
							<table class="w-full text-[13.5px]">
								<thead
									class="bg-paper text-[11.5px] uppercase tracking-wide text-mut"
								>
									<tr>
										<th class="px-3.5 py-2 text-left">Date</th>
										<th class="px-3.5 py-2 text-left">Type</th>
										<th class="px-3.5 py-2 text-left">Note</th>
										<th class="px-3.5 py-2 text-right">Amount</th>
									</tr>
								</thead>
								<tbody>
									<tr
										v-for="(e, i) in ctx.expenses"
										:key="i"
										class="border-t border-line-2"
									>
										<td class="px-3.5 py-2 tabular-nums">
											{{ date(e.expense_date) }}
										</td>
										<td class="px-3.5 py-2 font-semibold">
											{{ e.expense_type }}
										</td>
										<td class="px-3.5 py-2 text-ink-2">
											{{ e.description || "—" }}
										</td>
										<td class="px-3.5 py-2 text-right tabular-nums">
											{{ money(e.amount) }}
										</td>
									</tr>
								</tbody>
							</table>
						</div>

						<div v-if="ctx.checks.length">
							<div class="kicker mb-2.5">Checks</div>
							<ul class="flex flex-col gap-2">
								<li
									v-for="c in ctx.checks"
									:key="c.label"
									class="flex items-center gap-2.5 text-[14px]"
								>
									<Icon
										:name="c.ok ? 'check' : 'alert'"
										:size="16"
										:stroke="2.2"
										:class="c.ok ? 'text-pos' : 'text-warn'"
									/>
									{{ c.label }}
								</li>
							</ul>
						</div>

						<label v-if="noteOpen" class="flex max-w-[620px] flex-col gap-1.5">
							<span class="text-[13px] font-semibold">{{
								noteFor === "Reject"
									? "Why are you rejecting it? They'll see this."
									: "Comment"
							}}</span>
							<textarea
								ref="noteBox"
								v-model="note"
								rows="3"
								class="rounded-lg border border-line bg-surf px-3 py-2 text-[14px] focus:border-acc focus:ring-1 focus:ring-acc"
							/>
							<span v-if="noteFor === 'Comment'" class="flex gap-2">
								<button
									type="button"
									class="btn-ghost"
									:disabled="!note.trim() || busy"
									@click="postComment"
								>
									Post comment
								</button>
								<span class="self-center text-[12.5px] text-mut"
									>Or pick Approve / Reject below to send it with your
									decision.</span
								>
							</span>
						</label>
					</div>
				</div>

				<div class="flex items-center gap-2 border-t border-line bg-surf px-11 py-3.5">
					<button
						type="button"
						class="btn border-transparent text-ink hover:bg-side"
						@click="openNote('Comment')"
					>
						<Icon name="file" :size="15" /> Comment
						<kbd class="ml-1 text-[11px] opacity-70">C</kbd>
					</button>
					<a
						:href="classicUrl(current.doctype, current.name)"
						class="btn border-transparent text-ink-2 hover:bg-side"
					>
						<Icon name="ext" :size="15" /> Classic desk
					</a>
					<div class="flex-grow" />
					<template v-if="ctx">
						<button
							v-for="a in secondaryActions"
							:key="a.action"
							type="button"
							class="btn-ghost"
							:class="isReject(a) && 'text-neg'"
							:disabled="busy"
							@click="act(a.action)"
						>
							{{ a.action }}
							<kbd v-if="isReject(a)" class="ml-1 text-[11px] opacity-70">R</kbd>
						</button>
						<button
							v-if="primaryAction"
							type="button"
							class="btn-ink"
							:disabled="busy"
							@click="act(primaryAction.action)"
						>
							{{ primaryAction.action }} &amp; next
							<kbd class="ml-1 text-[11px] opacity-70">A</kbd>
						</button>
						<span v-if="!ctx.actions.length" class="text-[13px] text-mut"
							>You can view this request but not decide it.</span
						>
					</template>
				</div>
			</template>
		</section>

		<!-- Context -->
		<aside
			v-if="current && ctx"
			aria-label="About the requester"
			class="flex w-[290px] shrink-0 flex-col gap-5 overflow-y-auto border-l border-line bg-surf px-5 py-6"
		>
			<div class="flex items-center gap-3">
				<Avatar :label="ctx.employee.employee_name" :size="46" />
				<div class="min-w-0">
					<router-link
						:to="{
							name: 'Form',
							params: { doctype: 'Employee', name: ctx.employee.name },
						}"
						class="block truncate text-[15px] font-bold text-ink hover:text-acc"
					>
						{{ ctx.employee.employee_name }}
					</router-link>
					<div class="truncate text-[12.5px] text-ink-2">
						{{ ctx.employee.designation || "—" }}
					</div>
				</div>
			</div>
			<div class="flex flex-wrap gap-1.5">
				<span v-if="ctx.employee.department" class="chip bg-acc-tint text-acc">{{
					ctx.employee.department
				}}</span>
				<span v-if="ctx.employee.date_of_joining" class="chip bg-line-2 text-ink-2"
					>Joined {{ date(ctx.employee.date_of_joining) }}</span
				>
			</div>
			<div v-if="ctx.holidays?.length">
				<div class="kicker mb-2">Holidays in range</div>
				<ul class="flex flex-col gap-1 text-[13px] text-ink-2">
					<li v-for="h in ctx.holidays" :key="h.holiday_date">
						{{ date(h.holiday_date) }} · {{ strip(h.description) }}
					</li>
				</ul>
			</div>
			<div>
				<div class="kicker mb-2">
					Their recent {{ current.kind.toLowerCase() }} requests
				</div>
				<ul v-if="ctx.history.length" class="flex flex-col gap-1.5 text-[13px] text-ink-2">
					<li v-for="h in ctx.history" :key="h.name" class="flex gap-2">
						<span class="flex-grow truncate">{{
							summary({ ...h, doctype: current.doctype })
						}}</span>
					</li>
				</ul>
				<p v-else class="text-[13px] text-mut">None before this one.</p>
			</div>
		</aside>

		<!-- Bulk confirm -->
		<div
			v-if="confirmBulk"
			class="fixed inset-0 z-40 flex items-center justify-center bg-ink/30"
			@mousedown.self="confirmBulk = false"
		>
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="bulk-title"
				class="w-[460px] rounded-2xl border border-line bg-surf p-6 shadow-2xl"
			>
				<h2 id="bulk-title" class="text-[22px]">Approve what's clear?</h2>
				<p class="mt-2 text-[14px] leading-relaxed text-ink-2">
					Each of the {{ visible.length }}
					{{ kind === "all" ? "" : kind.toLowerCase() }} requests is checked again on the
					server. Only those with no warnings are approved; the rest stay here for you.
				</p>
				<div class="mt-5 flex justify-end gap-2">
					<button type="button" class="btn-ghost" @click="confirmBulk = false">
						Cancel
					</button>
					<button type="button" class="btn-ink" :disabled="busy" @click="bulkApprove">
						Approve the clear ones
					</button>
				</div>
			</div>
		</div>

		<!-- Toast with undo -->
		<div
			v-if="toast"
			role="status"
			class="fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-xl bg-ink px-4 py-3 text-[14px] text-surf shadow-2xl"
		>
			<span>{{ toast.text }}</span>
			<button
				v-if="toast.undo"
				type="button"
				class="font-bold text-lime"
				@click="toast.undo()"
			>
				Undo
			</button>
		</div>
	</div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import dayjs from "dayjs";
import Icon from "@/components/Icon.vue";
import Avatar from "@/components/Avatar.vue";
import { classicUrl } from "@/nav";
import {
	addComment,
	approveClear,
	decide,
	fetchContext,
	fetchInbox,
	inboxCount,
} from "@/composables/inbox";

const UNDO_MS = 5000;

const items = ref([]);
const done = ref([]);
const loading = ref(true);
const tab = ref("decide");
const kind = ref("all");
const current = ref(null);
const ctx = ref(null);
const error = ref("");
const busy = ref(false);
const note = ref("");
const noteOpen = ref(false);
const noteFor = ref("Comment");
const noteBox = ref(null);
const confirmBulk = ref(false);
const toast = ref(null);
const queued = new Map(); // key -> { timer, run } for decisions still inside their undo window

const key = (i) => (i ? `${i.doctype}:${i.name}` : "");
const pending = computed(() => items.value.filter((i) => !queued.has(key(i)) && !i.outcome));
const visible = computed(() =>
	pending.value.filter((i) => kind.value === "all" || i.kind === kind.value),
);
const listed = computed(() => (tab.value === "decide" ? visible.value : done.value));

const tabs = computed(() => [
	{ key: "decide", label: "Decide", count: pending.value.length },
	{ key: "done", label: "Done", count: done.value.length },
]);
const kinds = computed(() => {
	const counts = {};
	for (const i of pending.value) counts[i.kind] = (counts[i.kind] || 0) + 1;
	return [
		{ key: "all", label: "All", count: pending.value.length },
		...Object.entries(counts).map(([k, c]) => ({ key: k, label: k, count: c })),
	];
});

// ---------- wording ----------
const first = (n) => (n || "").split(" ")[0];
const date = (d) => (d ? dayjs(d).format("D MMM") : "");
const dayLabel = (d) => dayjs(d).format("ddd D");
const ago = (d) => {
	const mins = dayjs().diff(dayjs(d), "minute");
	if (mins < 60) return `${Math.max(mins, 1)}m`;
	if (mins < 60 * 24) return `${Math.floor(mins / 60)}h`;
	return `${Math.floor(mins / 1440)}d`;
};
const fmt = (n) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 1 });
const money = (n, currency) => {
	const c = currency || ctx.value?.doc?.currency;
	try {
		return Number(n || 0).toLocaleString(
			undefined,
			c ? { style: "currency", currency: c } : { minimumFractionDigits: 2 },
		);
	} catch {
		return Number(n || 0).toFixed(2);
	}
};
const strip = (html) =>
	new DOMParser().parseFromString(String(html || ""), "text/html").body.textContent;
const range = (a, b) => (a === b || !b ? date(a) : `${date(a)} – ${date(b)}`);
const plural = (n, w) => `${fmt(n)} ${w}${Number(n) === 1 ? "" : "s"}`;

function summary(i) {
	switch (i.doctype) {
		case "Leave Application":
			return `${i.leave_type || "Leave"} · ${range(i.from_date, i.to_date)}${
				i.total_leave_days ? ` · ${plural(i.total_leave_days, "day")}` : ""
			}`;
		case "Expense Claim":
			return money(i.total_claimed_amount, i.currency);
		case "Shift Request":
			return `${i.shift_type} · ${range(i.from_date, i.to_date)}`;
		case "Attendance Request":
			return `${i.reason || "Attendance"} · ${range(i.from_date, i.to_date)}`;
		case "Compensatory Leave Request":
			return `Worked ${range(i.work_from_date, i.work_end_date)}`;
		default:
			return i.name;
	}
}

const headline = computed(() => {
	const i = current.value;
	const n = first(i.employee_name);
	switch (i.doctype) {
		case "Leave Application":
			return `${n} would like ${plural(i.total_leave_days || 1, "day")} off.`;
		case "Expense Claim":
			return `${n} is claiming ${money(i.total_claimed_amount, i.currency)}.`;
		case "Shift Request":
			return `${n} wants to work ${i.shift_type}.`;
		case "Attendance Request":
			return `${n} is asking to correct attendance.`;
		case "Compensatory Leave Request":
			return `${n} worked on a day off and wants time back.`;
		default:
			return i.name;
	}
});

const subline = computed(() => {
	const i = current.value;
	if (i.doctype === "Leave Application") {
		const back = ctx.value ? nextWorkingDay(i.to_date) : null;
		return `${dayjs(i.from_date).format("dddd D MMMM")}${
			i.to_date !== i.from_date ? ` to ${dayjs(i.to_date).format("dddd D MMMM")}` : ""
		}${i.half_day ? " (includes a half day)" : ""}.${
			back ? ` Back ${dayjs(back).format("dddd D MMMM")}.` : ""
		}`;
	}
	if (i.doctype === "Shift Request" || i.doctype === "Attendance Request")
		return `${range(i.from_date, i.to_date)}.`;
	if (i.doctype === "Compensatory Leave Request")
		return `Worked ${range(i.work_from_date, i.work_end_date)}${
			i.leave_type ? `, as ${i.leave_type}` : ""
		}.`;
	return "";
});

const quote = computed(() => {
	const i = current.value;
	return (
		strip(
			i.description ||
				i.remark ||
				i.explanation ||
				(i.doctype === "Compensatory Leave Request" ? i.reason : ""),
		) || ""
	);
});

function nextWorkingDay(d) {
	const holidays = new Set((ctx.value?.holidays || []).map((h) => h.holiday_date));
	let day = dayjs(d).add(1, "day");
	for (let n = 0; n < 14 && holidays.has(day.format("YYYY-MM-DD")); n++) day = day.add(1, "day");
	return day;
}

// ---------- leave visuals ----------
const dots = computed(() => {
	const bal = Math.max(Number(ctx.value?.leave_balance || 0), 0);
	const req = Number(current.value?.total_leave_days || 0);
	const total = Math.min(Math.ceil(Math.max(bal, req)), 30);
	return Array.from({ length: total }, (_, i) => {
		if (i < Math.min(req, bal)) return "bg-acc";
		if (i < req) return "bg-neg";
		return "border-[1.5px] border-ink-2";
	});
});
const teamRows = computed(() => {
	const m = ctx.value?.team?.members || [];
	const me = m.filter((x) => x.name === current.value.employee);
	const away = new Set((ctx.value?.team?.days || []).flatMap((d) => d.away));
	return [
		...me,
		...m.filter((x) => x.name !== current.value.employee && away.has(x.name)),
		...m.filter((x) => x.name !== current.value.employee && !away.has(x.name)),
	].slice(0, 8);
});
const isHoliday = (d) => (ctx.value?.holidays || []).some((h) => h.holiday_date === d);
function cell(m, d) {
	if (isHoliday(d.date))
		return "bg-[repeating-linear-gradient(135deg,theme(colors.line.2)_0_4px,theme(colors.surf)_4px_8px)]";
	if (m.name === current.value.employee) return "bg-acc";
	if (d.away.includes(m.name)) return "bg-ink-2/60";
	return "border border-line-2 bg-surf";
}

// ---------- actions ----------
const isReject = (a) => /^(reject|decline)/i.test(a.action);
const primaryAction = computed(
	() => ctx.value?.actions.find((a) => /^approv/i.test(a.action)) || null,
);
const secondaryActions = computed(() =>
	(ctx.value?.actions || []).filter((a) => a !== primaryAction.value),
);

async function load() {
	loading.value = true;
	try {
		const res = await fetchInbox();
		items.value = res.items;
		if (!current.value && visible.value.length) select(visible.value[0]);
	} catch (e) {
		error.value = e?.messages?.join(" ") || e?.message || "Couldn't load your inbox.";
	} finally {
		loading.value = false;
	}
}

async function select(item) {
	if (!item) {
		current.value = null;
		ctx.value = null;
		return;
	}
	current.value = item;
	ctx.value = null;
	error.value = "";
	note.value = "";
	noteOpen.value = false;
	if (item.outcome) return;
	try {
		const res = await fetchContext(item.doctype, item.name);
		if (current.value === item) ctx.value = res;
	} catch (e) {
		error.value = e?.messages?.join(" ") || e?.message || "Couldn't load this request.";
	}
}

function move(step) {
	const list = listed.value;
	if (!list.length) return;
	const idx = list.findIndex((i) => key(i) === key(current.value));
	select(list[Math.min(Math.max(idx + step, 0), list.length - 1)]);
}

async function openNote(forAction) {
	noteFor.value = forAction;
	noteOpen.value = true;
	await nextTick();
	noteBox.value?.focus();
}

function act(action) {
	if (!current.value || !ctx.value || busy.value) return;
	if (
		isReject({ action }) &&
		!(noteOpen.value && noteFor.value === "Reject" && note.value.trim())
	) {
		// A rejection always carries a reason the employee can read.
		openNote("Reject");
		return;
	}
	const item = current.value;
	const reason = note.value.trim() || null;
	const k = key(item);

	// Optimistic: move on now, send after the undo window.
	const idx = visible.value.findIndex((i) => key(i) === k);
	const run = () => send(item, action, reason);
	const timer = setTimeout(run, UNDO_MS);
	queued.set(k, { timer, run });
	items.value = [...items.value];
	inboxCount.value = pending.value.length;
	const next = visible.value[idx] || visible.value[idx - 1] || null;
	select(next);

	showToast(`${action} · ${item.employee_name}, ${item.kind.toLowerCase()}`, () => {
		clearTimeout(timer);
		queued.delete(k);
		items.value = [...items.value];
		inboxCount.value = pending.value.length;
		toast.value = null;
		select(item);
	});
}

async function send(item, action, reason) {
	try {
		await decide(item.doctype, item.name, action, reason);
		item.outcome = /^(reject|decline)/i.test(action) ? "Rejected" : "Approved";
		done.value = [item, ...done.value];
	} catch (e) {
		showToast(
			`Couldn't ${action.toLowerCase()} ${item.employee_name}'s request: ${
				e?.messages?.join(" ") || e?.message || "unknown error"
			}`,
		);
	} finally {
		queued.delete(key(item));
		items.value = [...items.value];
		inboxCount.value = pending.value.length;
	}
}

async function bulkApprove() {
	busy.value = true;
	try {
		const res = await approveClear(visible.value);
		const ok = new Set(res.approved.map(key));
		for (const i of items.value) if (ok.has(key(i))) i.outcome = "Approved";
		done.value = [...items.value.filter((i) => ok.has(key(i))), ...done.value];
		items.value = [...items.value];
		inboxCount.value = pending.value.length;
		const left = res.skipped.length + res.failed.length;
		showToast(
			`Approved ${res.approved.length}. ${
				left
					? `${left} ${left === 1 ? "needs" : "need"} a closer look.`
					: "Nothing left over."
			}`,
		);
		confirmBulk.value = false;
		if (current.value && ok.has(key(current.value))) select(visible.value[0]);
	} catch (e) {
		showToast(
			e?.messages?.join(" ") || e?.message || "Bulk approve failed; nothing was changed.",
		);
	} finally {
		busy.value = false;
	}
}

async function postComment() {
	busy.value = true;
	try {
		await addComment(current.value.doctype, current.value.name, note.value.trim());
		showToast(`Comment posted on ${current.value.employee_name}'s request`);
		note.value = "";
		noteOpen.value = false;
	} catch (e) {
		showToast(e?.messages?.join(" ") || e?.message || "Couldn't post the comment.");
	} finally {
		busy.value = false;
	}
}

let toastTimer;
function showToast(text, undo = null) {
	clearTimeout(toastTimer);
	toast.value = { text, undo };
	toastTimer = setTimeout(() => (toast.value = null), undo ? UNDO_MS : 6000);
}

// ---------- keyboard ----------
function onKey(e) {
	if (e.metaKey || e.ctrlKey || e.altKey) return;
	if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
	const k = e.key.toLowerCase();
	if (k === "j") move(1);
	else if (k === "k") move(-1);
	else if (k === "a" && primaryAction.value) act(primaryAction.value.action);
	else if (k === "r") {
		const r = secondaryActions.value.find(isReject);
		if (r) act(r.action);
	} else if (k === "c") {
		e.preventDefault();
		openNote("Comment");
	} else return;
	e.preventDefault();
}

watch(kind, () => {
	if (current.value && !visible.value.some((i) => key(i) === key(current.value)))
		select(visible.value[0]);
});

onMounted(() => {
	load();
	window.addEventListener("keydown", onKey);
});
onBeforeUnmount(() => {
	window.removeEventListener("keydown", onKey);
	// Leaving the page doesn't cancel decisions: send anything still inside its undo window.
	for (const { timer, run } of queued.values()) {
		clearTimeout(timer);
		run();
	}
});
</script>
