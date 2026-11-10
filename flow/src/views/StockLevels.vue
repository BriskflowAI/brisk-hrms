<template>
	<div class="flex h-full min-h-0 flex-col">
		<header class="flex flex-wrap items-end gap-3 border-b border-line px-4 pb-4 pt-5 md:px-7">
			<div class="mr-auto">
				<div class="kicker">{{ __("Stock · Inventory") }}</div>
				<h1 class="mt-1.5 text-[28px] leading-none md:text-[36px]">
					{{ __("Stock levels") }}
				</h1>
			</div>
			<router-link
				:to="{ name: 'List', params: { doctype: 'Material Request' } }"
				class="btn-ghost"
				>{{ __("Material requests") }}</router-link
			>
			<router-link
				:to="{
					name: 'Form',
					params: { doctype: 'Stock Entry', name: 'new' },
					query: newEntryQuery(),
				}"
				class="btn-ink"
			>
				<Icon name="plus" :size="15" /> {{ __("Stock entry") }}
			</router-link>
		</header>

		<div class="min-h-0 flex-grow overflow-y-auto px-4 pb-10 md:px-7">
			<!-- headline numbers -->
			<section
				:aria-label="__('Key numbers')"
				class="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4"
			>
				<div class="rounded-xl border border-line bg-surf px-4 py-3.5">
					<div class="text-[12.5px] font-semibold text-ink-2">
						{{ __("Stock value") }}
					</div>
					<div class="mt-1 font-display text-[26px] font-bold leading-tight">
						{{ summary ? money(summary.stock_value, summary.currency, 0) : "—" }}
					</div>
				</div>
				<div class="rounded-xl border border-line bg-surf px-4 py-3.5">
					<div class="text-[12.5px] font-semibold text-ink-2">
						{{ __("Items in stock") }}
					</div>
					<div class="mt-1 font-display text-[26px] font-bold leading-tight">
						{{ summary ? qty(summary.items) : "—" }}
					</div>
				</div>
				<button
					type="button"
					class="rounded-xl border bg-surf px-4 py-3.5 text-left"
					:class="
						onlyLow
							? 'border-acc shadow-[inset_0_0_0_1px] shadow-acc'
							: 'border-line hover:border-acc'
					"
					:aria-pressed="onlyLow"
					@click="onlyLow = !onlyLow"
				>
					<div class="text-[12.5px] font-semibold text-ink-2">
						{{ __("Below reorder level") }}
					</div>
					<div
						class="mt-1 font-display text-[26px] font-bold leading-tight"
						:class="summary?.below_reorder && 'text-neg'"
					>
						{{ summary ? summary.below_reorder : "—" }}
					</div>
				</button>
				<router-link
					:to="{
						name: 'List',
						params: { doctype: 'Material Request' },
						query: { docstatus: 1 },
					}"
					class="rounded-xl border border-line bg-surf px-4 py-3.5 hover:border-acc"
				>
					<div class="text-[12.5px] font-semibold text-ink-2">
						{{ __("Open material requests") }}
					</div>
					<div class="mt-1 font-display text-[26px] font-bold leading-tight">
						{{ summary?.open_requests ?? "—" }}
					</div>
				</router-link>
			</section>

			<!-- filters -->
			<section
				:aria-label="__('Filters')"
				class="mt-5 flex flex-wrap items-end gap-3 text-[13px]"
			>
				<label class="flex min-w-[180px] flex-col gap-1">
					<span class="font-semibold text-ink-2">{{ __("Warehouse") }}</span>
					<select v-model="warehouse" :class="selectCls">
						<option value="">{{ __("All warehouses") }}</option>
						<option v-for="w in summary?.warehouses || []" :key="w" :value="w">
							{{ w }}
						</option>
					</select>
				</label>
				<label class="flex min-w-[180px] flex-col gap-1">
					<span class="font-semibold text-ink-2">{{ __("Item group") }}</span>
					<select v-model="itemGroup" :class="selectCls">
						<option value="">{{ __("All item groups") }}</option>
						<option v-for="g in summary?.item_groups || []" :key="g" :value="g">
							{{ g }}
						</option>
					</select>
				</label>
				<div class="flex min-w-[220px] flex-col gap-1">
					<label for="stock-item" class="font-semibold text-ink-2">{{
						__("Item")
					}}</label>
					<LinkInput
						v-model="itemCode"
						input-id="stock-item"
						doctype="Item"
						:label="__('Item')"
						:placeholder="__('Any item')"
						:input-class="selectCls"
					/>
				</div>
				<label class="flex min-w-[170px] flex-col gap-1">
					<span class="font-semibold text-ink-2">{{ __("Sort by") }}</span>
					<select v-model="sort" :class="selectCls">
						<option v-for="s in sorts" :key="s.key" :value="s.key">
							{{ s.label }}
						</option>
					</select>
				</label>
				<button
					v-if="warehouse || itemGroup || itemCode || onlyLow"
					type="button"
					class="btn-ghost"
					@click="clear"
				>
					{{ __("Clear") }}
				</button>
			</section>

			<p
				v-if="error"
				role="alert"
				class="mt-5 rounded-lg bg-neg-tint px-4 py-3 text-[13.5px] text-neg"
			>
				{{ error }}
			</p>

			<!-- stock by item and warehouse -->
			<div
				v-else
				class="mt-4 overflow-x-auto rounded-xl border border-line bg-surf"
				:class="loading && 'opacity-60'"
			>
				<table class="w-full text-[13.5px]">
					<thead>
						<tr class="bg-paper">
							<th :class="th">{{ __("Item") }}</th>
							<th :class="th">{{ __("Warehouse") }}</th>
							<th :class="[th, 'w-[220px]']">{{ __("In stock") }}</th>
							<th :class="[th, 'text-right']">{{ __("Reserved") }}</th>
							<th :class="[th, 'text-right']">{{ __("Projected") }}</th>
							<th :class="[th, 'text-right']">{{ __("Reorder at") }}</th>
							<th :class="[th, 'text-right']">{{ __("Value") }}</th>
							<th :class="th">
								<span class="sr-only">{{ __("Actions") }}</span>
							</th>
						</tr>
					</thead>
					<tbody>
						<tr v-if="!loading && !shown.length">
							<td colspan="8" class="px-4 py-10 text-center text-mut">
								{{
									onlyLow
										? __("Nothing below its reorder level here.")
										: __("No stock matches these filters.")
								}}
							</td>
						</tr>
						<tr
							v-for="r in shown"
							:key="r.item_code + '|' + r.warehouse"
							class="border-t border-line-2 hover:bg-paper"
						>
							<td :class="td">
								<router-link
									:to="{ name: 'ItemProfile', params: { name: r.item_code } }"
									class="font-semibold text-ink hover:text-acc"
									>{{ r.item_name || r.item_code }}</router-link
								>
								<div
									v-if="r.item_name && r.item_name !== r.item_code"
									class="text-[12px] text-mut"
								>
									{{ r.item_code }}
								</div>
							</td>
							<td :class="td">{{ r.warehouse }}</td>
							<td :class="td">
								<div class="flex items-center gap-2">
									<span class="w-16 text-right font-semibold tabular-nums">{{
										qty(r.actual_qty)
									}}</span>
									<span class="text-[12px] text-mut">{{ r.stock_uom }}</span>
								</div>
								<div
									class="mt-1 h-1.5 w-full max-w-[160px] overflow-hidden rounded-full bg-line-2"
									aria-hidden="true"
								>
									<div
										class="h-full rounded-full"
										:class="r.below_reorder ? 'bg-neg' : 'bg-acc'"
										:style="{ width: bar(r) + '%' }"
									/>
								</div>
							</td>
							<td :class="[td, 'text-right tabular-nums']">
								{{ qty(r.reserved_qty + r.reserved_stock) }}
							</td>
							<td :class="[td, 'text-right tabular-nums']">
								<span :class="r.projected_qty < 0 && 'text-neg'">{{
									qty(r.projected_qty)
								}}</span>
							</td>
							<td :class="[td, 'text-right']">
								<span v-if="r.reorder_level" class="tabular-nums">{{
									qty(r.reorder_level)
								}}</span>
								<span v-else class="text-mut">—</span>
								<span
									v-if="r.below_reorder"
									class="chip ml-2 bg-neg-tint text-neg"
									>{{ __("Reorder") }}</span
								>
							</td>
							<td :class="[td, 'text-right tabular-nums']">
								{{ money(r.actual_qty * r.valuation_rate, summary?.currency) }}
							</td>
							<td :class="[td, 'text-right']">
								<router-link
									:to="{
										name: 'Form',
										params: { doctype: 'Stock Entry', name: 'new' },
										query: {
											stock_entry_type: 'Material Transfer',
											from_warehouse: r.warehouse,
										},
									}"
									class="rounded-md px-2 py-1 text-[12.5px] font-semibold text-ink-2 hover:bg-side hover:text-acc"
									>{{ __("Move") }}</router-link
								>
								<router-link
									v-if="r.below_reorder"
									:to="{
										name: 'Form',
										params: { doctype: 'Material Request', name: 'new' },
										query: {
											material_request_type: 'Purchase',
											set_warehouse: r.warehouse,
										},
									}"
									class="rounded-md px-2 py-1 text-[12.5px] font-semibold text-ink-2 hover:bg-side hover:text-acc"
									>{{ __("Request") }}</router-link
								>
							</td>
						</tr>
					</tbody>
				</table>
				<div
					v-if="more || loading"
					class="flex justify-center border-t border-line-2 px-4 py-3"
				>
					<button
						type="button"
						class="btn-ghost"
						:disabled="loading"
						@click="load(rows.length)"
					>
						{{ loading ? __("Loading…") : __("Show more") }}
					</button>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { call } from "frappe-ui";
import Icon from "@/components/Icon.vue";
import LinkInput from "@/components/fields/LinkInput.vue";
import { messageOf } from "@/engine/form";
import { money, qty } from "@/composables/format";

const M = "hrms.briskrew.inventory";
const PAGE = 20; // ERPNext sends 21 rows: a 21st means there are more

const route = useRoute();
const router = useRouter();

const sorts = [
	{ key: "actual_qty:desc", label: "Most in stock" },
	{ key: "actual_qty:asc", label: "Least in stock" },
	{ key: "projected_qty:asc", label: "Lowest projected" },
	{ key: "reserved_qty:desc", label: "Most reserved" },
	{ key: "item_code:asc", label: "Item" },
	{ key: "warehouse:asc", label: "Warehouse" },
];
const selectCls =
	"h-9 w-full rounded-lg border border-line bg-surf py-0 pl-3 pr-8 text-[13.5px] text-ink focus:border-acc focus:ring-1 focus:ring-acc";
const th =
	"px-3 py-2.5 text-left text-[11.5px] font-semibold uppercase tracking-[0.08em] text-mut whitespace-nowrap";
const td = "px-3 py-2.5 align-top whitespace-nowrap";

const warehouse = ref(route.query.warehouse || "");
const itemGroup = ref(route.query.item_group || "");
const itemCode = ref(route.query.item_code || "");
const sort = ref(route.query.sort || "actual_qty:desc");
const onlyLow = ref(route.query.low === "1");

const summary = ref(null);
const rows = ref([]);
const more = ref(false);
const loading = ref(false);
const error = ref("");

const shown = computed(() =>
	onlyLow.value ? rows.value.filter((r) => r.below_reorder) : rows.value,
);
const maxQty = computed(() => Math.max(1, ...rows.value.map((r) => Number(r.actual_qty) || 0)));

// How full each bin is: against its reorder level when it has one (twice the level is full),
// otherwise against the biggest bin on screen.
function bar(r) {
	const base = r.reorder_level ? r.reorder_level * 2 : maxQty.value;
	return Math.max(2, Math.min(100, ((Number(r.actual_qty) || 0) / base) * 100));
}

function newEntryQuery() {
	return warehouse.value ? { to_warehouse: warehouse.value } : {};
}

let seq = 0;
async function load(start = 0) {
	const mine = ++seq;
	loading.value = true;
	error.value = "";
	const [sort_by, sort_order] = sort.value.split(":");
	try {
		const page = await call(`${M}.stock_levels`, {
			warehouse: warehouse.value || null,
			item_group: itemGroup.value || null,
			item_code: itemCode.value || null,
			start,
			sort_by,
			sort_order,
		});
		if (mine !== seq) return;
		more.value = (page || []).length > PAGE;
		const got = (page || []).slice(0, PAGE);
		rows.value = start ? [...rows.value, ...got] : got;
		// "Below reorder level" can sit on any page: fetch the rest so the filter is complete.
		if (onlyLow.value && more.value) return load(rows.value.length);
	} catch (e) {
		if (mine === seq) error.value = messageOf(e);
	} finally {
		if (mine === seq) loading.value = false;
	}
}

async function loadSummary() {
	try {
		summary.value = await call(`${M}.stock_summary`, {
			warehouse: warehouse.value || null,
			item_group: itemGroup.value || null,
		});
	} catch (e) {
		error.value = messageOf(e);
	}
}

function clear() {
	warehouse.value = itemGroup.value = itemCode.value = "";
	onlyLow.value = false;
}

watch(
	[warehouse, itemGroup, itemCode, sort, onlyLow],
	([w, g, i, s, low], old) => {
		router.replace({
			query: {
				...(w && { warehouse: w }),
				...(g && { item_group: g }),
				...(i && { item_code: i }),
				...(s !== "actual_qty:desc" && { sort: s }),
				...(low && { low: "1" }),
			},
		});
		if (!old || w !== old[0] || g !== old[1]) loadSummary();
		load(0);
	},
	{ immediate: true },
);
</script>
