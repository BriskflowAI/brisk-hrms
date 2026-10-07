<template>
	<div class="h-full overflow-y-auto">
		<p
			v-if="error"
			role="alert"
			class="m-7 rounded-lg bg-neg-tint px-4 py-3 text-[13.5px] text-neg"
		>
			{{ error }}
		</p>
		<div v-else-if="!data" class="px-4 py-10 text-[13.5px] text-mut md:px-7">
			{{ __("Loading…") }}
		</div>

		<template v-else>
			<header
				class="flex flex-wrap items-end gap-4 border-b border-line px-4 pb-5 pt-5 md:px-7"
			>
				<img
					v-if="asset.image"
					:src="asset.image"
					alt=""
					class="h-16 w-16 rounded-xl border border-line object-cover"
				/>
				<div
					v-else
					class="flex h-16 w-16 items-center justify-center rounded-xl bg-side text-mut"
					aria-hidden="true"
				>
					<Icon name="laptop" :size="26" />
				</div>
				<div class="mr-auto min-w-0">
					<div class="kicker">{{ __("Asset") }} · {{ asset.asset_category }}</div>
					<h1 class="mt-1.5 truncate text-[26px] leading-tight md:text-[32px]">
						{{ asset.asset_name }}
					</h1>
					<div
						class="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12.5px] text-ink-2"
					>
						<span class="font-semibold">{{ asset.name }}</span>
						<span class="chip" :class="assetStatusTone(status)">{{ status }}</span>
						<router-link
							v-if="asset.item_code"
							:to="{ name: 'ItemProfile', params: { name: asset.item_code } }"
							class="hover:text-acc"
							>{{ asset.item_name || asset.item_code }}</router-link
						>
					</div>
				</div>
				<router-link
					:to="{ name: 'Form', params: { doctype: 'Asset', name: asset.name } }"
					class="btn-ghost"
					>{{
						asset.docstatus === 0 ? __("Edit and submit") : __("Open record")
					}}</router-link
				>
				<template v-if="asset.docstatus === 1">
					<router-link
						:to="{
							name: 'Form',
							params: { doctype: 'Asset Repair', name: 'new' },
							query: { asset: asset.name },
						}"
						class="btn-ghost"
						>{{ __("Report a repair") }}</router-link
					>
					<router-link
						:to="{
							name: 'Form',
							params: { doctype: 'Asset Movement', name: 'new' },
							query: { purpose: 'Transfer', company: asset.company },
						}"
						class="btn-ink"
						>{{ __("Move") }}</router-link
					>
				</template>
			</header>

			<div class="grid gap-5 px-4 pb-10 pt-5 md:px-7 xl:grid-cols-[minmax(0,1fr)_320px]">
				<div class="min-w-0 space-y-5">
					<section
						:aria-label="__('Key numbers')"
						class="grid grid-cols-2 gap-3 lg:grid-cols-4"
					>
						<div
							v-for="c in cards"
							:key="c.label"
							class="rounded-xl border border-line bg-surf px-4 py-3.5"
						>
							<div class="text-[12.5px] font-semibold text-ink-2">{{ c.label }}</div>
							<div
								class="mt-1 font-display text-[22px] font-bold leading-tight"
								:class="c.tone"
							>
								{{ c.value }}
							</div>
							<div v-if="c.note" class="text-[12px] text-mut">{{ c.note }}</div>
						</div>
					</section>

					<!-- value over time -->
					<section class="rounded-xl border border-line bg-surf">
						<header class="flex items-center border-b border-line-2 px-4 py-2.5">
							<h2 class="mr-auto text-[15px] font-semibold">
								{{ __("Depreciation schedule") }}
							</h2>
							<router-link
								:to="{
									name: 'Form',
									params: { doctype: 'Asset Value Adjustment', name: 'new' },
									query: { asset: asset.name, company: asset.company },
								}"
								v-if="asset.docstatus === 1"
								class="text-[12.5px] font-semibold text-acc hover:underline"
								>{{ __("Adjust value") }}</router-link
							>
						</header>
						<p v-if="!data.schedule.length" class="px-4 py-6 text-[13.5px] text-mut">
							{{
								asset.calculate_depreciation
									? __("The schedule is made when the asset is submitted.")
									: __("This asset isn't depreciated.")
							}}
						</p>
						<template v-else>
							<div
								class="flex h-28 items-end gap-[3px] px-4 pt-4"
								aria-hidden="true"
							>
								<div
									v-for="(r, i) in data.schedule"
									:key="i"
									class="min-w-[3px] flex-1 rounded-t"
									:class="r.journal_entry ? 'bg-acc' : 'bg-acc-tint'"
									:style="{ height: remainingPct(r) + '%' }"
									:title="`${day(r.schedule_date)}: ${money(
										remaining(r),
										data.currency,
									)}`"
								/>
							</div>
							<p class="px-4 pb-1 pt-2 text-[12px] text-mut">
								{{
									__(
										"Value left after each depreciation. Darker bars are booked.",
									)
								}}
							</p>
							<div class="max-h-[320px] overflow-y-auto">
								<table class="w-full text-[13.5px]">
									<thead class="sticky top-0 bg-surf">
										<tr>
											<th :class="th">{{ __("Date") }}</th>
											<th :class="[th, 'text-right']">
												{{ __("Depreciation") }}
											</th>
											<th :class="[th, 'text-right']">
												{{ __("Accumulated") }}
											</th>
											<th :class="[th, 'text-right']">
												{{ __("Value left") }}
											</th>
											<th :class="th">{{ __("Booked") }}</th>
										</tr>
									</thead>
									<tbody>
										<tr
											v-for="(r, i) in data.schedule"
											:key="i"
											class="border-t border-line-2"
										>
											<td :class="td">{{ day(r.schedule_date) }}</td>
											<td :class="[td, 'text-right tabular-nums']">
												{{ money(r.depreciation_amount, data.currency) }}
											</td>
											<td :class="[td, 'text-right tabular-nums']">
												{{
													money(
														r.accumulated_depreciation_amount,
														data.currency,
													)
												}}
											</td>
											<td :class="[td, 'text-right tabular-nums']">
												{{ money(remaining(r), data.currency) }}
											</td>
											<td :class="td">
												<router-link
													v-if="r.journal_entry"
													:to="{
														name: 'Form',
														params: {
															doctype: 'Journal Entry',
															name: r.journal_entry,
														},
													}"
													class="text-acc hover:underline"
													>{{ r.journal_entry }}</router-link
												>
												<span v-else class="text-mut">{{
													__("Not yet")
												}}</span>
											</td>
										</tr>
									</tbody>
								</table>
							</div>
						</template>
					</section>

					<!-- care -->
					<section class="rounded-xl border border-line bg-surf">
						<header class="flex items-center border-b border-line-2 px-4 py-2.5">
							<h2 class="mr-auto text-[15px] font-semibold">
								{{ __("Maintenance") }}
							</h2>
							<router-link
								v-if="asset.maintenance_required"
								:to="maintenanceLink"
								class="text-[12.5px] font-semibold text-acc hover:underline"
								>{{
									data.maintenance.length
										? __("Open plan")
										: __("Plan maintenance")
								}}</router-link
							>
						</header>
						<p
							v-if="!data.maintenance.length"
							class="px-4 py-6 text-[13.5px] text-mut"
						>
							{{
								asset.maintenance_required
									? __("No maintenance planned yet.")
									: __("This asset doesn't need maintenance.")
							}}
						</p>
						<ul v-else>
							<li
								v-for="(t, i) in data.maintenance"
								:key="i"
								class="flex items-center gap-3 border-t border-line-2 px-4 py-2.5 text-[13.5px] first:border-0"
							>
								<span class="min-w-0 flex-grow">
									<span class="font-semibold">{{ t.maintenance_task }}</span>
									<span class="block text-[12px] text-mut"
										>{{ t.maintenance_type }} · {{ t.periodicity
										}}{{
											t.assign_to_name ? ` · ${t.assign_to_name}` : ""
										}}</span
									>
								</span>
								<span
									class="shrink-0 text-[12.5px]"
									:class="
										isDue(t.next_due_date)
											? 'font-semibold text-warn'
											: 'text-ink-2'
									"
									>{{
										t.next_due_date ? `Due ${day(t.next_due_date)}` : ""
									}}</span
								>
								<span class="chip bg-line-2 text-ink-2">{{
									t.maintenance_status
								}}</span>
							</li>
						</ul>
						<template v-if="data.repairs.length">
							<h3
								class="border-t border-line px-4 pb-1 pt-3 text-[13px] font-semibold text-ink-2"
							>
								{{ __("Repairs") }}
							</h3>
							<router-link
								v-for="r in data.repairs"
								:key="r.name"
								:to="{
									name: 'Form',
									params: { doctype: 'Asset Repair', name: r.name },
								}"
								class="flex items-center gap-3 px-4 py-2 text-[13.5px] hover:bg-paper"
							>
								<span class="min-w-0 flex-grow">
									<span class="font-semibold">{{ r.name }}</span>
									<span class="block truncate text-[12px] text-mut">{{
										plainText(r.description) || day(r.failure_date)
									}}</span>
								</span>
								<span class="shrink-0 tabular-nums text-ink-2">{{
									r.repair_cost ? money(r.repair_cost, data.currency) : ""
								}}</span>
								<span
									class="chip"
									:class="
										r.repair_status === 'Completed'
											? 'bg-pos-tint text-pos'
											: r.repair_status === 'Pending'
											  ? 'bg-warn-tint text-warn'
											  : 'bg-line-2 text-ink-2'
									"
									>{{ r.repair_status }}</span
								>
							</router-link>
						</template>
					</section>
				</div>

				<aside class="space-y-5">
					<section class="rounded-xl border border-line bg-surf px-4 py-3.5">
						<h2 class="text-[15px] font-semibold">{{ __("Details") }}</h2>
						<dl class="mt-2 space-y-1.5 text-[13.5px]">
							<div v-for="f in facts" :key="f[0]" class="flex gap-3">
								<dt class="w-32 shrink-0 text-mut">{{ f[0] }}</dt>
								<dd class="min-w-0 break-words">
									<router-link v-if="f[2]" :to="f[2]" class="hover:text-acc">{{
										f[1]
									}}</router-link>
									<template v-else>{{ f[1] }}</template>
								</dd>
							</div>
						</dl>
					</section>

					<section class="rounded-xl border border-line bg-surf">
						<header class="flex items-center border-b border-line-2 px-4 py-2.5">
							<h2 class="mr-auto text-[15px] font-semibold">
								{{ __("Movements") }}
							</h2>
						</header>
						<p v-if="!data.movements.length" class="px-4 py-4 text-[13px] text-mut">
							{{ __("Not moved yet.") }}
						</p>
						<ol v-else class="px-4 py-2">
							<li
								v-for="(m, i) in data.movements"
								:key="i"
								class="relative border-l border-line py-2 pl-4 text-[13px]"
							>
								<span
									class="absolute -left-[4.5px] top-3.5 h-2 w-2 rounded-full bg-acc"
									aria-hidden="true"
								/>
								<router-link
									:to="{
										name: 'Form',
										params: { doctype: 'Asset Movement', name: m.name },
									}"
									class="font-semibold hover:text-acc"
									>{{ m.purpose }}</router-link
								>
								<span class="text-mut"> · {{ day(m.transaction_date) }}</span>
								<div class="text-[12.5px] text-ink-2">
									{{ moveText(m) }}
								</div>
							</li>
						</ol>
					</section>
				</aside>
			</div>
		</template>
	</div>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { call } from "frappe-ui";
import Icon from "@/components/Icon.vue";
import { messageOf } from "@/engine/form";
import { day, money, plainText } from "@/composables/format";
import { assetStatusTone, isDue } from "@/composables/assets";

const props = defineProps({ name: { type: String, required: true } });

const th =
	"px-4 py-2 text-left text-[11.5px] font-semibold uppercase tracking-[0.08em] text-mut whitespace-nowrap";
const td = "px-4 py-2 whitespace-nowrap";

const data = ref(null);
const error = ref("");
const asset = computed(() => data.value?.asset || {});
const status = computed(() => (asset.value.docstatus === 0 ? "Draft" : asset.value.status));

const purchase = computed(() => Number(asset.value.net_purchase_amount) || 0);
// Accumulated depreciation already includes any opening depreciation.
const remaining = (r) => purchase.value - (Number(r.accumulated_depreciation_amount) || 0);
const remainingPct = (r) =>
	purchase.value ? Math.max(2, Math.min(100, (remaining(r) / purchase.value) * 100)) : 2;

const cards = computed(() => {
	const a = asset.value;
	const c = data.value.currency;
	const left = data.value.schedule.filter((r) => !r.journal_entry).length;
	return [
		{
			label: "Bought for",
			value: money(a.net_purchase_amount, c, 0),
			note: day(a.purchase_date),
		},
		{
			label: "Worth now",
			value: a.docstatus === 1 ? money(a.value_after_depreciation, c, 0) : "—",
			note: purchase.value
				? `${Math.round(
						((a.value_after_depreciation || 0) / purchase.value) * 100,
				  )}% of purchase value`
				: "",
		},
		{
			label: "Next depreciation",
			value: a.next_depreciation_date ? day(a.next_depreciation_date) : "—",
			note: data.value.schedule.length
				? `${left} of ${data.value.schedule.length} still to book`
				: "",
		},
		{
			label: "Open repairs",
			value: data.value.repairs.filter((r) => r.repair_status === "Pending").length,
			tone: data.value.repairs.some((r) => r.repair_status === "Pending") ? "text-warn" : "",
		},
	];
});

const facts = computed(() => {
	const a = asset.value;
	return [
		["Company", a.company],
		["Location", a.location],
		[
			"Custodian",
			a.custodian_name || a.custodian,
			a.custodian
				? { name: "Form", params: { doctype: "Employee", name: a.custodian } }
				: null,
		],
		["Department", a.department],
		["In use since", day(a.available_for_use_date)],
		["Method", a.depreciation_method],
		[
			"Depreciations",
			a.total_number_of_depreciations ? String(a.total_number_of_depreciations) : null,
		],
	].filter((f) => f[1]);
});

const maintenanceLink = computed(() =>
	data.value.maintenance.length
		? { name: "Form", params: { doctype: "Asset Maintenance", name: asset.value.name } }
		: {
				name: "Form",
				params: { doctype: "Asset Maintenance", name: "new" },
				query: { asset_name: asset.value.name },
		  },
);

function moveText(m) {
	const from = m.source_location || m.from_employee;
	const to = m.target_location || m.to_employee;
	if (from && to) return `${from} → ${to}`;
	return to ? `To ${to}` : from ? `From ${from}` : "";
}

async function load() {
	error.value = "";
	try {
		data.value = await call("hrms.briskrew.inventory.asset_profile", { name: props.name });
		document.title = data.value.asset.asset_name || props.name;
	} catch (e) {
		error.value = messageOf(e);
	}
}

watch(() => props.name, load, { immediate: true });
</script>
