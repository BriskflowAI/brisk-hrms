<template>
	<div class="flex h-full min-h-0 flex-col">
		<p
			v-if="error"
			role="alert"
			class="m-7 rounded-lg bg-neg-tint px-4 py-3 text-[13.5px] text-neg"
		>
			{{ error }}
		</p>

		<template v-else-if="data">
			<header class="flex flex-col gap-3 border-b border-line px-4 md:px-7 pt-5">
				<div class="flex flex-wrap items-end gap-3">
					<div class="mr-auto">
						<div class="kicker">
							Payroll · {{ data.entry.name }} · {{ data.entry.payroll_frequency }}
						</div>
						<h1 class="mt-1.5 text-[28px] leading-none md:text-[36px]">
							{{ period }} <span class="font-medium text-mut">vs previous</span>
						</h1>
					</div>
					<span class="chip" :class="statusTone">{{ statusLabel }}</span>
					<router-link
						:to="{ name: 'Form', params: { doctype: 'Payroll Entry', name } }"
						class="btn-ink"
						>Open payroll run</router-link
					>
				</div>
				<nav aria-label="Show" class="-mb-px flex gap-6 text-[14px]">
					<button
						v-for="t in tabs"
						:key="t.key"
						type="button"
						class="border-b-2 py-2.5"
						:class="
							tab === t.key
								? 'border-ink font-bold text-ink'
								: 'border-transparent text-ink-2 hover:text-ink'
						"
						@click="tab = t.key"
					>
						{{ t.label }}
						<span class="text-mut" :class="t.alert && 'font-bold text-neg'">{{
							t.count
						}}</span>
					</button>
				</nav>
			</header>

			<div
				class="flex min-h-0 flex-grow flex-col overflow-y-auto md:flex-row md:overflow-visible"
			>
				<!-- people -->
				<aside
					aria-label="Employees"
					class="flex max-h-[40vh] w-full shrink-0 flex-col gap-0.5 overflow-y-auto border-b border-line px-3 py-4 md:max-h-none md:w-[240px] md:border-b-0 md:border-r"
				>
					<div class="px-2 pb-2 text-[12.5px] text-mut">
						{{ changed.length }} changed ·
						{{ data.people.length - changed.length }} same
					</div>
					<button
						v-for="p in listed"
						:key="p.employee"
						type="button"
						class="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left"
						:class="
							focus === p.employee
								? 'bg-surf shadow-[inset_0_0_0_1px] shadow-line'
								: 'hover:bg-surf/70'
						"
						@click="scrollTo(p.employee)"
					>
						<Avatar :label="p.employee_name" :size="24" />
						<span class="min-w-0 flex-grow truncate text-[13px] font-semibold">{{
							p.employee_name
						}}</span>
						<span
							class="whitespace-nowrap text-[12px] font-bold tabular-nums"
							:class="deltaTone(p)"
							>{{ deltaText(p) }}</span
						>
					</button>
				</aside>

				<!-- diffs -->
				<div class="min-w-0 flex-grow shrink-0 md:shrink md:overflow-y-auto px-6 py-5">
					<p
						v-if="!data.totals.slips"
						class="mb-4 rounded-xl bg-acc-tint px-4 py-3 text-[13.5px] text-ink"
					>
						Salary slips for this run haven't been created yet. Create them on the
						payroll run; this page then compares each one with the previous period.
					</p>
					<p
						v-if="!shown.length"
						class="rounded-xl border border-line bg-surf px-6 py-10 text-center text-[14px] text-mut"
					>
						{{
							tab === "changes"
								? "Nothing changed since the previous period."
								: "Nothing here."
						}}
					</p>
					<article
						v-for="p in shown"
						:id="`p-${p.employee}`"
						:key="p.employee"
						class="mb-4 overflow-hidden rounded-xl border bg-surf"
						:class="p.missing_slip ? 'border-neg/60' : 'border-line'"
					>
						<header
							class="flex flex-wrap items-center gap-2.5 border-b border-line-2 bg-paper px-4 py-2.5"
						>
							<Avatar :label="p.employee_name" :size="26" />
							<router-link
								:to="{ name: 'People', query: { peek: p.employee } }"
								class="text-[14px] font-bold hover:text-acc"
								>{{ p.employee_name }}</router-link
							>
							<span v-if="p.department" class="chip bg-acc-tint text-acc">{{
								dept(p.department)
							}}</span>
							<span v-if="p.new" class="chip bg-pos-tint text-pos"
								>First payslip</span
							>
							<span class="ml-auto text-[13px] tabular-nums text-ink-2">
								<template v-if="p.previous_net !== null && p.net !== null">
									Net {{ money(p.previous_net) }} →
									<strong :class="deltaTone(p)">{{ money(p.net) }}</strong>
									<span v-if="p.change_pct !== null">
										· {{ p.change_pct > 0 ? "+" : ""
										}}{{ p.change_pct.toFixed(1) }}%</span
									>
								</template>
								<template v-else-if="p.net !== null"
									>Net {{ money(p.net) }}</template
								>
							</span>
						</header>
						<table v-if="p.lines.length" class="w-full border-collapse text-[13.5px]">
							<thead>
								<tr class="text-[11px] uppercase tracking-wider text-mut">
									<th class="w-9 py-1.5"><span class="sr-only">Change</span></th>
									<th class="py-1.5 text-left font-semibold">Component</th>
									<th class="px-4 py-1.5 text-right font-semibold">Previous</th>
									<th
										class="whitespace-nowrap px-4 py-1.5 text-right font-semibold"
									>
										This run
									</th>
								</tr>
							</thead>
							<tbody>
								<template v-for="(l, i) in visibleLines(p)" :key="i">
									<tr v-if="l.fold">
										<td />
										<td colspan="3" class="py-1.5">
											<button
												type="button"
												class="text-[12.5px] text-mut hover:text-ink"
												@click="expanded[p.employee] = true"
											>
												▸ {{ l.count }} unchanged component{{
													l.count > 1 ? "s" : ""
												}}
											</button>
										</td>
									</tr>
									<tr v-else :class="lineBg(l)">
										<td
											class="text-center font-bold"
											:class="lineSign(l).tone"
										>
											{{ lineSign(l).sign }}
										</td>
										<td
											class="py-1.5 pr-3"
											:class="l.kind === 'same' ? 'text-ink-2' : 'text-ink'"
										>
											{{ l.component }}
											<span class="ml-1 text-[11.5px] text-mut">{{
												l.section === "deductions" ? "deduction" : ""
											}}</span>
										</td>
										<td class="px-4 py-1.5 text-right tabular-nums text-ink-2">
											{{
												l.before === null || l.before === undefined
													? "—"
													: money(l.before)
											}}
										</td>
										<td
											class="px-4 py-1.5 text-right tabular-nums"
											:class="l.kind !== 'same' && 'font-semibold'"
										>
											{{
												l.after === null || l.after === undefined
													? "—"
													: money(l.after)
											}}
										</td>
									</tr>
								</template>
							</tbody>
						</table>
						<div
							v-if="p.leave_without_pay"
							class="flex items-center gap-2 border-t border-line-2 bg-warn-tint px-4 py-2 text-[13px] font-semibold text-warn"
						>
							<Icon name="alert" :size="15" /> {{ p.leave_without_pay }} unpaid day{{
								p.leave_without_pay === 1 ? "" : "s"
							}}
							deducted · paid {{ p.payment_days }} of {{ p.total_working_days }} days
						</div>
						<div
							v-if="p.missing_slip"
							class="flex items-center gap-2 border-t border-line-2 bg-neg-tint px-4 py-2 text-[13px] font-semibold text-neg"
						>
							<Icon name="alert" :size="15" /> In the run but no salary slip was
							made.
						</div>
						<div v-if="p.slip" class="border-t border-line-2 px-4 py-1.5 text-right">
							<router-link
								:to="{
									name: 'Form',
									params: { doctype: 'Salary Slip', name: p.slip },
								}"
								class="text-[12.5px] font-semibold text-acc"
								>Open salary slip →</router-link
							>
						</div>
					</article>
				</div>

				<!-- totals & checks -->
				<aside
					aria-label="Totals and checks"
					class="flex w-full shrink-0 flex-col gap-5 overflow-y-auto border-t border-line bg-surf px-5 py-5 md:w-[290px] md:border-l md:border-t-0"
				>
					<section>
						<div class="kicker mb-2">Totals</div>
						<dl class="flex flex-col gap-1.5 text-[13.5px]">
							<div class="flex">
								<dt class="flex-grow text-ink-2">Gross</dt>
								<dd class="tabular-nums">{{ money(data.totals.gross) }}</dd>
							</div>
							<div class="flex">
								<dt class="flex-grow text-ink-2">Deductions</dt>
								<dd class="tabular-nums">{{ money(data.totals.deductions) }}</dd>
							</div>
							<div class="flex items-baseline border-t border-line pt-2">
								<dt class="flex-grow font-bold">Net</dt>
								<dd class="font-display text-[24px] font-bold tabular-nums">
									{{ money(data.totals.net) }}
								</dd>
							</div>
							<div
								v-if="data.totals.previous_net"
								class="text-right text-[12.5px] text-mut"
							>
								<span
									:class="netDelta >= 0 ? 'text-pos' : 'text-neg'"
									class="font-bold"
									>{{ netDelta >= 0 ? "+" : "" }}{{ money(netDelta) }}</span
								>
								vs previous
							</div>
							<div class="text-right text-[12.5px] text-mut">
								{{ data.totals.submitted }} of {{ data.totals.slips }} slips
								submitted
							</div>
						</dl>
					</section>
					<section>
						<div class="kicker mb-2">Checks</div>
						<ul class="flex flex-col gap-2.5">
							<li v-for="c in data.checks" :key="c.label" class="text-[13px]">
								<div class="flex items-start gap-2">
									<Icon
										:name="c.ok ? 'check' : 'alert'"
										:size="15"
										:stroke="2"
										:class="
											c.ok
												? 'mt-0.5 text-pos'
												: c.warning
													? 'mt-0.5 text-warn'
													: 'mt-0.5 text-neg'
										"
									/>
									<span>{{ c.label }}</span>
								</div>
								<ul
									v-if="c.employees?.length"
									class="ml-6 mt-1 list-disc pl-3 text-[12.5px] text-ink-2"
								>
									<li v-for="e in c.employees.slice(0, 6)" :key="e">{{ e }}</li>
								</ul>
							</li>
							<li v-if="!data.checks.length" class="text-[13px] text-mut">
								Nothing to flag.
							</li>
						</ul>
					</section>
					<section class="mt-auto text-[12.5px] leading-relaxed text-mut">
						Creating, submitting and paying slips happens on the payroll run, with
						Frappe HR's own rules.
					</section>
				</aside>
			</div>
		</template>

		<div v-else class="px-4 md:px-7 py-10 text-[13.5px] text-mut">Loading…</div>
	</div>
</template>

<script setup>
import { dept } from "@/composables/format";
import { computed, onMounted, reactive, ref } from "vue";
import { call } from "frappe-ui";
import dayjs from "dayjs";
import Icon from "@/components/Icon.vue";
import Avatar from "@/components/Avatar.vue";
import { messageOf } from "@/engine/form";

const props = defineProps({ name: { type: String, required: true } });

const data = ref(null);
const error = ref("");
const tab = ref("changes");
const focus = ref(null);
const expanded = reactive({});

const changed = computed(() => (data.value?.people || []).filter((p) => p.changed));
const flagged = computed(() =>
	(data.value?.people || []).filter(
		(p) =>
			p.missing_slip ||
			p.leave_without_pay ||
			(p.change_pct !== null && Math.abs(p.change_pct) >= 20),
	),
);
const tabs = computed(() => [
	{ key: "changes", label: "Changes", count: changed.value.length },
	{
		key: "flagged",
		label: "Needs a look",
		count: flagged.value.length,
		alert: flagged.value.length > 0,
	},
	{ key: "all", label: "All slips", count: data.value?.people.length || 0 },
]);
const shown = computed(() =>
	tab.value === "changes"
		? changed.value
		: tab.value === "flagged"
			? flagged.value
			: data.value?.people || [],
);
const listed = computed(() => (tab.value === "all" ? data.value?.people || [] : shown.value));
const netDelta = computed(() =>
	data.value ? data.value.totals.net - data.value.totals.previous_net : 0,
);

const period = computed(() => {
	const e = data.value.entry;
	const s = dayjs(e.start_date);
	return s.date() === 1 && dayjs(e.end_date).isSame(s.endOf("month"), "day")
		? s.format("MMMM YYYY")
		: `${s.format("D MMM")} – ${dayjs(e.end_date).format("D MMM YYYY")}`;
});
const statusLabel = computed(() => {
	const e = data.value.entry;
	if (e.salary_slips_submitted) return "Slips submitted";
	if (e.salary_slips_created) return "Slips created · in review";
	return e.docstatus ? "Submitted" : "Draft";
});
const statusTone = computed(() =>
	data.value.entry.salary_slips_submitted ? "bg-pos-tint text-pos" : "bg-warn-tint text-warn",
);

const money = (n) => {
	const c = data.value?.entry.currency;
	try {
		return Number(n || 0).toLocaleString(
			undefined,
			c
				? { style: "currency", currency: c, maximumFractionDigits: 2 }
				: { minimumFractionDigits: 2 },
		);
	} catch {
		return Number(n || 0).toFixed(2);
	}
};
function deltaText(p) {
	if (p.missing_slip) return "no slip";
	if (p.new) return "new";
	if (!p.change) return "±0";
	return `${p.change > 0 ? "+" : "−"}${Math.abs(p.change).toLocaleString(undefined, {
		maximumFractionDigits: 0,
	})}`;
}
const deltaTone = (p) =>
	p.missing_slip
		? "text-neg"
		: p.new
			? "text-acc"
			: p.change > 0
				? "text-pos"
				: p.change < 0
					? "text-neg"
					: "text-mut";
function lineSign(l) {
	const deduction = l.section === "deductions";
	if (l.kind === "added") return { sign: "+", tone: deduction ? "text-neg" : "text-pos" };
	if (l.kind === "removed") return { sign: "−", tone: deduction ? "text-pos" : "text-neg" };
	if (l.kind === "changed") {
		const up = (l.after || 0) > (l.before || 0);
		return { sign: up ? "↑" : "↓", tone: up !== deduction ? "text-pos" : "text-neg" };
	}
	return { sign: "", tone: "" };
}
const lineBg = (l) =>
	l.kind === "same"
		? ""
		: l.kind === "removed"
			? "bg-neg-tint/60"
			: l.kind === "added"
				? "bg-pos-tint/60"
				: "bg-acc-tint/50";

// Unchanged components collapse into one row, like a code review.
function visibleLines(p) {
	if (expanded[p.employee]) return p.lines;
	const out = [];
	let fold = 0;
	for (const l of p.lines) {
		if (l.kind === "same") fold++;
		else {
			if (fold) out.push({ fold: true, count: fold });
			fold = 0;
			out.push(l);
		}
	}
	if (fold) out.push({ fold: true, count: fold });
	return out;
}

function scrollTo(employee) {
	focus.value = employee;
	if (!shown.value.some((p) => p.employee === employee)) tab.value = "all";
	setTimeout(
		() =>
			document
				.getElementById(`p-${employee}`)
				?.scrollIntoView({ behavior: "smooth", block: "start" }),
		50,
	);
}

onMounted(async () => {
	try {
		data.value = await call("hrms.briskrew.payroll.get_run_review", {
			payroll_entry: props.name,
		});
		if (!changed.value.length) tab.value = "all";
	} catch (e) {
		error.value = messageOf(e, "Couldn't load this payroll run.");
	}
});
</script>
