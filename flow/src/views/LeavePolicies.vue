<template>
	<div class="flex h-full min-h-0 flex-col">
		<header class="flex flex-wrap items-end gap-3 border-b border-line px-7 pb-4 pt-5">
			<div class="mr-auto">
				<div class="kicker">Time · Leave</div>
				<h1 class="mt-1.5 text-[36px] leading-none">Leave policies</h1>
			</div>
			<router-link
				:to="{ name: 'List', params: { doctype: 'Leave Policy Assignment' } }"
				class="btn-ghost"
				>All assignments</router-link
			>
			<button v-if="data?.can.write_policy" type="button" class="btn-ink" @click="newPolicy">
				<Icon name="plus" :size="15" /> New policy
			</button>
		</header>

		<p
			v-if="error"
			role="alert"
			class="m-7 rounded-lg bg-neg-tint px-4 py-3 text-[13.5px] text-neg"
		>
			{{ error }}
		</p>
		<div v-else-if="!data" class="px-7 py-10 text-[13.5px] text-mut">Loading…</div>

		<div v-else class="flex min-h-0 flex-grow">
			<!-- policies and leave types -->
			<aside
				aria-label="Policies"
				class="flex w-[250px] shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-line px-3 py-4"
			>
				<div class="kicker px-2 pb-1.5">Policies</div>
				<p v-if="!data.policies.length && !draft" class="px-2 text-[13px] text-mut">
					No policies yet.
				</p>
				<button
					v-for="p in sidebarPolicies"
					:key="p.name || 'new'"
					type="button"
					class="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left"
					:class="
						isSelected(p)
							? 'bg-surf shadow-[0_0_0_1px] shadow-line'
							: 'hover:bg-surf/70'
					"
					@click="select(p)"
				>
					<span class="min-w-0 flex-grow">
						<span class="block truncate text-[13.5px] font-semibold">{{
							p.title || "Untitled policy"
						}}</span>
						<span class="block text-[12px] text-mut">
							{{ p.rows.length }} leave type{{ p.rows.length === 1 ? "" : "s" }}
							<template v-if="p.docstatus === 1"> · {{ p.assigned }} on it</template>
						</span>
					</span>
					<span v-if="p.docstatus !== 1" class="chip bg-warn-tint text-warn">Draft</span>
				</button>

				<div class="kicker mt-5 flex items-center px-2 pb-1.5">
					<span class="flex-grow">Leave types</span>
					<button
						v-if="data.can.create_leave_type"
						type="button"
						class="rounded p-0.5 text-mut hover:bg-side hover:text-acc"
						aria-label="New leave type"
						@click="openType(null)"
					>
						<Icon name="plus" :size="14" />
					</button>
				</div>
				<button
					v-for="t in data.leave_types"
					:key="t.name"
					type="button"
					class="rounded-lg px-2.5 py-1.5 text-left text-[13px] hover:bg-surf/70"
					:class="typeEdit?.name === t.name && 'bg-surf shadow-[0_0_0_1px] shadow-line'"
					@click="openType(t)"
				>
					<span class="block truncate font-semibold">{{ t.name }}</span>
					<span class="block truncate text-[12px] text-mut">{{
						rules(t).join(" · ") || "Standard"
					}}</span>
				</button>
			</aside>

			<!-- the selected policy -->
			<main class="min-w-0 flex-grow overflow-y-auto px-7 py-6">
				<div
					v-if="!policy"
					class="rounded-xl border border-line bg-surf px-6 py-12 text-center"
				>
					<p class="text-[15px] font-semibold">Pick a policy, or make a new one.</p>
					<p class="mx-auto mt-1.5 max-w-md text-[13.5px] text-mut">
						A policy says how many days of each leave type people get a year. Assign it
						to people and their leave balances are created for them.
					</p>
				</div>

				<template v-else>
					<section class="max-w-[860px]">
						<div class="flex flex-wrap items-center gap-3">
							<label class="sr-only" for="policy-title">Policy name</label>
							<input
								id="policy-title"
								v-model="policy.title"
								:readonly="locked"
								placeholder="Policy name, e.g. Standard 2026"
								class="min-w-0 flex-grow rounded-lg border border-transparent bg-transparent px-1 py-1 font-display text-[26px] font-bold text-ink hover:border-line focus:border-acc focus:bg-surf"
								:class="locked && 'hover:border-transparent'"
							/>
							<span
								class="chip"
								:class="locked ? 'bg-pos-tint text-pos' : 'bg-warn-tint text-warn'"
							>
								{{ locked ? "In use · locked" : "Draft" }}
							</span>
						</div>
						<p v-if="locked" class="mt-1 px-1 text-[13px] text-mut">
							Policies can't change once they're assignable, so existing balances
							stay correct. Make a copy to change days, then assign the copy.
						</p>

						<table
							class="mt-5 w-full overflow-hidden rounded-xl border border-line bg-surf text-[14px]"
						>
							<thead>
								<tr
									class="border-b border-line bg-paper text-left text-[12px] font-semibold uppercase tracking-wider text-mut"
								>
									<th class="px-4 py-2.5">Leave type</th>
									<th class="w-[130px] px-4 py-2.5 text-right">Days a year</th>
									<th class="px-4 py-2.5">Rules</th>
									<th class="w-[44px]"><span class="sr-only">Remove</span></th>
								</tr>
							</thead>
							<tbody>
								<tr
									v-for="(row, i) in policy.rows"
									:key="i"
									class="border-b border-line-2 last:border-0"
								>
									<td class="px-4 py-2">
										<select
											v-if="!locked"
											v-model="row.leave_type"
											:aria-label="`Leave type, row ${i + 1}`"
											:class="inputCls"
											@change="onTypePicked(row)"
										>
											<option value="">Choose…</option>
											<option
												v-for="t in data.leave_types"
												:key="t.name"
												:value="t.name"
												:disabled="
													t.name !== row.leave_type &&
													usedTypes.has(t.name)
												"
											>
												{{ t.name }}
											</option>
											<option
												v-if="data.can.create_leave_type"
												value="__new"
											>
												+ New leave type…
											</option>
										</select>
										<span v-else class="font-semibold">{{
											row.leave_type
										}}</span>
									</td>
									<td class="px-4 py-2 text-right">
										<template v-if="!locked">
											<input
												v-model.number="row.annual_allocation"
												type="number"
												min="0"
												step="0.5"
												:max="maxDays(row) || undefined"
												:aria-label="`Days a year for ${
													row.leave_type || 'row ' + (i + 1)
												}`"
												:aria-invalid="overMax(row)"
												:class="[
													inputCls,
													'text-right tabular-nums',
													overMax(row) && '!border-neg',
												]"
											/>
											<span
												v-if="maxDays(row)"
												class="mt-0.5 block text-[11.5px]"
												:class="
													overMax(row)
														? 'font-semibold text-neg'
														: 'text-mut'
												"
												>max {{ maxDays(row) }}</span
											>
										</template>
										<span v-else class="tabular-nums">{{
											row.annual_allocation
										}}</span>
									</td>
									<td class="px-4 py-2">
										<div
											v-if="typeOf(row.leave_type)"
											class="flex flex-wrap items-center gap-1.5"
										>
											<span
												v-for="r in rules(typeOf(row.leave_type))"
												:key="r"
												class="chip bg-acc-tint text-acc"
												>{{ r }}</span
											>
											<span
												v-if="!rules(typeOf(row.leave_type)).length"
												class="text-[13px] text-mut"
												>Standard paid leave</span
											>
											<button
												type="button"
												class="text-[13px] font-semibold text-acc hover:underline"
												@click="openType(typeOf(row.leave_type))"
											>
												Edit rules
											</button>
										</div>
									</td>
									<td class="pr-2 text-right">
										<button
											v-if="!locked"
											type="button"
											class="rounded p-1.5 text-mut hover:bg-neg-tint hover:text-neg"
											:aria-label="`Remove ${
												row.leave_type || 'row ' + (i + 1)
											}`"
											@click="policy.rows.splice(i, 1)"
										>
											<Icon name="x" :size="14" />
										</button>
									</td>
								</tr>
								<tr v-if="!policy.rows.length">
									<td
										colspan="4"
										class="px-4 py-6 text-center text-[13.5px] text-mut"
									>
										No leave types in this policy yet.
									</td>
								</tr>
							</tbody>
						</table>

						<div class="mt-4 flex flex-wrap items-center gap-2">
							<button v-if="!locked" type="button" class="btn-ghost" @click="addRow">
								<Icon name="plus" :size="14" /> Add leave type
							</button>
							<span class="mr-auto text-[13px] text-mut"
								>{{ totalDays }} days a year in total</span
							>
							<template v-if="!locked">
								<button
									type="button"
									class="btn-ghost"
									:disabled="busy"
									@click="savePolicy(false)"
								>
									Save draft
								</button>
								<button
									v-if="data.can.submit_policy"
									type="button"
									class="btn-ink"
									:disabled="busy"
									@click="savePolicy(true)"
								>
									Save and make assignable
								</button>
							</template>
							<template v-else>
								<router-link
									:to="{
										name: 'Form',
										params: { doctype: 'Leave Policy', name: policy.name },
									}"
									class="btn-ghost"
									>Open record</router-link
								>
								<button
									v-if="data.can.write_policy"
									type="button"
									class="btn-ghost"
									@click="copyPolicy"
								>
									Make a copy
								</button>
							</template>
						</div>
						<p
							v-if="policyMsg"
							:role="policyMsg.tone.includes('neg') ? 'alert' : 'status'"
							class="mt-3 rounded-lg px-4 py-2.5 text-[13.5px]"
							:class="policyMsg.tone"
						>
							{{ policyMsg.text }}
						</p>
					</section>

					<!-- who gets it -->
					<section
						v-if="locked && data.can.assign"
						class="mt-9 max-w-[860px]"
						aria-labelledby="assign-h"
					>
						<h2 id="assign-h" class="text-[20px] font-bold">Who gets it</h2>
						<p class="mt-0.5 text-[13.5px] text-mut">
							Assigning creates each person's leave balance for the period. People
							who already have a policy for those dates are skipped, with the reason.
						</p>

						<div
							class="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-line bg-surf p-4 md:grid-cols-3"
						>
							<div v-for="f in employeeFilters" :key="f.key">
								<label
									:for="`flt-${f.key}`"
									class="mb-1 block text-[12.5px] font-semibold text-ink-2"
									>{{ f.label }}</label
								>
								<LinkInput
									v-model="filters[f.key]"
									:input-id="`flt-${f.key}`"
									:doctype="f.doctype"
									:label="f.label"
									placeholder="Any"
									:input-class="inputCls"
									@update:model-value="loadCandidates"
								/>
							</div>
						</div>

						<div
							class="mt-3 grid grid-cols-2 gap-3 rounded-xl border border-line bg-surf p-4 md:grid-cols-4"
						>
							<div>
								<label
									for="as-basis"
									class="mb-1 block text-[12.5px] font-semibold text-ink-2"
									>Starts from</label
								>
								<select
									id="as-basis"
									v-model="when.assignment_based_on"
									:class="inputCls"
								>
									<option value="Leave Period">A leave period</option>
									<option value="Joining Date">
										Each person's joining date
									</option>
									<option value="">Dates I choose</option>
								</select>
							</div>
							<div
								v-if="when.assignment_based_on === 'Leave Period'"
								class="md:col-span-2"
							>
								<label
									for="as-period"
									class="mb-1 block text-[12.5px] font-semibold text-ink-2"
									>Leave period</label
								>
								<select
									id="as-period"
									v-model="when.leave_period"
									:class="inputCls"
								>
									<option value="">Choose…</option>
									<option
										v-for="lp in data.leave_periods"
										:key="lp.name"
										:value="lp.name"
									>
										{{ fmt(lp.from_date) }} – {{ fmt(lp.to_date)
										}}{{ lp.company ? ` · ${lp.company}` : ""
										}}{{ lp.is_active ? "" : " (inactive)" }}
									</option>
								</select>
							</div>
							<template v-else>
								<div v-if="when.assignment_based_on !== 'Joining Date'">
									<label
										for="as-from"
										class="mb-1 block text-[12.5px] font-semibold text-ink-2"
										>From</label
									>
									<input
										id="as-from"
										v-model="when.effective_from"
										type="date"
										:class="inputCls"
									/>
								</div>
								<div>
									<label
										for="as-to"
										class="mb-1 block text-[12.5px] font-semibold text-ink-2"
										>Until</label
									>
									<input
										id="as-to"
										v-model="when.effective_to"
										type="date"
										:class="inputCls"
									/>
								</div>
							</template>
							<label class="flex items-center gap-2 self-end pb-2 text-[13.5px]">
								<input
									v-model="when.carry_forward"
									type="checkbox"
									class="h-4 w-4 rounded border-line text-acc"
								/>
								Carry forward unused leave
							</label>
						</div>

						<div class="mt-3 overflow-hidden rounded-xl border border-line bg-surf">
							<div
								class="flex items-center gap-3 border-b border-line bg-paper px-4 py-2.5 text-[13px]"
							>
								<label class="flex items-center gap-2 font-semibold">
									<input
										type="checkbox"
										class="h-4 w-4 rounded border-line text-acc"
										:checked="
											candidates.length > 0 &&
											picked.size === candidates.length
										"
										:indeterminate.prop="
											picked.size > 0 && picked.size < candidates.length
										"
										@change="toggleAll($event.target.checked)"
									/>
									{{ picked.size }} of {{ candidates.length }} people selected
								</label>
								<span v-if="loadingCandidates" class="text-mut">Loading…</span>
							</div>
							<ul class="max-h-[360px] overflow-y-auto">
								<li
									v-for="e in candidates"
									:key="e.name"
									class="flex items-center gap-3 border-b border-line-2 px-4 py-2 last:border-0"
								>
									<input
										:id="`pick-${e.name}`"
										type="checkbox"
										class="h-4 w-4 rounded border-line text-acc"
										:checked="picked.has(e.name)"
										@change="toggle(e.name)"
									/>
									<Avatar :label="e.employee_name" :size="26" />
									<label :for="`pick-${e.name}`" class="min-w-0 flex-grow">
										<span class="block truncate text-[13.5px] font-semibold">{{
											e.employee_name
										}}</span>
										<span class="block truncate text-[12px] text-mut">
											{{
												[e.designation, e.department]
													.filter(Boolean)
													.join(" · ") || e.name
											}}
										</span>
									</label>
									<span
										v-if="e.current"
										class="chip"
										:class="
											e.current.leave_policy === policy.name
												? 'bg-pos-tint text-pos'
												: 'bg-side text-ink-2'
										"
									>
										{{
											e.current.leave_policy === policy.name
												? "On this policy"
												: `On ${policyTitle(e.current.leave_policy)}`
										}}
										until {{ fmt(e.current.effective_to) }}
									</span>
									<span
										v-if="result[e.name]"
										class="chip"
										:class="
											result[e.name].ok
												? 'bg-pos-tint text-pos'
												: 'bg-neg-tint text-neg'
										"
									>
										{{ result[e.name].ok ? "Assigned" : "Not assigned" }}
									</span>
								</li>
								<li
									v-if="!candidates.length && !loadingCandidates"
									class="px-4 py-6 text-center text-[13.5px] text-mut"
								>
									No active employees match.
								</li>
							</ul>
						</div>

						<div class="mt-4 flex items-center gap-3">
							<button
								type="button"
								class="btn-ink"
								:disabled="!picked.size || busy || !whenReady"
								@click="assign"
							>
								Assign to {{ picked.size }}
								{{ picked.size === 1 ? "person" : "people" }}
							</button>
							<span v-if="!whenReady" class="text-[13px] text-mut">{{
								whenHint
							}}</span>
						</div>
						<div
							v-if="failures.length"
							role="alert"
							class="mt-4 rounded-xl border border-neg/40 bg-neg-tint/50 px-4 py-3"
						>
							<p class="text-[13.5px] font-bold text-neg">
								{{ failures.length }} not assigned
							</p>
							<ul class="mt-1.5 space-y-1 text-[13px]">
								<li v-for="f in failures" :key="f.employee">
									<span class="font-semibold">{{
										f.employee_name || f.employee
									}}</span
									>: {{ f.error }}
								</li>
							</ul>
						</div>
						<p
							v-if="assignedCount"
							role="status"
							class="mt-3 text-[13.5px] font-semibold text-pos"
						>
							Assigned to {{ assignedCount }}
							{{ assignedCount === 1 ? "person" : "people" }}. Their leave balances
							are ready.
						</p>
					</section>
				</template>
			</main>

			<!-- leave type rules -->
			<aside
				v-if="typeEdit"
				aria-label="Leave type rules"
				class="flex w-[400px] shrink-0 flex-col border-l border-line bg-surf"
			>
				<header class="flex items-center gap-2 border-b border-line px-5 py-3.5">
					<div class="min-w-0 flex-grow">
						<div class="kicker">Leave type</div>
						<div class="truncate text-[17px] font-bold">
							{{ typeEdit.name || "New leave type" }}
						</div>
					</div>
					<button
						type="button"
						class="rounded p-1.5 text-mut hover:bg-side"
						aria-label="Close"
						@click="typeEdit = null"
					>
						<Icon name="x" :size="16" />
					</button>
				</header>
				<form class="flex-grow overflow-y-auto px-5 py-4" @submit.prevent="saveType">
					<p
						v-if="typeEdit.name && policiesUsing(typeEdit.name) > 1"
						class="mb-3 rounded-lg bg-warn-tint px-3 py-2 text-[12.5px] text-warn"
					>
						These rules apply to this leave type in every policy ({{
							policiesUsing(typeEdit.name)
						}}
						policies use it).
					</p>
					<div v-if="!typeEdit.name" class="mb-4">
						<label
							for="lt-name"
							class="mb-1 block text-[12.5px] font-semibold text-ink-2"
							>Name</label
						>
						<input
							id="lt-name"
							v-model="typeEdit.values.leave_type_name"
							required
							:class="inputCls"
							placeholder="e.g. Annual Leave"
						/>
					</div>
					<fieldset v-for="g in data.groups" :key="g.label" class="mb-5">
						<legend class="kicker mb-2">{{ g.label }}</legend>
						<template v-for="df in g.fields" :key="df.fieldname">
							<div v-if="shows(df)" class="mb-2.5">
								<label
									v-if="df.fieldtype === 'Check'"
									class="flex items-start gap-2 text-[13.5px]"
								>
									<input
										v-model="typeEdit.values[df.fieldname]"
										type="checkbox"
										:true-value="1"
										:false-value="0"
										:disabled="!canEditType"
										class="mt-0.5 h-4 w-4 rounded border-line text-acc"
									/>
									<span>
										<span class="font-semibold">{{ df.label }}</span>
										<span
											v-if="df.description"
											class="block text-[12px] text-mut"
											>{{ df.description }}</span
										>
									</span>
								</label>
								<template v-else>
									<label
										:for="`lt-${df.fieldname}`"
										class="mb-1 block text-[12.5px] font-semibold text-ink-2"
										>{{ df.label }}</label
									>
									<select
										v-if="df.fieldtype === 'Select'"
										:id="`lt-${df.fieldname}`"
										v-model="typeEdit.values[df.fieldname]"
										:disabled="!canEditType"
										:class="inputCls"
									>
										<option
											v-for="o in (df.options || '').split('\n')"
											:key="o"
											:value="o"
										>
											{{ o || "—" }}
										</option>
									</select>
									<LinkInput
										v-else-if="df.fieldtype === 'Link'"
										v-model="typeEdit.values[df.fieldname]"
										:input-id="`lt-${df.fieldname}`"
										:doctype="df.options"
										:label="df.label"
										:input-class="inputCls"
									/>
									<input
										v-else
										:id="`lt-${df.fieldname}`"
										v-model.number="typeEdit.values[df.fieldname]"
										type="number"
										:step="df.fieldtype === 'Int' ? 1 : 0.5"
										min="0"
										:disabled="!canEditType"
										:class="inputCls"
									/>
									<p v-if="df.description" class="mt-1 text-[12px] text-mut">
										{{ df.description }}
									</p>
								</template>
							</div>
						</template>
					</fieldset>
					<p
						v-if="typeMsg"
						role="alert"
						class="mb-3 rounded-lg bg-neg-tint px-3 py-2 text-[13px] text-neg"
					>
						{{ typeMsg }}
					</p>
				</form>
				<footer class="flex items-center gap-2 border-t border-line px-5 py-3">
					<router-link
						v-if="typeEdit.name"
						:to="{
							name: 'Form',
							params: { doctype: 'Leave Type', name: typeEdit.name },
						}"
						class="text-[13px] font-semibold text-acc hover:underline"
						>Open full record</router-link
					>
					<button
						v-if="canEditType"
						type="button"
						class="btn-ink ml-auto"
						:disabled="busy"
						@click="saveType"
					>
						{{ typeEdit.name ? "Save rules" : "Create leave type" }}
					</button>
				</footer>
			</aside>
		</div>
	</div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import { call } from "frappe-ui";
import dayjs from "dayjs";
import Icon from "@/components/Icon.vue";
import Avatar from "@/components/Avatar.vue";
import LinkInput from "@/components/fields/LinkInput.vue";
import { messageOf } from "@/engine/form";

const inputCls =
	"w-full rounded-lg border border-line bg-paper px-2.5 py-1.5 text-[14px] text-ink focus:border-acc focus:ring-1 focus:ring-acc";
const employeeFilters = [
	{ key: "company", label: "Company", doctype: "Company" },
	{ key: "department", label: "Department", doctype: "Department" },
	{ key: "designation", label: "Designation", doctype: "Designation" },
	{ key: "branch", label: "Branch", doctype: "Branch" },
	{ key: "grade", label: "Grade", doctype: "Employee Grade" },
	{ key: "employment_type", label: "Employment type", doctype: "Employment Type" },
];

const data = ref(null);
const error = ref("");
const busy = ref(false);
const policy = ref(null); // the policy being looked at, as an editable copy
const draft = ref(null); // a new, unsaved policy
const policyMsg = ref(null);
const typeEdit = ref(null);
const typeMsg = ref("");
let rowWaitingForType = null;

const filters = reactive({});
const when = reactive({
	assignment_based_on: "Leave Period",
	leave_period: "",
	effective_from: "",
	effective_to: "",
	carry_forward: 0,
});
const candidates = ref([]);
const loadingCandidates = ref(false);
const picked = ref(new Set());
const result = ref({});
const failures = ref([]);
const assignedCount = ref(0);

const locked = computed(() => policy.value?.docstatus === 1);
const sidebarPolicies = computed(() =>
	draft.value ? [draft.value, ...data.value.policies] : data.value.policies,
);
const usedTypes = computed(() => new Set((policy.value?.rows || []).map((r) => r.leave_type)));
const totalDays = computed(() =>
	(policy.value?.rows || []).reduce((sum, r) => sum + (Number(r.annual_allocation) || 0), 0),
);
const canEditType = computed(() =>
	typeEdit.value?.name ? data.value.can.write_leave_type : data.value.can.create_leave_type,
);
const whenReady = computed(() => {
	if (when.assignment_based_on === "Leave Period") return !!when.leave_period;
	if (when.assignment_based_on === "Joining Date") return !!when.effective_to;
	return !!(when.effective_from && when.effective_to);
});
const whenHint = computed(() =>
	when.assignment_based_on === "Leave Period"
		? "Choose a leave period first."
		: "Choose the dates first.",
);

const fmt = (d) => (d ? dayjs(d).format("D MMM YYYY") : "");
const typeOf = (name) => data.value.leave_types.find((t) => t.name === name);
const policyTitle = (name) => data.value.policies.find((p) => p.name === name)?.title || name;
const policiesUsing = (type) =>
	data.value.policies.filter((p) => p.rows.some((r) => r.leave_type === type)).length;
const maxDays = (row) => typeOf(row.leave_type)?.max_leaves_allowed || 0;
const overMax = (row) => !!maxDays(row) && Number(row.annual_allocation) > maxDays(row);
const isSelected = (p) =>
	policy.value && (p.name ? p.name === policy.value.name : !policy.value.name);

// A short, plain-language summary of what makes a leave type special.
function rules(t) {
	const out = [];
	if (t.is_lwp) out.push("Unpaid");
	if (t.is_ppl)
		out.push(
			`Partly paid (${Math.round((t.fraction_of_daily_salary_per_leave || 0) * 100)}%)`,
		);
	if (t.is_earned_leave)
		out.push(`Earned ${(t.earned_leave_frequency || "monthly").toLowerCase()}`);
	if (t.is_carry_forward)
		out.push(
			t.maximum_carry_forwarded_leaves
				? `Carries over up to ${t.maximum_carry_forwarded_leaves}`
				: "Carries over",
		);
	if (t.allow_encashment) out.push("Encashable");
	if (t.max_continuous_days_allowed) out.push(`Max ${t.max_continuous_days_allowed} in a row`);
	if (t.applicable_after) out.push(`After ${t.applicable_after} working days`);
	if (t.is_optional_leave) out.push("Optional holidays");
	if (t.is_compensatory) out.push("Comp-off");
	if (t.allow_negative) out.push("Can go negative");
	return out;
}

function shows(df) {
	const dep = df.depends_on;
	if (!dep) return true;
	const doc = typeEdit.value.values;
	if (dep.startsWith("eval:")) {
		try {
			return !!new Function("doc", `return (${dep.slice(5)})`)(doc);
		} catch {
			return true;
		}
	}
	return !!doc[dep];
}

async function load() {
	try {
		data.value = await call("hrms.briskrew.leave_policies.get_overview");
	} catch (e) {
		error.value = messageOf(e, "Couldn't load leave policies.");
	}
}

function select(p) {
	policyMsg.value = null;
	policy.value = {
		...p,
		rows: p.rows.map((r) => ({
			leave_type: r.leave_type,
			annual_allocation: r.annual_allocation,
		})),
	};
	resetAssign();
	if (p.docstatus === 1 && data.value.can.assign) loadCandidates();
}

function newPolicy() {
	draft.value = { name: null, title: "", docstatus: 0, assigned: 0, rows: [] };
	select(draft.value);
	addRow();
}

function copyPolicy() {
	draft.value = {
		name: null,
		title: `${policy.value.title} (copy)`,
		docstatus: 0,
		assigned: 0,
		rows: policy.value.rows.map((r) => ({ ...r })),
	};
	select(draft.value);
}

function addRow() {
	policy.value.rows.push({ leave_type: "", annual_allocation: 0 });
}

function onTypePicked(row) {
	if (row.leave_type !== "__new") return;
	row.leave_type = "";
	rowWaitingForType = row;
	openType(null);
}

function openType(t) {
	typeMsg.value = "";
	const values = {};
	for (const g of data.value.groups)
		for (const df of g.fields)
			values[df.fieldname] = t
				? t[df.fieldname]
				: df.fieldtype === "Check"
				  ? Number(df.default || 0)
				  : df.default ?? null;
	values.leave_type_name = t?.leave_type_name || "";
	typeEdit.value = { name: t?.name || null, values };
}

async function saveType() {
	if (!typeEdit.value.name && !typeEdit.value.values.leave_type_name) {
		typeMsg.value = "Give the leave type a name.";
		return;
	}
	busy.value = true;
	typeMsg.value = "";
	try {
		const saved = await call("hrms.briskrew.leave_policies.save_leave_type", {
			name: typeEdit.value.name,
			values: typeEdit.value.values,
		});
		const i = data.value.leave_types.findIndex((t) => t.name === saved.name);
		if (i >= 0) data.value.leave_types[i] = saved;
		else
			data.value.leave_types = [...data.value.leave_types, saved].sort((a, b) =>
				a.name.localeCompare(b.name),
			);
		if (rowWaitingForType) {
			rowWaitingForType.leave_type = saved.name;
			rowWaitingForType = null;
		}
		typeEdit.value = null;
	} catch (e) {
		typeMsg.value = messageOf(e, "Couldn't save the leave type.");
	} finally {
		busy.value = false;
	}
}

async function savePolicy(submit) {
	const p = policy.value;
	if (!p.title?.trim()) {
		policyMsg.value = { tone: "bg-neg-tint text-neg", text: "Give the policy a name." };
		return;
	}
	const rows = p.rows.filter((r) => r.leave_type);
	const over = rows.find(overMax);
	if (over) {
		policyMsg.value = {
			tone: "bg-neg-tint text-neg",
			text: `${over.leave_type} allows at most ${maxDays(
				over,
			)} days. Lower the days, or raise the limit in its rules.`,
		};
		return;
	}
	if (submit && !rows.length) {
		policyMsg.value = { tone: "bg-neg-tint text-neg", text: "Add at least one leave type." };
		return;
	}
	busy.value = true;
	policyMsg.value = null;
	try {
		const saved = await call("hrms.briskrew.leave_policies.save_policy", {
			name: p.name,
			title: p.title.trim(),
			rows,
			submit: submit ? 1 : 0,
		});
		draft.value = null;
		await load();
		const fresh = data.value.policies.find((x) => x.name === saved.name);
		if (fresh) select(fresh);
		policyMsg.value = {
			tone: "bg-pos-tint text-pos",
			text: submit ? "Saved. Choose who gets it below." : "Draft saved.",
		};
	} catch (e) {
		policyMsg.value = {
			tone: "bg-neg-tint text-neg",
			text: messageOf(e, "Couldn't save the policy."),
		};
	} finally {
		busy.value = false;
	}
}

function resetAssign() {
	candidates.value = [];
	picked.value = new Set();
	result.value = {};
	failures.value = [];
	assignedCount.value = 0;
}

let candidateSeq = 0;
async function loadCandidates() {
	const mine = ++candidateSeq;
	loadingCandidates.value = true;
	try {
		const rows = await call("hrms.briskrew.leave_policies.get_candidates", {
			filters: { ...filters },
		});
		if (mine !== candidateSeq) return;
		candidates.value = rows;
		// Start with everyone who isn't on a policy yet.
		picked.value = new Set(rows.filter((e) => !e.current).map((e) => e.name));
	} catch (e) {
		policyMsg.value = {
			tone: "bg-neg-tint text-neg",
			text: messageOf(e, "Couldn't load employees."),
		};
	} finally {
		if (mine === candidateSeq) loadingCandidates.value = false;
	}
}

function toggle(name) {
	const s = new Set(picked.value);
	s.has(name) ? s.delete(name) : s.add(name);
	picked.value = s;
}
function toggleAll(on) {
	picked.value = new Set(on ? candidates.value.map((e) => e.name) : []);
}

async function assign() {
	busy.value = true;
	failures.value = [];
	assignedCount.value = 0;
	try {
		const res = await call("hrms.briskrew.leave_policies.assign", {
			policy: policy.value.name,
			employees: [...picked.value],
			data: { ...when, carry_forward: when.carry_forward ? 1 : 0 },
		});
		const map = {};
		for (const c of res.created) map[c.employee] = { ok: true };
		for (const f of res.failed) map[f.employee] = { ok: false };
		result.value = map;
		failures.value = res.failed;
		assignedCount.value = res.created.length;
		const name = policy.value.name;
		await Promise.all([load(), loadCandidates()]);
		policy.value.assigned =
			data.value.policies.find((x) => x.name === name)?.assigned ?? policy.value.assigned;
	} catch (e) {
		failures.value = [
			{
				employee: "",
				employee_name: "All",
				error: messageOf(e, "Couldn't assign the policy."),
			},
		];
	} finally {
		busy.value = false;
	}
}

// Default to the active leave period, when there is one.
watch(data, (d) => {
	if (d && !when.leave_period)
		when.leave_period =
			(d.leave_periods.find((p) => p.is_active) || d.leave_periods[0])?.name || "";
});

onMounted(load);
</script>
