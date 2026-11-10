<template>
	<div class="flex h-full min-h-0 flex-col">
		<header class="flex flex-wrap items-end gap-3 border-b border-line px-4 pb-4 pt-5 md:px-7">
			<div class="mr-auto">
				<div class="kicker">{{ __("Assets · Register") }}</div>
				<h1 class="mt-1.5 text-[28px] leading-none md:text-[36px]">
					{{ __("Asset register") }}
				</h1>
			</div>
			<router-link
				:to="{ name: 'Report', params: { name: 'Fixed Asset Register' } }"
				class="btn-ghost"
				>{{ __("Fixed asset report") }}</router-link
			>
			<router-link
				:to="{ name: 'Form', params: { doctype: 'Asset Movement', name: 'new' } }"
				class="btn-ghost"
				>{{ __("Move assets") }}</router-link
			>
			<router-link
				:to="{ name: 'Form', params: { doctype: 'Asset', name: 'new' } }"
				class="btn-ink"
			>
				<Icon name="plus" :size="15" /> {{ __("New asset") }}
			</router-link>
		</header>

		<div class="min-h-0 flex-grow overflow-y-auto px-4 pb-10 md:px-7">
			<section
				:aria-label="__('Key numbers')"
				class="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4"
			>
				<div
					v-for="c in cards"
					:key="c.label"
					class="rounded-xl border border-line bg-surf px-4 py-3.5"
				>
					<div class="text-[12.5px] font-semibold text-ink-2">{{ c.label }}</div>
					<div
						class="mt-1 font-display text-[26px] font-bold leading-tight"
						:class="c.tone"
					>
						{{ c.value }}
					</div>
					<div v-if="c.note" class="text-[12px] text-mut">{{ c.note }}</div>
				</div>
			</section>

			<section
				:aria-label="__('Filters')"
				class="mt-5 flex flex-wrap items-end gap-3 text-[13px]"
			>
				<label class="flex min-w-[220px] flex-grow flex-col gap-1 md:flex-grow-0">
					<span class="font-semibold text-ink-2">{{ __("Search") }}</span>
					<span class="relative">
						<Icon
							name="search"
							:size="15"
							class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mut"
						/>
						<input
							v-model="txt"
							type="search"
							:placeholder="__('Name, ID or item')"
							:class="[selectCls, 'pl-9']"
						/>
					</span>
				</label>
				<label class="flex min-w-[170px] flex-col gap-1">
					<span class="font-semibold text-ink-2">{{ __("Category") }}</span>
					<select v-model="category" :class="selectCls">
						<option value="">{{ __("All categories") }}</option>
						<option v-for="c in choices.categories || []" :key="c" :value="c">
							{{ c }}
						</option>
					</select>
				</label>
				<label class="flex min-w-[170px] flex-col gap-1">
					<span class="font-semibold text-ink-2">{{ __("Location") }}</span>
					<select v-model="location" :class="selectCls">
						<option value="">{{ __("All locations") }}</option>
						<option v-for="l in choices.locations || []" :key="l" :value="l">
							{{ l }}
						</option>
					</select>
				</label>
				<label class="flex min-w-[170px] flex-col gap-1">
					<span class="font-semibold text-ink-2">{{ __("Status") }}</span>
					<select v-model="status" :class="selectCls">
						<option value="">{{ __("Any status") }}</option>
						<option v-for="s in choices.statuses || []" :key="s" :value="s">
							{{ s }}
						</option>
					</select>
				</label>
				<button
					v-if="txt || category || location || status"
					type="button"
					class="btn-ghost"
					@click="txt = category = location = status = ''"
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

			<div
				v-else
				class="mt-4 overflow-x-auto rounded-xl border border-line bg-surf"
				:class="loading && 'opacity-60'"
			>
				<table class="w-full text-[13.5px]">
					<thead>
						<tr class="bg-paper">
							<th :class="th">{{ __("Asset") }}</th>
							<th :class="th">{{ __("Category") }}</th>
							<th :class="th">{{ __("Where · who") }}</th>
							<th :class="th">{{ __("Status") }}</th>
							<th :class="[th, 'text-right']">{{ __("Bought for") }}</th>
							<th :class="[th, 'w-[200px]']">{{ __("Worth now") }}</th>
							<th :class="th">{{ __("Coming up") }}</th>
						</tr>
					</thead>
					<tbody>
						<tr v-if="data && !data.assets.length">
							<td colspan="7" class="px-4 py-10 text-center text-mut">
								{{
									txt || category || location || status
										? __("No assets match these filters.")
										: __("No assets yet.")
								}}
							</td>
						</tr>
						<tr
							v-for="a in data?.assets || []"
							:key="a.name"
							class="border-t border-line-2 hover:bg-paper"
						>
							<td :class="td">
								<router-link
									:to="{ name: 'AssetProfile', params: { name: a.name } }"
									class="font-semibold text-ink hover:text-acc"
									>{{ a.asset_name }}</router-link
								>
								<div class="text-[12px] text-mut">{{ a.name }}</div>
							</td>
							<td :class="td">{{ a.asset_category }}</td>
							<td :class="td">
								{{ a.location || "—" }}
								<div v-if="a.custodian" class="text-[12px] text-mut">
									{{ custodianName(a) }}
								</div>
							</td>
							<td :class="td">
								<span class="chip" :class="statusTone(a)">{{
									statusLabel(a)
								}}</span>
							</td>
							<td :class="[td, 'text-right tabular-nums']">
								{{ money(a.net_purchase_amount, data.currency) }}
								<div class="text-[12px] text-mut">{{ day(a.purchase_date) }}</div>
							</td>
							<td :class="td">
								<template v-if="a.docstatus === 1">
									<div class="font-semibold tabular-nums">
										{{ money(a.value_after_depreciation, data.currency) }}
									</div>
									<div
										class="mt-1 h-1.5 w-full max-w-[150px] overflow-hidden rounded-full bg-line-2"
										:title="`${Math.round(worth(a))}% of purchase value`"
									>
										<div
											class="h-full rounded-full bg-acc"
											:style="{ width: worth(a) + '%' }"
										/>
									</div>
								</template>
								<span v-else class="text-mut">—</span>
							</td>
							<td :class="[td, 'text-[12.5px]']">
								<div
									v-if="a.maintenance_due"
									:class="isDue(a.maintenance_due) && 'font-semibold text-warn'"
								>
									{{ __("Maintenance") }} {{ day(a.maintenance_due) }}
								</div>
								<div v-if="a.next_depreciation_date" class="text-ink-2">
									{{ __("Depreciation") }} {{ day(a.next_depreciation_date) }}
								</div>
								<span
									v-if="!a.maintenance_due && !a.next_depreciation_date"
									class="text-mut"
									>—</span
								>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	</div>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { call } from "frappe-ui";
import Icon from "@/components/Icon.vue";
import { messageOf } from "@/engine/form";
import { day, money } from "@/composables/format";
import { assetStatusTone, isDue } from "@/composables/assets";

const M = "hrms.briskrew.inventory";
const route = useRoute();
const router = useRouter();

const selectCls =
	"h-9 w-full rounded-lg border border-line bg-surf py-0 pl-3 pr-8 text-[13.5px] text-ink focus:border-acc focus:ring-1 focus:ring-acc";
const th =
	"px-3 py-2.5 text-left text-[11.5px] font-semibold uppercase tracking-[0.08em] text-mut whitespace-nowrap";
const td = "px-3 py-2.5 align-top whitespace-nowrap";

const txt = ref(route.query.txt || "");
const category = ref(route.query.asset_category || "");
const location = ref(route.query.location || "");
const status = ref(route.query.status || "");

const data = ref(null);
const choices = ref({});
const loading = ref(false);
const error = ref("");
const custodians = ref({});

const cards = computed(() => {
	const s = data.value?.summary || {};
	const c = data.value?.currency;
	const dash = (v, f) => (data.value ? f(v) : "—");
	return [
		{
			label: "Assets",
			value: dash(s.count, (v) => v),
			note: s.drafts ? `${s.drafts} not submitted` : "",
		},
		{ label: "Bought for", value: dash(s.purchase_value, (v) => money(v, c, 0)) },
		{
			label: "Worth now",
			value: dash(s.book_value, (v) => money(v, c, 0)),
			note: s.purchase_value
				? `${Math.round((s.book_value / s.purchase_value) * 100)}% of purchase value`
				: "",
		},
		{
			label: "Maintenance due",
			value: dash(s.maintenance_due, (v) => v),
			note: s.in_maintenance ? `${s.in_maintenance} in maintenance now` : "",
			tone: s.maintenance_due ? "text-warn" : "",
		},
	];
});

const worth = (a) =>
	a.net_purchase_amount
		? Math.max(0, Math.min(100, (a.value_after_depreciation / a.net_purchase_amount) * 100))
		: 0;
const statusLabel = (a) => (a.docstatus === 0 ? "Draft" : a.status);
const statusTone = (a) => assetStatusTone(statusLabel(a));
const custodianName = (a) => custodians.value[a.custodian] || a.custodian;

async function loadCustodians(list) {
	const ids = [...new Set(list.map((a) => a.custodian).filter(Boolean))].filter(
		(id) => !(id in custodians.value),
	);
	if (!ids.length) return;
	try {
		const rows = await call("frappe.client.get_list", {
			doctype: "Employee",
			filters: { name: ["in", ids] },
			fields: ["name", "employee_name"],
			limit_page_length: ids.length,
		});
		for (const r of rows || []) custodians.value[r.name] = r.employee_name;
	} catch {
		// Names are a nicety; the IDs still show.
	}
}

let seq = 0;
async function load() {
	const mine = ++seq;
	loading.value = true;
	error.value = "";
	try {
		const res = await call(`${M}.asset_register`, {
			asset_category: category.value || null,
			location: location.value || null,
			status: status.value || null,
			txt: txt.value || null,
		});
		if (mine !== seq) return;
		data.value = res;
		loadCustodians(res.assets);
	} catch (e) {
		if (mine === seq) error.value = messageOf(e);
	} finally {
		if (mine === seq) loading.value = false;
	}
}

call(`${M}.asset_filters`)
	.then((r) => (choices.value = r || {}))
	.catch(() => {});

let timer = null;
watch(
	[txt, category, location, status],
	([t, c, l, s], old) => {
		router.replace({
			query: {
				...(t && { txt: t }),
				...(c && { asset_category: c }),
				...(l && { location: l }),
				...(s && { status: s }),
			},
		});
		clearTimeout(timer);
		// Typing waits a moment; the dropdowns load at once.
		if (old && t !== old[0]) timer = setTimeout(load, 250);
		else load();
	},
	{ immediate: true },
);
</script>
