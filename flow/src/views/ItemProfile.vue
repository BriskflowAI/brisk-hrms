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
					v-if="item.image"
					:src="item.image"
					alt=""
					class="h-16 w-16 rounded-xl border border-line object-cover"
				/>
				<div
					v-else
					class="flex h-16 w-16 items-center justify-center rounded-xl bg-side text-mut"
					aria-hidden="true"
				>
					<Icon name="box" :size="26" />
				</div>
				<div class="mr-auto min-w-0">
					<div class="kicker">
						{{ __("Item") }} · {{ item.item_group }}
						<template v-if="item.brand"> · {{ item.brand }}</template>
					</div>
					<h1 class="mt-1.5 truncate text-[26px] leading-tight md:text-[32px]">
						{{ item.item_name || item.name }}
					</h1>
					<div
						class="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12.5px] text-ink-2"
					>
						<span class="font-semibold">{{ item.name }}</span>
						<span v-if="item.disabled" class="chip bg-line-2 text-ink-2">{{
							__("Disabled")
						}}</span>
						<span v-if="!item.is_stock_item" class="chip bg-line-2 text-ink-2">{{
							__("Not stocked")
						}}</span>
						<span v-if="item.has_batch_no" class="chip bg-acc-tint text-acc">{{
							__("Batches")
						}}</span>
						<span v-if="item.has_serial_no" class="chip bg-acc-tint text-acc">{{
							__("Serial numbers")
						}}</span>
						<span v-if="item.is_fixed_asset" class="chip bg-acc-tint text-acc">{{
							__("Fixed asset")
						}}</span>
					</div>
				</div>
				<router-link
					:to="{ name: 'Form', params: { doctype: 'Item', name: item.name } }"
					class="btn-ghost"
					>{{ __("Edit item") }}</router-link
				>
				<router-link
					v-if="item.is_stock_item"
					:to="{
						name: 'Form',
						params: { doctype: 'Material Request', name: 'new' },
						query: { material_request_type: 'Purchase' },
					}"
					class="btn-ghost"
					>{{ __("Request") }}</router-link
				>
				<router-link
					v-if="item.is_stock_item"
					:to="{ name: 'Form', params: { doctype: 'Stock Entry', name: 'new' } }"
					class="btn-ink"
				>
					<Icon name="plus" :size="15" /> {{ __("Stock entry") }}
				</router-link>
			</header>

			<div class="grid gap-5 px-4 pb-10 pt-5 md:px-7 xl:grid-cols-[minmax(0,1fr)_320px]">
				<div class="min-w-0 space-y-5">
					<!-- headline numbers -->
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
								class="mt-1 font-display text-[24px] font-bold leading-tight"
								:class="c.tone"
							>
								{{ c.value }}
							</div>
							<div v-if="c.note" class="text-[12px] text-mut">{{ c.note }}</div>
						</div>
					</section>

					<!-- where it is -->
					<section class="rounded-xl border border-line bg-surf">
						<header class="flex items-center border-b border-line-2 px-4 py-2.5">
							<h2 class="mr-auto text-[15px] font-semibold">
								{{ __("Stock by warehouse") }}
							</h2>
							<router-link
								:to="{ name: 'StockLevels', query: { item_code: item.name } }"
								class="text-[12.5px] font-semibold text-acc hover:underline"
								>{{ __("Stock levels") }}</router-link
							>
						</header>
						<p v-if="!data.stock.length" class="px-4 py-6 text-[13.5px] text-mut">
							{{ __("None in any warehouse yet.") }}
						</p>
						<div v-else class="overflow-x-auto">
							<table class="w-full text-[13.5px]">
								<thead>
									<tr>
										<th :class="th">{{ __("Warehouse") }}</th>
										<th :class="[th, 'text-right']">{{ __("In stock") }}</th>
										<th :class="[th, 'text-right']">{{ __("Reserved") }}</th>
										<th :class="[th, 'text-right']">{{ __("On order") }}</th>
										<th :class="[th, 'text-right']">{{ __("Projected") }}</th>
										<th :class="[th, 'text-right']">{{ __("Reorder at") }}</th>
										<th :class="[th, 'text-right']">{{ __("Value") }}</th>
									</tr>
								</thead>
								<tbody>
									<tr
										v-for="r in data.stock"
										:key="r.warehouse"
										class="border-t border-line-2"
									>
										<td :class="td">{{ r.warehouse }}</td>
										<td :class="[td, 'text-right font-semibold tabular-nums']">
											{{ qty(r.actual_qty) }}
										</td>
										<td :class="[td, 'text-right tabular-nums']">
											{{ qty(r.reserved_qty + r.reserved_stock) }}
										</td>
										<td :class="[td, 'text-right tabular-nums']">
											{{
												qty(r.ordered_qty + r.indented_qty + r.planned_qty)
											}}
										</td>
										<td
											:class="[
												td,
												'text-right tabular-nums',
												r.projected_qty < 0 && 'text-neg',
											]"
										>
											{{ qty(r.projected_qty) }}
										</td>
										<td :class="[td, 'text-right']">
											<template v-if="r.reorder_level">
												{{ qty(r.reorder_level) }}
												<span
													v-if="r.below_reorder"
													class="chip ml-1.5 bg-neg-tint text-neg"
													>{{ __("Reorder") }}</span
												>
											</template>
											<span v-else class="text-mut">—</span>
										</td>
										<td :class="[td, 'text-right tabular-nums']">
											{{ money(r.stock_value, data.currency) }}
										</td>
									</tr>
								</tbody>
							</table>
						</div>
					</section>

					<!-- what moved -->
					<section class="rounded-xl border border-line bg-surf">
						<header class="flex items-center border-b border-line-2 px-4 py-2.5">
							<h2 class="mr-auto text-[15px] font-semibold">
								{{ __("Recent movements") }}
							</h2>
							<router-link
								:to="{
									name: 'Report',
									params: { name: 'Stock Ledger' },
									query: { item_code: item.name },
								}"
								class="text-[12.5px] font-semibold text-acc hover:underline"
								>{{ __("Stock ledger") }}</router-link
							>
						</header>
						<p v-if="!data.ledger.length" class="px-4 py-6 text-[13.5px] text-mut">
							{{ __("Nothing has moved yet.") }}
						</p>
						<ol v-else>
							<li
								v-for="(m, i) in data.ledger"
								:key="i"
								class="flex items-center gap-3 border-t border-line-2 px-4 py-2.5 text-[13.5px] first:border-0"
							>
								<span
									class="w-16 shrink-0 text-right font-semibold tabular-nums"
									:class="m.actual_qty < 0 ? 'text-neg' : 'text-pos'"
									>{{ m.actual_qty > 0 ? "+" : "" }}{{ qty(m.actual_qty) }}</span
								>
								<span class="min-w-0 flex-grow">
									<router-link
										:to="{
											name: 'Form',
											params: {
												doctype: m.voucher_type,
												name: m.voucher_no,
											},
										}"
										class="font-semibold hover:text-acc"
										>{{ m.voucher_type }} {{ m.voucher_no }}</router-link
									>
									<span class="block truncate text-[12px] text-mut">
										{{ m.warehouse }} · {{ __("leaves") }}
										{{ qty(m.qty_after_transaction) }}
									</span>
								</span>
								<span class="shrink-0 text-[12.5px] text-ink-2">{{
									day(m.posting_date)
								}}</span>
							</li>
						</ol>
					</section>
				</div>

				<aside class="space-y-5">
					<section class="rounded-xl border border-line bg-surf px-4 py-3.5">
						<h2 class="text-[15px] font-semibold">{{ __("Details") }}</h2>
						<dl class="mt-2 space-y-1.5 text-[13.5px]">
							<div v-for="f in facts" :key="f[0]" class="flex gap-3">
								<dt class="w-32 shrink-0 text-mut">{{ f[0] }}</dt>
								<dd class="min-w-0 break-words">{{ f[1] }}</dd>
							</div>
						</dl>
						<p
							v-if="descriptionText"
							class="mt-3 border-t border-line-2 pt-3 text-[13px] text-ink-2"
						>
							{{ descriptionText }}
						</p>
					</section>

					<section class="rounded-xl border border-line bg-surf">
						<header class="flex items-center border-b border-line-2 px-4 py-2.5">
							<h2 class="mr-auto text-[15px] font-semibold">{{ __("Prices") }}</h2>
							<router-link
								:to="{
									name: 'Form',
									params: { doctype: 'Item Price', name: 'new' },
									query: { item_code: item.name },
								}"
								class="rounded p-0.5 text-mut hover:bg-side hover:text-acc"
								:aria-label="__('New price')"
							>
								<Icon name="plus" :size="14" />
							</router-link>
						</header>
						<p v-if="!data.prices.length" class="px-4 py-4 text-[13px] text-mut">
							{{ __("No prices yet.") }}
						</p>
						<router-link
							v-for="p in data.prices"
							:key="p.name"
							:to="{ name: 'Form', params: { doctype: 'Item Price', name: p.name } }"
							class="flex items-center gap-2 border-t border-line-2 px-4 py-2.5 text-[13.5px] first-of-type:border-0 hover:bg-paper"
						>
							<span class="min-w-0 flex-grow truncate">
								{{ p.price_list }}
								<span class="block text-[12px] text-mut"
									>{{ p.selling ? __("Selling") : __("Buying")
									}}{{ p.uom ? ` · ${p.uom}` : "" }}</span
								>
							</span>
							<span class="font-semibold tabular-nums">{{
								money(p.price_list_rate, p.currency)
							}}</span>
						</router-link>
					</section>

					<section class="rounded-xl border border-line bg-surf px-4 py-3.5">
						<h2 class="text-[15px] font-semibold">{{ __("Related") }}</h2>
						<ul class="mt-2 space-y-1 text-[13.5px]">
							<li v-for="l in related" :key="l.label">
								<router-link
									:to="l.to"
									class="flex items-center gap-2 hover:text-acc"
								>
									<span class="flex-grow">{{ l.label }}</span>
									<span v-if="l.count !== undefined" class="text-mut">{{
										l.count
									}}</span>
									<Icon name="chevr" :size="14" class="text-mut" />
								</router-link>
							</li>
						</ul>
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
import { day, money, plainText, qty } from "@/composables/format";

const props = defineProps({ name: { type: String, required: true } });

const th =
	"px-4 py-2 text-left text-[11.5px] font-semibold uppercase tracking-[0.08em] text-mut whitespace-nowrap";
const td = "px-4 py-2.5 whitespace-nowrap";

const data = ref(null);
const error = ref("");
const item = computed(() => data.value?.item || {});

const cards = computed(() => {
	const t = data.value.totals;
	const uom = item.value.stock_uom || "";
	const safety = Number(item.value.safety_stock) || 0;
	return [
		{
			label: "In stock",
			value: `${qty(t.actual_qty)} ${uom}`,
			note: `${data.value.stock.length} ${
				data.value.stock.length === 1 ? "warehouse" : "warehouses"
			}`,
		},
		{
			label: "Projected",
			value: `${qty(t.projected_qty)} ${uom}`,
			note: safety ? `Safety stock ${qty(safety)}` : "After orders and reservations",
			tone: t.projected_qty < safety ? "text-neg" : "",
		},
		{ label: "Reserved", value: `${qty(t.reserved_qty)} ${uom}` },
		{ label: "Stock value", value: money(t.stock_value, data.value.currency, 0) },
	];
});

const facts = computed(() =>
	[
		["Unit", item.value.stock_uom],
		[
			"Valuation rate",
			item.value.valuation_rate
				? money(item.value.valuation_rate, data.value.currency)
				: null,
		],
		[
			"Standard rate",
			item.value.standard_rate ? money(item.value.standard_rate, data.value.currency) : null,
		],
		["Safety stock", item.value.safety_stock ? qty(item.value.safety_stock) : null],
		["Lead time", item.value.lead_time_days ? `${item.value.lead_time_days} days` : null],
		["Asset category", item.value.asset_category],
	].filter((f) => f[1]),
);
const descriptionText = computed(() => {
	const d = plainText(item.value.description);
	return d && d !== item.value.item_name ? d : "";
});

const related = computed(() => {
	const code = item.value.name;
	const out = [];
	if (data.value.counts.batches !== undefined)
		out.push({
			label: "Batches",
			count: data.value.counts.batches,
			to: { name: "List", params: { doctype: "Batch" }, query: { item: code } },
		});
	if (data.value.counts.serial_nos !== undefined)
		out.push({
			label: "Serial numbers",
			count: data.value.counts.serial_nos,
			to: { name: "List", params: { doctype: "Serial No" }, query: { item_code: code } },
		});
	out.push(
		{
			label: "Open material requests",
			count: data.value.open_requests,
			to: { name: "List", params: { doctype: "Material Request" }, query: { docstatus: 1 } },
		},
		{
			label: "Stock entries",
			to: { name: "List", params: { doctype: "Stock Entry" } },
		},
		{
			label: "Stock balance",
			to: { name: "Report", params: { name: "Stock Balance" }, query: { item_code: code } },
		},
		{
			label: "Stock projected qty",
			to: {
				name: "Report",
				params: { name: "Stock Projected Qty" },
				query: { item_code: code },
			},
		},
	);
	if (item.value.is_fixed_asset)
		out.push({
			label: "Assets",
			to: { name: "AssetRegister", query: { txt: code } },
		});
	return out;
});

async function load() {
	error.value = "";
	try {
		data.value = await call("hrms.briskrew.inventory.item_profile", { item_code: props.name });
		document.title = `${data.value.item.item_name || props.name}`;
	} catch (e) {
		error.value = messageOf(e);
	}
}

watch(() => props.name, load, { immediate: true });
</script>
