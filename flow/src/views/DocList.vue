<template>
	<div class="flex flex-col gap-4 px-4 md:px-7 py-6">
		<!-- Header -->
		<header class="flex flex-wrap items-end gap-2">
			<div class="mr-auto">
				<div class="kicker">{{ area?.label || list.meta?.module }}</div>
				<h1 class="mt-1.5 text-[28px] leading-none md:text-[34px]">{{ __(label) }}</h1>
			</div>

			<template v-for="g in buttonGroups" :key="g.group">
				<template v-if="!g.group">
					<button
						v-for="b in g.buttons"
						:key="b.label"
						type="button"
						class="btn-ghost"
						@click="runButton(b)"
					>
						{{ b.label }}
					</button>
				</template>
				<div v-else class="relative">
					<button
						type="button"
						class="btn-ghost"
						:aria-expanded="menu === g.group"
						@click="toggleMenu(g.group)"
					>
						{{ g.group }} <Icon name="chev" :size="14" />
					</button>
					<div v-if="menu === g.group" class="menu right-0">
						<button
							v-for="b in g.buttons"
							:key="b.label"
							type="button"
							class="menu-item"
							@click="runButton(b)"
						>
							{{ b.label }}
						</button>
					</div>
				</div>
			</template>

			<div
				v-if="views.length > 1"
				role="group"
				aria-label="View"
				class="flex h-9 rounded-lg border border-line bg-surf p-0.5"
			>
				<button
					v-for="v in views"
					:key="v.key"
					type="button"
					:aria-pressed="view === v.key"
					class="flex items-center gap-1.5 rounded-md px-2.5 text-[13px] font-semibold"
					:class="view === v.key ? 'bg-ink text-surf' : 'text-ink-2 hover:bg-side'"
					@click="setView(v.key)"
				>
					<Icon :name="v.icon" :size="14" /> {{ __(v.label) }}
				</button>
			</div>

			<div class="relative">
				<button
					type="button"
					class="btn-ghost px-2.5"
					aria-label="More"
					:aria-expanded="menu === 'more'"
					@click="toggleMenu('more')"
				>
					•••
				</button>
				<div v-if="menu === 'more'" class="menu right-0 w-[220px]">
					<template v-if="list.perms.export">
						<button type="button" class="menu-item" @click="exportRows('Excel')">
							Export to Excel
						</button>
						<button type="button" class="menu-item" @click="exportRows('CSV')">
							Export to CSV
						</button>
						<div class="my-1 border-t border-line-2" />
					</template>
					<a
						v-if="list.perms.import"
						:href="`/app/data-import/new?reference_doctype=${encodeURIComponent(
							doctype,
						)}`"
						class="menu-item block"
						>Import</a
					>
					<a :href="classicUrl(doctype) + '/view/report'" class="menu-item block"
						>Report view</a
					>
					<a :href="classicUrl(doctype)" class="menu-item block">Open in classic desk</a>
				</div>
			</div>

			<button
				v-if="list.primaryAction"
				type="button"
				class="btn-ink"
				@click="runButton(list.primaryAction)"
			>
				<Icon name="plus" :size="15" /> {{ list.primaryAction.label }}
			</button>
			<router-link
				v-else-if="canCreate"
				:to="{ name: 'Form', params: { doctype, name: 'new' }, query: prefill }"
				class="btn-ink"
			>
				<Icon name="plus" :size="15" /> {{ __("New {0}", [__(doctype)]) }}
			</router-link>
		</header>

		<p
			v-if="list.unsupported.length"
			class="rounded-lg bg-line-2 px-4 py-2 text-[12.5px] text-ink-2"
		>
			Some of this list's extras ({{ list.unsupported.slice(0, 2).join(", ") }}) run only in
			the <a :href="classicUrl(doctype)" class="font-semibold text-acc">classic desk</a>.
		</p>

		<!-- Filters -->
		<div class="flex flex-wrap items-center gap-2">
			<label
				class="flex h-9 w-[260px] items-center gap-2 rounded-lg border border-line bg-surf px-2.5"
			>
				<Icon name="search" :size="15" class="text-mut" />
				<input
					v-model="list.search"
					type="text"
					:aria-label="`Search ${label}`"
					:placeholder="`Search ${label.toLowerCase()}…`"
					class="h-full flex-grow border-0 bg-transparent p-0 text-[13.5px] focus:ring-0"
				/>
			</label>

			<template v-for="df in quickFilters" :key="df.fieldname">
				<select
					v-if="df.fieldtype === 'Select' || df.fieldtype === 'Check'"
					:aria-label="df.label"
					:value="quickValue(df)"
					class="h-9 rounded-lg border border-line bg-surf py-0 pl-2.5 pr-8 text-[13px]"
					@change="setQuick(df, $event.target.value)"
				>
					<option value="">{{ __(df.label) }}: {{ __("any") }}</option>
					<option v-for="o in quickOptions(df)" :key="o.value" :value="o.value">
						{{ __(df.label) }}: {{ __(o.label) }}
					</option>
				</select>
				<LinkInput
					v-else-if="df.fieldtype === 'Link'"
					class="w-[190px]"
					:model-value="quickValue(df) || null"
					:doctype="df.options"
					:label="df.label"
					:placeholder="df.label"
					input-class="h-9 w-full rounded-lg border border-line bg-surf px-2.5 text-[13px] focus:border-acc focus:ring-1 focus:ring-acc"
					@update:model-value="(v) => setQuick(df, v || '')"
				/>
				<input
					v-else-if="df.fieldtype === 'Date'"
					type="date"
					:aria-label="df.label"
					:value="quickValue(df)"
					class="h-9 rounded-lg border border-line bg-surf px-2.5 text-[13px]"
					@change="setQuick(df, $event.target.value)"
				/>
			</template>

			<div class="relative">
				<button
					type="button"
					class="btn-ghost h-9"
					:aria-expanded="menu === 'filter'"
					@click="toggleMenu('filter')"
				>
					<Icon name="filter" :size="14" /> Filter
				</button>
				<div v-if="menu === 'filter'" class="menu left-0 w-[360px] p-3">
					<div class="flex flex-col gap-2">
						<select
							v-model="draft.field"
							aria-label="Field"
							class="h-9 rounded-lg border border-line bg-paper px-2.5 text-[13px]"
						>
							<option value="">Choose a field</option>
							<option
								v-for="df in filterableFields"
								:key="df.fieldname"
								:value="df.fieldname"
							>
								{{ __(df.label) }}
							</option>
						</select>
						<div class="flex gap-2">
							<select
								v-model="draft.op"
								aria-label="Condition"
								class="h-9 w-[130px] rounded-lg border border-line bg-paper px-2 text-[13px]"
							>
								<option v-for="o in OPERATORS" :key="o.value" :value="o.value">
									{{ o.label }}
								</option>
							</select>
							<input
								v-if="!['is set', 'is not set'].includes(draft.op)"
								v-model="draft.value"
								type="text"
								aria-label="Value"
								placeholder="Value"
								class="h-9 min-w-0 flex-grow rounded-lg border border-line bg-paper px-2.5 text-[13px]"
								@keydown.enter="applyDraft"
							/>
						</div>
						<button
							type="button"
							class="btn-ink h-8 self-end"
							:disabled="!draft.field"
							@click="applyDraft"
						>
							Add filter
						</button>
					</div>
				</div>
			</div>

			<div class="relative">
				<button
					type="button"
					class="btn-ghost h-9"
					:aria-expanded="menu === 'sort'"
					@click="toggleMenu('sort')"
				>
					<Icon name="sort" :size="14" /> {{ sortLabel }}
				</button>
				<div
					v-if="menu === 'sort'"
					class="menu left-0 max-h-[320px] w-[240px] overflow-y-auto"
				>
					<button
						v-for="o in sortOptions"
						:key="o.value"
						type="button"
						class="menu-item"
						:class="list.sort === o.value && 'font-bold text-acc'"
						@click="setSort(o.value)"
					>
						{{ o.label }}
					</button>
				</div>
			</div>

			<GroupBy
				v-if="list.meta"
				:doctype="doctype"
				:options="groupByOptions"
				:filters="serverFilters"
				@filter="addFilter"
			/>
			<SavedFilters
				v-if="list.meta"
				:doctype="doctype"
				:filters="list.filters"
				@apply="applySaved"
			/>

			<span class="ml-auto text-[13px] tabular-nums text-mut">{{
				list.total === null ? "" : `${list.rows.length} of ${list.total}`
			}}</span>
			<ColumnPicker
				v-if="list.meta"
				v-model="customColumns"
				:fields="columnChoices"
				:defaults="defaultColumns.map((f) => f.fieldname)"
			/>
		</div>

		<div v-if="list.filters.length" class="flex flex-wrap gap-1.5">
			<span
				v-for="(f, i) in list.filters"
				:key="i"
				class="chip gap-1.5 bg-acc-tint text-acc"
			>
				{{ fieldLabel(f.field) }} {{ opLabel(f.op) }}
				{{ Array.isArray(f.value) ? f.value.join(" – ") : f.value }}
				<button
					type="button"
					:aria-label="`Remove filter ${fieldLabel(f.field)}`"
					class="hover:text-neg"
					@click="removeFilter(i)"
				>
					✕
				</button>
			</span>
			<button
				type="button"
				class="text-[12.5px] text-mut hover:text-ink"
				@click="list.clearFilters()"
			>
				Clear all
			</button>
		</div>

		<TreeView
			v-if="view === 'tree' && tree"
			:doctype="doctype"
			:meta="list.meta"
			:settings="tree"
			:can-create="!!canCreate"
		/>
		<BoardView
			v-if="view === 'board'"
			:doctype="doctype"
			:meta="list.meta"
			:filters="serverFilters()"
			:can-write="!!list.perms.write"
		/>
		<CalendarView
			v-if="view === 'calendar' && calendar"
			:doctype="doctype"
			:settings="calendar"
			:filters="serverFilters()"
			:can-create="!!canCreate"
		/>

		<!-- Bulk bar -->
		<div
			v-if="list.selected.length && view === 'list'"
			class="flex flex-wrap items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-surf"
		>
			<span class="mr-2 text-[13.5px] font-semibold"
				>{{ list.selected.length }} selected</span
			>
			<button
				v-if="list.perms.write && list.perms.bulk_actions"
				type="button"
				class="bulk-btn"
				@click="bulkEditOpen = true"
			>
				Edit
			</button>
			<button
				v-if="list.meta?.is_submittable && list.perms.submit && list.perms.bulk_actions"
				type="button"
				class="bulk-btn"
				@click="confirmBulk('submit')"
			>
				Submit
			</button>
			<button
				v-if="list.meta?.is_submittable && list.perms.cancel && list.perms.bulk_actions"
				type="button"
				class="bulk-btn"
				@click="confirmBulk('cancel')"
			>
				Cancel
			</button>
			<button
				v-if="list.perms.delete && list.perms.bulk_actions"
				type="button"
				class="bulk-btn text-[#FFB4B4]"
				@click="confirmBulk('delete')"
			>
				Delete
			</button>
			<template v-if="list.perms.bulk_actions">
				<button type="button" class="bulk-btn" @click="bulkMode = 'assign'">
					Assign to
				</button>
				<button type="button" class="bulk-btn" @click="bulkMode = 'tags'">Add tags</button>
				<button
					v-if="list.perms.print"
					type="button"
					class="bulk-btn"
					@click="bulkMode = 'print'"
				>
					Print
				</button>
			</template>
			<button
				v-if="list.perms.export"
				type="button"
				class="bulk-btn"
				@click="exportRows('Excel', true)"
			>
				Export
			</button>
			<button
				v-for="b in actionItems"
				:key="b.label"
				type="button"
				class="bulk-btn"
				@click="runButton(b)"
			>
				{{ b.label }}
			</button>
			<button
				type="button"
				class="ml-auto text-[13px] text-lime"
				@click="list.selected = []"
			>
				Clear
			</button>
		</div>

		<p
			v-if="list.error"
			role="alert"
			class="rounded-lg bg-neg-tint px-4 py-3 text-[13.5px] text-neg"
		>
			{{ list.error }}
		</p>
		<p
			v-if="list.notice"
			role="status"
			class="rounded-lg bg-acc-tint px-4 py-2.5 text-[13.5px] text-ink"
		>
			{{ list.notice }}
		</p>

		<!-- Table -->
		<div v-if="view === 'list'" class="overflow-x-auto rounded-xl border border-line bg-surf">
			<table class="w-full border-collapse">
				<thead>
					<tr>
						<th class="w-10 px-3.5 py-2.5">
							<input
								type="checkbox"
								aria-label="Select all"
								:checked="allSelected"
								:indeterminate.prop="list.selected.length && !allSelected"
								class="h-4 w-4 rounded border-line text-acc focus:ring-acc"
								@change="toggleAll"
							/>
						</th>
						<th :class="th">{{ __(titleLabel) }}</th>
						<th
							v-for="f in columns"
							:key="f.fieldname"
							:class="[th, isNum(f) && 'text-right']"
						>
							{{ __(f.label) }}
						</th>
						<th :class="th">Status</th>
						<th v-if="list.settings?.button" :class="th" />
					</tr>
				</thead>
				<tbody>
					<tr
						v-for="row in list.rows"
						:key="row.name"
						tabindex="0"
						class="cursor-pointer border-t border-line-2 hover:bg-paper focus:bg-acc-tint focus:outline-none"
						:class="list.selected.includes(row.name) && 'bg-acc-tint/50'"
						@click="open(row)"
						@keydown.enter="open(row)"
					>
						<td class="px-3.5 py-2.5" @click.stop>
							<input
								v-model="list.selected"
								type="checkbox"
								:value="row.name"
								:aria-label="`Select ${row[titleKey] || row.name}`"
								class="h-4 w-4 rounded border-line text-acc focus:ring-acc"
							/>
						</td>
						<td class="px-3.5 py-2.5 text-[13.5px]">
							<span class="flex items-center gap-2.5">
								<Avatar
									v-if="doctype === 'Employee' || row.employee_name"
									:label="row[titleKey] || row.employee_name || row.name"
									:size="26"
								/>
								<span class="font-semibold">{{ row[titleKey] || row.name }}</span>
								<span
									v-if="titleKey && row[titleKey] && row[titleKey] !== row.name"
									class="hidden whitespace-nowrap text-[12px] text-mut md:inline"
									>{{ row.name }}</span
								>
							</span>
						</td>
						<td
							v-for="f in columns"
							:key="f.fieldname"
							class="px-3.5 py-2.5 text-[13.5px] text-ink-2"
							:class="isNum(f) && 'text-right'"
						>
							<FieldValue :field="f" :value="row[f.fieldname]" />
						</td>
						<td class="px-3.5 py-2.5">
							<span
								v-if="indicator(row)"
								class="chip"
								:class="tone(indicator(row).color)"
								>{{ indicator(row).label }}</span
							>
							<StatusChip
								v-else
								:doc="row"
								:submittable="!!list.meta?.is_submittable"
							/>
						</td>
						<td
							v-if="list.settings?.button"
							class="px-3.5 py-1.5 text-right"
							@click.stop
						>
							<button
								v-if="rowButtonShown(row)"
								type="button"
								class="btn-ghost h-8 px-2.5 text-[12.5px]"
								:title="rowButtonDescription(row)"
								@click="list.settings.button.action(row)"
							>
								{{ rowButtonLabel(row) }}
							</button>
						</td>
					</tr>
				</tbody>
			</table>

			<div v-if="!list.loading && !list.rows.length" class="px-6 py-14 text-center">
				<p class="font-display text-[20px] font-bold">
					{{
						list.search || list.filters.length
							? `No ${label.toLowerCase()} match`
							: `No ${label.toLowerCase()} yet`
					}}
				</p>
				<p class="mt-2 text-[13.5px] text-mut">
					{{
						list.search || list.filters.length
							? "Try removing a filter or searching by ID."
							: "Records you create here or in the classic desk show up in this list."
					}}
				</p>
			</div>
			<div v-if="list.loading" class="px-6 py-6 text-center text-[13px] text-mut">
				Loading…
			</div>
		</div>

		<div
			v-if="
				view === 'list' &&
				!list.loading &&
				list.total !== null &&
				list.rows.length < list.total
			"
			class="flex items-center justify-center gap-2"
		>
			<button type="button" class="btn-ghost" @click="list.reload(true)">
				Load {{ list.pageLength }} more
			</button>
			<select
				v-model.number="list.pageLength"
				aria-label="Page size"
				class="h-9 rounded-lg border border-line bg-surf px-2 text-[13px]"
			>
				<option :value="20">20 at a time</option>
				<option :value="100">100 at a time</option>
				<option :value="500">500 at a time</option>
			</select>
		</div>

		<!-- Bulk edit -->
		<div
			v-if="bulkEditOpen"
			class="fixed inset-0 z-50 flex items-center justify-center bg-ink/30"
			@mousedown.self="bulkEditOpen = false"
		>
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="bulk-edit-title"
				class="w-[440px] rounded-2xl border border-line bg-surf p-6 shadow-2xl"
			>
				<h2 id="bulk-edit-title" class="text-[21px]">
					Edit {{ list.selected.length }} {{ label.toLowerCase() }}
				</h2>
				<div class="mt-4 flex flex-col gap-3">
					<select
						v-model="bulk.field"
						aria-label="Field"
						class="h-9 rounded-lg border border-line bg-paper px-2.5 text-[13.5px]"
					>
						<option value="">Choose a field</option>
						<option
							v-for="df in editableFields"
							:key="df.fieldname"
							:value="df.fieldname"
						>
							{{ df.label }}
						</option>
					</select>
					<input
						v-model="bulk.value"
						type="text"
						aria-label="New value"
						placeholder="New value"
						class="h-9 rounded-lg border border-line bg-paper px-2.5 text-[13.5px]"
					/>
				</div>
				<div class="mt-5 flex justify-end gap-2">
					<button type="button" class="btn-ghost" @click="bulkEditOpen = false">
						Back
					</button>
					<button
						type="button"
						class="btn-ink"
						:disabled="!bulk.field"
						@click="bulkAction('update')"
					>
						Update
					</button>
				</div>
			</div>
		</div>

		<!-- Confirm -->
		<div
			v-if="confirming"
			class="fixed inset-0 z-50 flex items-center justify-center bg-ink/30"
			@mousedown.self="confirming = null"
		>
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="bulk-confirm-title"
				class="w-[420px] rounded-2xl border border-line bg-surf p-6 shadow-2xl"
			>
				<h2 id="bulk-confirm-title" class="text-[21px]">{{ confirming.title }}</h2>
				<p class="mt-2 text-[14px] text-ink-2">{{ confirming.body }}</p>
				<div class="mt-5 flex justify-end gap-2">
					<button type="button" class="btn-ghost" @click="confirming = null">
						Back
					</button>
					<button
						type="button"
						:class="confirming.danger ? 'btn border-neg bg-neg text-surf' : 'btn-ink'"
						@click="confirming.run()"
					>
						{{ confirming.cta }}
					</button>
				</div>
			</div>
		</div>

		<BulkTools
			v-model="bulkMode"
			:doctype="doctype"
			:names="list.selected"
			@done="onBulkDone"
		/>
		<CompatDialogs />
	</div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { call } from "frappe-ui";
import Icon from "@/components/Icon.vue";
import Avatar from "@/components/Avatar.vue";
import FieldValue from "@/components/FieldValue.vue";
import StatusChip from "@/components/StatusChip.vue";
import LinkInput from "@/components/fields/LinkInput.vue";
import CompatDialogs from "@/components/CompatDialogs.vue";
import BulkTools from "@/components/list/BulkTools.vue";
import ColumnPicker from "@/components/list/ColumnPicker.vue";
import GroupBy from "@/components/list/GroupBy.vue";
import SavedFilters from "@/components/list/SavedFilters.vue";
import CalendarView from "@/components/list/CalendarView.vue";
import TreeView from "@/components/list/TreeView.vue";
import BoardView from "@/components/list/BoardView.vue";
import { useLiveCheck } from "@/composables/live";
import { onListUpdate } from "@/composables/realtime";
import { getMeta, isLayout, isTable, listFields, titleField } from "@/composables/api";
import {
	attachListScript,
	calendarSettings,
	treeSettings,
	detachListScript,
	listIndicator,
	loadPerms,
} from "@/engine/compat";
import { messageOf } from "@/engine/form";
import { allNavItems, areaForDoctype, classicUrl } from "@/nav";

const props = defineProps({ doctype: { type: String, required: true } });
const route = useRoute();
const router = useRouter();

const th =
	"px-3.5 py-2.5 text-left text-[11.5px] font-semibold uppercase tracking-[0.08em] text-mut whitespace-nowrap";
const OPERATORS = [
	{ value: "=", label: "is" },
	{ value: "!=", label: "is not" },
	{ value: "like", label: "contains" },
	{ value: ">", label: "after / more than" },
	{ value: "<", label: "before / less than" },
	{ value: ">=", label: "on or after" },
	{ value: "<=", label: "on or before" },
	{ value: "is set", label: "is set" },
	{ value: "is not set", label: "is not set" },
];

const menu = ref(null);
const draft = reactive({ field: "", op: "=", value: "" });
const bulkEditOpen = ref(false);
const bulkMode = ref(null);
const calendar = ref(null); // the desk's calendar settings, when this type has a calendar
const tree = ref(null); // the desk's tree settings, for record types kept as a tree
const views = computed(() => [
	{ key: "list", label: "List", icon: "list" },
	...(calendar.value ? [{ key: "calendar", label: "Calendar", icon: "cal" }] : []),
	...(tree.value ? [{ key: "tree", label: "Tree", icon: "tree" }] : []),
	...((list.meta?.fields || []).some((f) => f.fieldtype === "Select" && f.options && !f.hidden)
		? [{ key: "board", label: "Board", icon: "board" }]
		: []),
]);
const viewChoice = ref(route.query.view || "list");
const view = computed(() =>
	views.value.some((v) => v.key === viewChoice.value) ? viewChoice.value : "list",
);
// Kept out of the router so switching doesn't reload the screen and drop the filters.
function setView(v) {
	viewChoice.value = v;
	const url = new URL(window.location.href);
	if (v === "list") url.searchParams.delete("view");
	else url.searchParams.set("view", v);
	window.history.replaceState(window.history.state, "", url);
}
const customColumns = ref(null); // the user's own column choice, kept in their list settings
const bulk = reactive({ field: "", value: "" });
const confirming = ref(null);

const list = reactive({
	doctype: props.doctype,
	meta: null,
	perms: {},
	rows: [],
	total: null,
	loading: true,
	error: "",
	notice: "",
	search: "",
	filters: [], // { field, op, value }
	sort: "modified desc",
	pageLength: 20,
	selected: [],
	buttons: [],
	primaryAction: null,
	settings: null,
	addFields: [],
	unsupported: [],
	listview: null,
	reload: (more = false) => load(more),
	addFilters(filters) {
		for (const f of [].concat(filters || [])) {
			if (Array.isArray(f)) {
				const [field, op, value] = f.length === 4 ? f.slice(1) : f;
				list.filters.push({ field, op, value });
			} else if (f && typeof f === "object") {
				for (const [field, v] of Object.entries(f))
					list.filters.push(
						Array.isArray(v)
							? { field, op: v[0], value: v[1] }
							: { field, op: "=", value: v },
					);
			}
		}
		load();
	},
	clearFilters() {
		list.filters = [];
		load();
	},
	filterTuples: () => serverFilters(),
});

const area = computed(() => areaForDoctype(props.doctype));
const navItem = computed(() => allNavItems().find((i) => i.doctype === props.doctype));
const label = computed(() => navItem.value?.label || props.doctype);
const singular = computed(() => props.doctype.toLowerCase());
const titleKey = computed(() => (list.meta ? titleField(list.meta) : null));
const titleLabel = computed(
	() => list.meta?.fields.find((f) => f.fieldname === titleKey.value)?.label || "ID",
);
const defaultColumns = computed(() =>
	list.meta
		? listFields(list.meta).filter(
				(f) => f.fieldname !== titleKey.value && f.fieldname !== "status",
			)
		: [],
);
const columnChoices = computed(() =>
	(list.meta?.fields || []).filter(
		(f) =>
			!isLayout(f) &&
			!isTable(f) &&
			![
				"Text Editor",
				"HTML Editor",
				"Code",
				"Attach Image",
				"Signature",
				"Password",
			].includes(f.fieldtype) &&
			f.fieldname !== titleKey.value &&
			f.fieldname !== "status" &&
			f.label,
	),
);
const columns = computed(() =>
	customColumns.value
		? customColumns.value
				.map((n) => columnChoices.value.find((f) => f.fieldname === n))
				.filter(Boolean)
		: defaultColumns.value,
);
const groupByOptions = computed(() => [
	{ fieldname: "assigned_to", label: "Assigned to" },
	{ fieldname: "owner", label: "Created by" },
	...fields.value.filter(
		(d) =>
			(d.fieldname === "status" || d.in_standard_filter) &&
			["Link", "Select", "Check"].includes(d.fieldtype),
	),
]);
const canCreate = computed(
	() => list.meta && !list.meta.issingle && !list.meta.istable && list.perms.create,
);
const isNum = (f) => ["Currency", "Float", "Int", "Percent"].includes(f.fieldtype);
const allSelected = computed(
	() => list.rows.length > 0 && list.selected.length === list.rows.length,
);
const prefill = computed(() =>
	Object.fromEntries(list.filters.filter((f) => f.op === "=").map((f) => [f.field, f.value])),
);

const fields = computed(() =>
	(list.meta?.fields || []).filter((d) => !isLayout(d) && !isTable(d)),
);
const quickFilters = computed(() =>
	fields.value
		.filter(
			(d) =>
				d.in_standard_filter && ["Link", "Select", "Check", "Date"].includes(d.fieldtype),
		)
		.slice(0, 4),
);
const filterableFields = computed(() => [
	{ fieldname: "name", label: "ID" },
	...fields.value,
	{ fieldname: "modified", label: "Last updated", fieldtype: "Datetime" },
	{ fieldname: "creation", label: "Created on", fieldtype: "Datetime" },
	{ fieldname: "owner", label: "Created by" },
	{ fieldname: "_assign", label: "Assigned to" },
	{ fieldname: "_user_tags", label: "Tags" },
]);
const editableFields = computed(() =>
	fields.value.filter(
		(d) =>
			!d.read_only &&
			!d.hidden &&
			[
				"Data",
				"Select",
				"Link",
				"Date",
				"Check",
				"Int",
				"Float",
				"Currency",
				"Small Text",
			].includes(d.fieldtype) &&
			(list.meta?.is_submittable ? true : true),
	),
);
const sortOptions = computed(() => [
	{ value: "modified desc", label: "Last updated" },
	{ value: "creation desc", label: "Newest first" },
	{ value: "creation asc", label: "Oldest first" },
	...fields.value
		.filter(
			(d) =>
				[
					"Date",
					"Datetime",
					"Int",
					"Float",
					"Currency",
					"Data",
					"Link",
					"Select",
				].includes(d.fieldtype) &&
				(d.in_list_view || d.bold || d.fieldtype === "Date"),
		)
		.flatMap((d) => [
			{ value: `${d.fieldname} desc`, label: `${d.label} ↓` },
			{ value: `${d.fieldname} asc`, label: `${d.label} ↑` },
		]),
]);
const sortLabel = computed(
	() => sortOptions.value.find((o) => o.value === list.sort)?.label || "Sort",
);

const buttonGroups = computed(() => {
	const groups = new Map();
	for (const b of list.buttons.filter((x) => x.group !== "Actions")) {
		if (!groups.has(b.group)) groups.set(b.group, []);
		groups.get(b.group).push(b);
	}
	return [...groups.entries()].map(([group, buttons]) => ({ group, buttons }));
});
const actionItems = computed(() => list.buttons.filter((b) => b.group === "Actions"));

const fieldLabel = (f) => filterableFields.value.find((d) => d.fieldname === f)?.label || f;
const opLabel = (op) => OPERATORS.find((o) => o.value === op)?.label || op;
const tone = (c) =>
	({
		green: "bg-pos-tint text-pos",
		red: "bg-neg-tint text-neg",
		orange: "bg-warn-tint text-warn",
		yellow: "bg-warn-tint text-warn",
		blue: "bg-acc-tint text-acc",
		darkgrey: "bg-line-2 text-ink-2",
		gray: "bg-line-2 text-ink-2",
		grey: "bg-line-2 text-ink-2",
		purple: "bg-[#EBE2FE] text-[#6A3BD0]",
		pink: "bg-[#FCE1EF] text-[#B8286E]",
		cyan: "bg-acc-tint text-acc",
	})[c] || "bg-line-2 text-ink-2";
const indicator = (row) => listIndicator(list, row);

function toggleMenu(key) {
	menu.value = menu.value === key ? null : key;
}

// ---- filters ----
function serverFilters() {
	return list.filters.map((f) => {
		if (f.op === "is set" || f.op === "is not set")
			return [props.doctype, f.field, "is", f.op === "is set" ? "set" : "not set"];
		const value = f.op === "like" && !String(f.value).includes("%") ? `%${f.value}%` : f.value;
		return [props.doctype, f.field, f.op, value];
	});
}
function quickValue(df) {
	return list.filters.find((f) => f.field === df.fieldname && f.op === "=")?.value ?? "";
}
function quickOptions(df) {
	if (df.fieldtype === "Check")
		return [
			{ value: "1", label: "Yes" },
			{ value: "0", label: "No" },
		];
	return String(df.options || "")
		.split("\n")
		.filter(Boolean)
		.map((o) => ({ value: o, label: o }));
}
function setQuick(df, value) {
	list.filters = list.filters.filter((f) => !(f.field === df.fieldname && f.op === "="));
	if (value !== "" && value !== null) list.filters.push({ field: df.fieldname, op: "=", value });
	load();
}
function applyDraft() {
	if (!draft.field) return;
	list.filters.push({ field: draft.field, op: draft.op, value: draft.value });
	Object.assign(draft, { field: "", op: "=", value: "" });
	menu.value = null;
	load();
}
function addFilter(f) {
	list.filters.push(f);
	load();
}
function applySaved(filters) {
	list.filters = filters;
	load();
}
function onBulkDone(message) {
	list.notice = message;
	list.selected = [];
	load();
}
function removeFilter(i) {
	list.filters.splice(i, 1);
	load();
}
function setSort(v) {
	list.sort = v;
	menu.value = null;
	load();
}

// Filters arriving in the URL (connections, links from scripts): ?field=value or ?field=["op", value]
function filtersFromRoute() {
	const out = [];
	for (const [k, raw] of Object.entries(route.query)) {
		if (!list.meta.fields.some((d) => d.fieldname === k) && !["name", "owner"].includes(k))
			continue;
		let v = raw;
		try {
			const parsed = JSON.parse(raw);
			if (Array.isArray(parsed)) {
				out.push({ field: k, op: parsed[0], value: parsed[1] });
				continue;
			}
		} catch {
			/* plain value */
		}
		out.push({ field: k, op: "=", value: v });
	}
	return out;
}

// ---- data ----
let seq = 0;
async function load(more = false) {
	const mine = ++seq;
	list.loading = true;
	list.error = "";
	try {
		const hasStatus = list.meta.fields.some((f) => f.fieldname === "status");
		const fieldsToGet = [
			...new Set(
				[
					"name",
					"docstatus",
					"modified",
					titleKey.value,
					hasStatus && "status",
					...columns.value.map((f) => f.fieldname),
					...list.addFields,
				].filter(Boolean),
			),
		];
		const q = list.search.trim();
		const orFilters = q
			? [
					[props.doctype, "name", "like", `%${q}%`],
					...(titleKey.value ? [[props.doctype, titleKey.value, "like", `%${q}%`]] : []),
				]
			: null;
		const [page, count] = await Promise.all([
			call("frappe.client.get_list", {
				doctype: props.doctype,
				fields: fieldsToGet,
				filters: serverFilters(),
				or_filters: orFilters,
				order_by: list.sort,
				limit_start: more ? list.rows.length : 0,
				limit_page_length: list.pageLength,
			}),
			more
				? Promise.resolve(list.total)
				: call("frappe.client.get_count", {
						doctype: props.doctype,
						filters: serverFilters(),
						or_filters: orFilters,
					}).catch(() => null),
		]);
		if (mine !== seq) return;
		list.rows = more ? [...list.rows, ...page] : page;
		list.total = count;
		if (!more) list.selected = list.selected.filter((n) => page.some((r) => r.name === n));
	} catch (e) {
		if (mine === seq)
			list.error = messageOf(e, `You may not have permission to see ${props.doctype}.`);
	} finally {
		if (mine === seq) list.loading = false;
	}
}

let timer;
watch(
	() => list.search,
	() => {
		clearTimeout(timer);
		timer = setTimeout(() => load(), 250);
	},
);

function open(row) {
	router.push({ name: "Form", params: { doctype: props.doctype, name: row.name } });
}
function toggleAll() {
	list.selected = allSelected.value ? [] : list.rows.map((r) => r.name);
}

// ---- row button from list settings ----
const rowButtonShown = (row) => {
	try {
		return list.settings.button.show ? list.settings.button.show(row) : true;
	} catch {
		return false;
	}
};
const rowButtonLabel = (row) => {
	try {
		return list.settings.button.get_label ? list.settings.button.get_label(row) : "Open";
	} catch {
		return "Open";
	}
};
const rowButtonDescription = (row) => {
	try {
		return list.settings.button.get_description
			? list.settings.button.get_description(row)
			: "";
	} catch {
		return "";
	}
};

async function runButton(b) {
	menu.value = null;
	try {
		await b.action();
	} catch (e) {
		if (!e?.fromThrow) list.error = messageOf(e, `${b.label} failed`);
	}
}

// ---- bulk actions: the desk's own endpoints, which check permissions per document ----
function confirmBulk(action) {
	const n = list.selected.length;
	const map = {
		submit: {
			title: `Submit ${n} records?`,
			body: "Each one is submitted with its own validations. Any that fail stay as drafts.",
			cta: "Submit",
		},
		cancel: {
			title: `Cancel ${n} records?`,
			body: "This reverses their effects. Any that can't be cancelled are left as they are.",
			cta: "Cancel them",
			danger: true,
		},
		delete: {
			title: `Delete ${n} records?`,
			body: "This can't be undone.",
			cta: "Delete",
			danger: true,
		},
	};
	confirming.value = { ...map[action], run: () => bulkAction(action) };
}

async function bulkAction(action) {
	confirming.value = null;
	bulkEditOpen.value = false;
	const names = [...list.selected];
	list.notice = "";
	try {
		let failed = [];
		if (action === "delete") {
			failed =
				(await call("frappe.desk.reportview.delete_items", {
					items: names,
					doctype: props.doctype,
				})) || [];
		} else {
			const data = action === "update" ? { [bulk.field]: bulk.value } : null;
			failed =
				(await call(
					"frappe.desk.doctype.bulk_update.bulk_update.submit_cancel_or_update_docs",
					{ doctype: props.doctype, docnames: names, action, data },
				)) || [];
		}
		const done = names.length - (failed?.length || 0);
		list.notice =
			names.length > 19
				? "Working on it in the background. Refresh in a minute to see the result."
				: `${done} of ${names.length} done.${
						failed?.length ? ` Not changed: ${failed.join(", ")}` : ""
					}`;
		list.selected = [];
		Object.assign(bulk, { field: "", value: "" });
		await load();
	} catch (e) {
		list.error = messageOf(e, "Bulk action failed.");
	}
}

// ---- export (same endpoint as the desk's report view) ----
async function exportRows(format, onlySelected = false) {
	menu.value = null;
	const form = new FormData();
	const cols = ["name", titleKey.value, ...columns.value.map((c) => c.fieldname)].filter(
		Boolean,
	);
	form.append("doctype", props.doctype);
	form.append("file_format_type", format);
	form.append("title", props.doctype);
	form.append(
		"fields",
		JSON.stringify([...new Set(cols)].map((c) => `\`tab${props.doctype}\`.\`${c}\``)),
	);
	const filters = onlySelected
		? [[props.doctype, "name", "in", list.selected]]
		: serverFilters();
	form.append("filters", JSON.stringify(filters));
	form.append("order_by", list.sort);
	try {
		const res = await fetch("/api/method/frappe.desk.reportview.export_query", {
			method: "POST",
			headers: { "X-Frappe-CSRF-Token": window.csrf_token },
			body: form,
		});
		if (!res.ok) throw new Error("Export failed");
		const blob = await res.blob();
		const a = document.createElement("a");
		a.href = URL.createObjectURL(blob);
		a.download = `${props.doctype}.${format === "Excel" ? "xlsx" : "csv"}`;
		a.click();
		URL.revokeObjectURL(a.href);
	} catch (e) {
		list.error = messageOf(e, "Export failed.");
	}
}

watch(
	() => list.pageLength,
	() => load(),
);

// ---- live: refresh when records change, unless the user is in the middle of something ----
let lastStamp = null;
useLiveCheck(async () => {
	if (!list.meta || list.loading || view.value !== "list") return;
	const [latest] = await call("frappe.client.get_list", {
		doctype: props.doctype,
		fields: ["modified"],
		filters: serverFilters(),
		order_by: "modified desc",
		limit_page_length: 1,
	});
	const count = await call("frappe.client.get_count", {
		doctype: props.doctype,
		filters: serverFilters(),
	});
	const stamp = `${latest?.modified || ""}|${count}`;
	const changed = lastStamp !== null && stamp !== lastStamp;
	lastStamp = stamp;
	if (changed && !list.selected.length && !menu.value && !bulkMode.value && !bulkEditOpen.value)
		await load();
});

// Realtime: refresh as soon as a record of this type changes, with the same courtesy as above.
let listTimer;
const stopListUpdates = onListUpdate(props.doctype, () => {
	clearTimeout(listTimer);
	listTimer = setTimeout(() => {
		if (!list.meta || list.loading || view.value !== "list") return;
		if (list.selected.length || menu.value || bulkMode.value || bulkEditOpen.value) return;
		load();
	}, 400);
});
onBeforeUnmount(() => {
	stopListUpdates();
	clearTimeout(listTimer);
});

// ---- the user's columns, saved with their other list settings for this record type ----
let savedColumns = null; // JSON of what's stored, so loading it doesn't save it again
async function loadColumnChoice() {
	try {
		const raw = await call("frappe.model.utils.user_settings.get", { doctype: props.doctype });
		const saved = (typeof raw === "string" ? JSON.parse(raw || "{}") : raw || {})
			.briskrew_columns;
		customColumns.value = Array.isArray(saved) && saved.length ? saved : null;
	} catch {
		customColumns.value = null;
	}
	savedColumns = JSON.stringify(customColumns.value);
}
watch(customColumns, (cols) => {
	if (savedColumns === null || JSON.stringify(cols) === savedColumns) return;
	savedColumns = JSON.stringify(cols);
	call("frappe.model.utils.user_settings.save", {
		doctype: props.doctype,
		user_settings: JSON.stringify({ briskrew_columns: cols }),
	}).catch(() => {});
	load();
});

onMounted(async () => {
	try {
		const [m, perms] = await Promise.all([getMeta(props.doctype), loadPerms(props.doctype)]);
		list.meta = m.meta;
		list.perms = perms || {};
		if (list.meta.issingle) {
			router.replace({
				name: "Form",
				params: { doctype: props.doctype, name: props.doctype },
			});
			return;
		}
		list.filters = filtersFromRoute();
		await loadColumnChoice();
		await attachListScript(list, router);
		[calendar.value, tree.value] = await Promise.all([
			calendarSettings(list.meta).catch(() => null),
			treeSettings(list.meta).catch(() => null),
		]);
		await load();
	} catch (e) {
		list.error = messageOf(e, `Couldn't open ${props.doctype}.`);
		list.loading = false;
	}
});
onBeforeUnmount(() => detachListScript(list));
</script>

<style scoped>
.menu {
	@apply absolute top-full z-30 mt-1 min-w-[200px] rounded-lg border border-line bg-surf py-1 shadow-xl;
}
.menu-item {
	@apply block w-full px-3 py-1.5 text-left text-[13.5px] hover:bg-acc-tint;
}
.bulk-btn {
	@apply rounded-md px-2.5 py-1 text-[13px] font-semibold hover:bg-ink-nav;
}
</style>
