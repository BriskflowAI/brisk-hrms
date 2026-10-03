<template>
	<!-- The desk's Report view: a spreadsheet of any columns, edited in place, grouped with totals.
	     Settings stay per user; "Save as report" makes a Report Builder report the desk opens too. -->
	<section :aria-label="__('Report view')" class="flex flex-col gap-3">
		<div class="flex flex-wrap items-center gap-2">
			<ColumnPicker v-model="chosen" :fields="columnChoices" :defaults="defaultColumns" />
			<div
				class="flex items-center gap-1.5 rounded-lg border border-line bg-surf px-2.5 py-1"
			>
				<label for="rg-group" class="text-[12.5px] font-semibold text-ink-2">{{
					__("Group by")
				}}</label>
				<select id="rg-group" v-model="group.field" :class="sel">
					<option value="">{{ __("None") }}</option>
					<option v-for="f in groupable" :key="f.fieldname" :value="f.fieldname">
						{{ __(f.label) }}
					</option>
				</select>
				<template v-if="group.field">
					<select v-model="group.fn" :aria-label="__('Summary')" :class="sel">
						<option value="count">{{ __("Count") }}</option>
						<option value="sum" :disabled="!numeric.length">{{ __("Sum of") }}</option>
						<option value="avg" :disabled="!numeric.length">
							{{ __("Average of") }}
						</option>
					</select>
					<select
						v-if="group.fn !== 'count'"
						v-model="group.on"
						:aria-label="__('Of')"
						:class="sel"
					>
						<option v-for="f in numeric" :key="f.fieldname" :value="f.fieldname">
							{{ __(f.label) }}
						</option>
					</select>
				</template>
			</div>
			<label class="flex items-center gap-2 text-[13px] text-ink-2">
				<input v-model="totals" type="checkbox" class="rounded border-line text-acc" />
				{{ __("Totals row") }}{{ " " }}
			</label>
			<span class="ml-auto text-[12.5px] text-mut">
				<template v-if="canEditAny && !group.field">{{
					__("Double-click a cell to edit it.")
				}}</template>
			</span>
			<form v-if="saving" class="flex items-center gap-1.5" @submit.prevent="saveReport">
				<input
					v-model="reportName"
					type="text"
					:aria-label="__('Report name')"
					:placeholder="__('Report name')"
					class="h-8 rounded-md border border-line bg-surf px-2 text-[13px]"
				/>
				<button
					type="submit"
					class="btn-ink h-8 px-3 text-[13px]"
					:disabled="!reportName.trim()"
				>
					{{ __("Save") }}
				</button>
				<button
					type="button"
					class="btn-ghost h-8 px-3 text-[13px]"
					@click="saving = false"
				>
					{{ __("Cancel") }}
				</button>
			</form>
			<button v-else type="button" class="btn-ghost h-9" @click="saving = true">
				{{ __("Save as report") }}
			</button>
		</div>
		<p
			v-if="error"
			role="alert"
			class="rounded-lg bg-neg-tint px-4 py-2.5 text-[13.5px] text-neg"
		>
			{{ error }}
		</p>
		<p v-if="notice" role="status" class="rounded-lg bg-acc-tint px-4 py-2.5 text-[13.5px]">
			{{ notice }}
		</p>

		<div class="overflow-auto rounded-xl border border-line bg-surf">
			<table class="w-full border-collapse text-[13px]" @keydown="onGridKey">
				<thead class="sticky top-0 z-10 bg-paper">
					<tr>
						<th
							v-for="c in shown"
							:key="c.fieldname"
							class="whitespace-nowrap border-b border-r border-line-2 px-3 py-2 font-semibold text-mut last:border-r-0"
							:class="isNum(c) ? 'text-right' : 'text-left'"
							:aria-sort="
								sortField === c.fieldname
									? sortDir === 'asc'
										? 'ascending'
										: 'descending'
									: 'none'
							"
						>
							<button
								type="button"
								class="inline-flex items-center gap-1 hover:text-ink"
								:disabled="!!group.field"
								@click="sortBy(c.fieldname)"
							>
								{{ __(c.label) }}
								<span v-if="sortField === c.fieldname" aria-hidden="true">{{
									sortDir === "asc" ? "↑" : "↓"
								}}</span>
							</button>
						</th>
					</tr>
				</thead>
				<tbody>
					<tr
						v-for="(row, r) in rows"
						:key="row.name || r"
						class="border-b border-line-2"
					>
						<td
							v-for="(c, ci) in shown"
							:key="c.fieldname"
							:data-r="r"
							:data-c="ci"
							tabindex="-1"
							class="h-9 whitespace-nowrap border-r border-line-2 px-3 py-1.5 last:border-r-0 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-acc"
							:class="[
								isNum(c) && 'text-right tabular-nums',
								editable(row, c) && 'cursor-cell',
							]"
							@dblclick="startEdit(r, ci)"
							@focus="cursor = { r, c: ci }"
						>
							<template v-if="editing && editing.r === r && editing.c === ci">
								<select
									v-if="c.fieldtype === 'Select'"
									ref="editor"
									v-model="editing.value"
									:class="cellInput"
									@keydown.enter.prevent="commit"
									@keydown.esc.prevent="cancel"
									@blur="commit"
								>
									<option v-for="o in optionsOf(c)" :key="o" :value="o">
										{{ o || "—" }}
									</option>
								</select>
								<input
									v-else-if="c.fieldtype === 'Check'"
									ref="editor"
									v-model="editing.value"
									type="checkbox"
									:true-value="1"
									:false-value="0"
									class="rounded border-line text-acc"
									@keydown.enter.prevent="commit"
									@keydown.esc.prevent="cancel"
									@blur="commit"
								/>
								<input
									v-else
									ref="editor"
									v-model="editing.value"
									:type="inputType(c)"
									:step="isNum(c) ? 'any' : undefined"
									:class="cellInput"
									@keydown.enter.prevent="commit"
									@keydown.esc.prevent="cancel"
									@blur="commit"
								/>
							</template>
							<router-link
								v-else-if="c.fieldname === 'name' && !group.field"
								:to="{ name: 'Form', params: { doctype, name: row.name } }"
								class="font-semibold text-acc"
								>{{ row.name }}</router-link
							>
							<FieldValue v-else :field="c" :value="row[c.fieldname]" />
						</td>
					</tr>
					<tr v-if="totals && rows.length" class="bg-paper font-bold">
						<td
							v-for="(c, ci) in shown"
							:key="c.fieldname"
							class="whitespace-nowrap border-r border-line-2 px-3 py-2 last:border-r-0"
							:class="isNum(c) && 'text-right tabular-nums'"
						>
							<template v-if="ci === 0 && !isNum(c)">{{ __("Total") }}</template>
							<FieldValue
								v-else-if="isNum(c)"
								:field="c"
								:value="sum(c.fieldname)"
							/>
						</td>
					</tr>
				</tbody>
			</table>
			<div
				v-if="!loading && !rows.length"
				class="px-6 py-12 text-center text-[13.5px] text-mut"
			>
				{{ __("Nothing to show for these filters.") }}
			</div>
			<div v-if="loading" class="px-6 py-5 text-center text-[13px] text-mut">
				{{ __("Loading…") }}
			</div>
		</div>
		<button
			v-if="!group.field && rows.length && rows.length % pageLength === 0 && !exhausted"
			type="button"
			class="btn-ghost self-center"
			@click="load(true)"
		>
			{{ " " }}{{ __("Load") }} {{ pageLength }} {{ __("more") }}{{ " " }}
		</button>
	</section>
</template>

<script setup>
import { call } from "frappe-ui";
import { computed, nextTick, reactive, ref, watch } from "vue";
import { useRoute } from "vue-router";
import ColumnPicker from "./ColumnPicker.vue";
import FieldValue from "@/components/FieldValue.vue";
import { isLayout, isTable, listFields } from "@/composables/api";
import { messageOf } from "@/engine/form";

const props = defineProps({
	doctype: { type: String, required: true },
	meta: { type: Object, required: true },
	filters: { type: Array, required: true },
	perms: { type: Object, default: () => ({}) },
});
const emit = defineEmits(["filters"]);
const route = useRoute();

const sel =
	"h-7 rounded-md border-0 bg-transparent py-0 pl-1 pr-7 text-[13px] focus:ring-1 focus:ring-acc";
const cellInput =
	"h-7 w-full min-w-[120px] rounded border border-acc bg-surf px-1.5 py-0 text-[13px] focus:ring-1 focus:ring-acc";
const NUM = ["Currency", "Float", "Int", "Percent"];
const EDITABLE = [
	"Data",
	"Select",
	"Link",
	"Date",
	"Datetime",
	"Check",
	"Int",
	"Float",
	"Currency",
	"Percent",
	"Small Text",
	"Phone",
];
const pageLength = 100;

const base = [
	{ fieldname: "name", label: "ID", fieldtype: "Data", read_only: 1 },
	{ fieldname: "owner", label: "Created by", fieldtype: "Link", options: "User", read_only: 1 },
	{ fieldname: "creation", label: "Created on", fieldtype: "Datetime", read_only: 1 },
	{ fieldname: "modified", label: "Last updated", fieldtype: "Datetime", read_only: 1 },
];
const fields = computed(() =>
	props.meta.fields.filter(
		(f) =>
			!isLayout(f) &&
			!isTable(f) &&
			f.label &&
			![
				"Text Editor",
				"HTML Editor",
				"Code",
				"Attach Image",
				"Signature",
				"Password",
				"Long Text",
				"Text",
			].includes(f.fieldtype),
	),
);
const columnChoices = computed(() => [...base, ...fields.value]);
const defaultColumns = computed(() => [
	"name",
	...listFields(props.meta).map((f) => f.fieldname),
	...(props.meta.fields.some((f) => f.fieldname === "status") ? ["status"] : []),
]);
const chosen = ref(null);
const shownBase = computed(() =>
	(chosen.value || defaultColumns.value)
		.map((n) => columnChoices.value.find((f) => f.fieldname === n))
		.filter(Boolean),
);
const groupable = computed(() => [
	base[1],
	...fields.value.filter((f) =>
		["Link", "Select", "Data", "Check", "Date"].includes(f.fieldtype),
	),
]);
const numeric = computed(() => fields.value.filter((f) => NUM.includes(f.fieldtype)));
const group = reactive({ field: "", fn: "count", on: "" });
const totals = ref(false);
const sortField = ref("modified");
const sortDir = ref("desc");
const rows = ref([]);
const loading = ref(false);
const exhausted = ref(false);
const error = ref("");
const notice = ref("");
const saving = ref(false);
const reportName = ref("");
const editing = ref(null);
const editor = ref(null);
const cursor = ref({ r: 0, c: 0 });

const groupColumn = computed(() => {
	const f = columnChoices.value.find((x) => x.fieldname === group.field);
	const on = numeric.value.find((x) => x.fieldname === group.on);
	const label =
		group.fn === "count"
			? "Count"
			: `${group.fn === "sum" ? "Sum" : "Average"} of ${on?.label || ""}`;
	return [
		f,
		{
			fieldname: "_aggregate_column",
			label,
			fieldtype: group.fn === "count" ? "Int" : on?.fieldtype || "Float",
		},
	].filter(Boolean);
});
const shown = computed(() => (group.field ? groupColumn.value : shownBase.value));
const isNum = (c) => NUM.includes(c.fieldtype);
const canEditAny = computed(() => !!props.perms.write);
const editable = (row, c) =>
	!group.field &&
	canEditAny.value &&
	Number(row.docstatus || 0) === 0 &&
	EDITABLE.includes(c.fieldtype) &&
	!c.read_only &&
	!c.hidden &&
	!["name", "owner", "creation", "modified"].includes(c.fieldname);
const optionsOf = (c) => [
	"",
	...String(c.options || "")
		.split("\n")
		.filter(Boolean),
];
const inputType = (c) =>
	isNum(c)
		? "number"
		: c.fieldtype === "Date"
		  ? "date"
		  : c.fieldtype === "Datetime"
		    ? "datetime-local"
		    : "text";
const sum = (f) => rows.value.reduce((a, r) => a + (Number(r[f]) || 0), 0);
const q = (f) => `\`tab${props.doctype}\`.\`${f}\``;

// ---- data: the desk's own report endpoint ----
let seq = 0;
async function load(more = false) {
	const mine = ++seq;
	loading.value = true;
	error.value = "";
	try {
		const args = {
			doctype: props.doctype,
			filters: props.filters,
			page_length: group.field ? 500 : pageLength,
		};
		if (group.field) {
			Object.assign(args, {
				fields: [q(group.field)],
				group_by: q(group.field),
				aggregate_function: group.fn,
				aggregate_on_field: group.fn === "count" ? "name" : group.on,
				aggregate_on_doctype: props.doctype,
				order_by: "_aggregate_column desc",
			});
		} else {
			const names = [
				...new Set(["name", "docstatus", ...shown.value.map((c) => c.fieldname)]),
			];
			Object.assign(args, {
				fields: names.map(q),
				order_by: `${q(sortField.value)} ${sortDir.value}`,
				start: more ? rows.value.length : 0,
			});
		}
		const res = await call("frappe.desk.reportview.get", args);
		if (mine !== seq) return;
		const keys = res?.keys || [];
		const page = (res?.values || []).map((v) =>
			Object.fromEntries(keys.map((k, i) => [k, v[i]])),
		);
		rows.value = more ? [...rows.value, ...page] : page;
		exhausted.value = page.length < args.page_length;
	} catch (e) {
		if (mine === seq) error.value = messageOf(e, "Couldn't load this report view.");
	} finally {
		if (mine === seq) loading.value = false;
	}
}

function sortBy(f) {
	if (sortField.value === f) sortDir.value = sortDir.value === "asc" ? "desc" : "asc";
	else {
		sortField.value = f;
		sortDir.value = NUM.includes(columnChoices.value.find((x) => x.fieldname === f)?.fieldtype)
			? "desc"
			: "asc";
	}
}

// ---- editing in place, through the same save the desk uses for a single field ----
async function startEdit(r, ci) {
	const row = rows.value[r];
	const c = shown.value[ci];
	if (!row || !c || !editable(row, c)) return;
	let value = row[c.fieldname] ?? "";
	if (c.fieldtype === "Datetime" && value) value = String(value).replace(" ", "T").slice(0, 16);
	editing.value = { r, c: ci, value, original: row[c.fieldname] };
	await nextTick();
	const el = Array.isArray(editor.value) ? editor.value[0] : editor.value;
	el?.focus();
	el?.select?.();
}
function cancel() {
	const at = editing.value;
	editing.value = null;
	if (at) focusCell(at.r, at.c);
}
async function commit() {
	const at = editing.value;
	if (!at) return;
	editing.value = null;
	const row = rows.value[at.r];
	const c = shown.value[at.c];
	let value = at.value;
	if (isNum(c)) value = value === "" ? null : Number(value);
	if (c.fieldtype === "Datetime" && value) value = value.replace("T", " ") + ":00";
	if (value === "" && at.original == null) value = at.original;
	if (value === at.original) return focusCell(at.r, at.c);
	row[c.fieldname] = value;
	try {
		const doc = await call("frappe.client.set_value", {
			doctype: props.doctype,
			name: row.name,
			fieldname: c.fieldname,
			value,
		});
		for (const col of shown.value)
			if (doc && col.fieldname in doc) row[col.fieldname] = doc[col.fieldname];
		error.value = "";
	} catch (e) {
		row[c.fieldname] = at.original;
		error.value = messageOf(e, `Couldn't change ${c.label} for ${row.name}.`);
	}
	focusCell(at.r, at.c);
}

// Arrow keys move between cells, Enter edits, as in a spreadsheet.
function focusCell(r, c) {
	nextTick(() => document.querySelector(`td[data-r="${r}"][data-c="${c}"]`)?.focus());
}
function onGridKey(e) {
	if (editing.value || e.target.tagName !== "TD") return;
	const { r, c } = cursor.value;
	const moves = { ArrowDown: [1, 0], ArrowUp: [-1, 0], ArrowRight: [0, 1], ArrowLeft: [0, -1] };
	if (moves[e.key]) {
		e.preventDefault();
		const nr = Math.max(0, Math.min(rows.value.length - 1, r + moves[e.key][0]));
		const nc = Math.max(0, Math.min(shown.value.length - 1, c + moves[e.key][1]));
		focusCell(nr, nc);
	} else if (e.key === "Enter" || e.key === "F2") {
		e.preventDefault();
		startEdit(r, c);
	}
}

// ---- settings: per user, and "Save as report" for everyone with access ----
const settings = () => ({
	filters: props.filters,
	fields: (chosen.value || defaultColumns.value).map((f) => [f, props.doctype]),
	order_by: `${q(sortField.value)} ${sortDir.value}`,
	add_totals_row: totals.value ? 1 : 0,
	page_length: pageLength,
	group_by: group.field
		? {
				group_by: q(group.field),
				aggregate_function: group.fn,
				aggregate_on: group.fn === "count" ? "name" : group.on,
		  }
		: null,
});
async function saveReport() {
	try {
		await call("frappe.desk.reportview.save_report", {
			name: reportName.value.trim(),
			doctype: props.doctype,
			report_settings: JSON.stringify(settings()),
		});
		notice.value = `Saved as “${reportName.value.trim()}”. It's under Reports, and opens here with these columns.`;
		saving.value = false;
		reportName.value = "";
	} catch (e) {
		error.value = messageOf(e, "Couldn't save the report.");
	}
}

function apply(s) {
	if (Array.isArray(s?.fields) && s.fields.length)
		chosen.value = s.fields
			.map((f) => (Array.isArray(f) ? f[0] : f))
			.filter((f) => !String(f).includes("."));
	if (s?.order_by) {
		const m = String(s.order_by).match(/`?([a-z0-9_]+)`?\s+(asc|desc)/i);
		if (m) [sortField.value, sortDir.value] = [m[1], m[2].toLowerCase()];
	}
	totals.value = !!s?.add_totals_row;
	if (s?.group_by?.group_by) {
		group.field = String(s.group_by.group_by).replace(/.*`\.`?|`/g, "");
		group.fn = s.group_by.aggregate_function || "count";
		group.on = s.group_by.aggregate_on || "";
	}
}

let ready = false;
async function init() {
	try {
		// A saved Report Builder report opens with its settings, including its filters.
		if (route.query.report) {
			const report = await call("frappe.client.get", {
				doctype: "Report",
				name: route.query.report,
			});
			const s = JSON.parse(report?.json || "{}");
			apply(s);
			if (Array.isArray(s.filters) && s.filters.length) emit("filters", s.filters);
		} else {
			const raw = await call("frappe.model.utils.user_settings.get", {
				doctype: props.doctype,
			});
			apply((typeof raw === "string" ? JSON.parse(raw || "{}") : raw || {}).briskrew_report);
		}
	} catch {
		/* defaults */
	}
	ready = true;
	await load();
}
watch(
	[chosen, () => ({ ...group }), totals, sortField, sortDir],
	() => {
		if (!ready) return;
		if (group.fn !== "count" && !group.on) group.on = numeric.value[0]?.fieldname || "";
		if (!route.query.report)
			call("frappe.model.utils.user_settings.save", {
				doctype: props.doctype,
				user_settings: JSON.stringify({ briskrew_report: settings() }),
			}).catch(() => {});
		load();
	},
	{ deep: true },
);
watch(
	() => JSON.stringify(props.filters),
	() => ready && load(),
);
init();
defineExpose({ reload: () => load() });
</script>
