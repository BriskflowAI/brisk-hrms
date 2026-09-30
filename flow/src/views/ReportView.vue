<template>
	<div class="flex flex-col gap-4 px-7 py-6">
		<header class="flex flex-wrap items-end gap-2">
			<div class="mr-auto">
				<div class="kicker">Report</div>
				<h1 class="mt-1.5 text-[34px] leading-none">{{ name }}</h1>
			</div>
			<button
				v-for="b in report.buttons"
				:key="b.label"
				type="button"
				class="btn-ghost"
				@click="b.action()"
			>
				{{ b.label }}
			</button>
			<button
				type="button"
				class="btn-ghost"
				:disabled="!report.rows.length"
				@click="exportReport('Excel')"
			>
				Export
			</button>
			<a :href="`/app/query-report/${encodeURIComponent(name)}`" class="btn-ghost"
				><Icon name="ext" :size="15" /> Classic desk</a
			>
			<button type="button" class="btn-ink" :disabled="report.loading" @click="report.run()">
				{{ report.loading ? "Running…" : "Refresh" }}
			</button>
		</header>

		<p
			v-if="report.unsupported.length"
			class="rounded-lg bg-line-2 px-4 py-2 text-[12.5px] text-ink-2"
		>
			Parts of this report's script ({{ report.unsupported.slice(0, 2).join(", ") }}) run
			only in the classic desk.
		</p>

		<section
			v-if="report.form && visibleFilters.length"
			aria-label="Filters"
			class="grid grid-cols-2 gap-x-8 gap-y-2 rounded-xl border border-line bg-surf px-5 py-4 lg:grid-cols-3"
		>
			<Field
				v-for="df in visibleFilters"
				:key="df.fieldname"
				:form="report.form"
				:df="report.form.df(df.fieldname) || df"
			/>
		</section>

		<p
			v-if="report.error"
			role="alert"
			class="rounded-lg bg-neg-tint px-4 py-3 text-[13.5px] text-neg"
		>
			{{ report.error }}
		</p>
		<p
			v-if="report.message"
			class="desk-html rounded-lg bg-acc-tint px-4 py-3 text-[13.5px]"
			v-html="report.message"
		/>

		<div v-if="report.summary.length" class="flex flex-wrap gap-3">
			<div
				v-for="s in report.summary"
				:key="s.label"
				class="rounded-xl border border-line bg-surf px-4 py-3"
			>
				<div class="text-[12px] text-mut">{{ s.label }}</div>
				<div
					class="mt-1 font-display text-[22px] font-bold tabular-nums"
					:class="
						{ Green: 'text-pos', Red: 'text-neg', Blue: 'text-acc' }[s.indicator] || ''
					"
				>
					{{ s.formatted }}
				</div>
			</div>
		</div>

		<div class="overflow-auto rounded-xl border border-line bg-surf">
			<table class="w-full border-collapse text-[13px]">
				<thead class="sticky top-0 bg-paper">
					<tr>
						<th
							v-for="c in report.columns"
							:key="c.fieldname"
							class="whitespace-nowrap border-b border-line px-3 py-2 font-semibold text-mut"
							:class="isNum(c) ? 'text-right' : 'text-left'"
						>
							{{ c.label }}
						</th>
					</tr>
				</thead>
				<tbody>
					<tr
						v-for="(row, i) in report.rows"
						:key="i"
						class="border-b border-line-2 hover:bg-paper"
						:class="row.__total && 'bg-paper font-bold'"
					>
						<td
							v-for="c in report.columns"
							:key="c.fieldname"
							class="desk-html whitespace-nowrap px-3 py-1.5"
							:class="isNum(c) ? 'text-right tabular-nums' : ''"
						>
							<router-link
								v-if="
									c.fieldtype === 'Link' &&
									c.options &&
									row[c.fieldname] &&
									!row.__total
								"
								:to="{
									name: 'Form',
									params: { doctype: c.options, name: row[c.fieldname] },
								}"
								class="font-semibold text-acc"
							>
								{{ row[c.fieldname] }}
							</router-link>
							<span v-else v-html="cell(row, c)" />
						</td>
					</tr>
				</tbody>
			</table>
			<div
				v-if="!report.loading && !report.rows.length && !report.error"
				class="px-6 py-12 text-center text-[13.5px] text-mut"
			>
				{{
					report.missing.length
						? `Fill in ${report.missing.join(", ")} to run this report.`
						: "Nothing to show for these filters."
				}}
			</div>
			<div v-if="report.loading" class="px-6 py-6 text-center text-[13px] text-mut">
				Running…
			</div>
		</div>

		<CompatDialogs />
	</div>
</template>

<script setup>
import { computed, onMounted, reactive, watch } from "vue";
import { call } from "frappe-ui";
import Icon from "@/components/Icon.vue";
import Field from "@/components/fields/Field.vue";
import CompatDialogs from "@/components/CompatDialogs.vue";
import { attachReportScript, reportCell } from "@/engine/compat";
import { messageOf } from "@/engine/form";

const props = defineProps({ name: { type: String, required: true } });

const report = reactive({
	name: props.name,
	filters: [],
	values: {},
	form: null,
	settings: null,
	columns: [],
	rows: [],
	summary: [],
	message: "",
	error: "",
	loading: false,
	buttons: [],
	unsupported: [],
	htmlFormat: "",
	get missing() {
		return report.filters
			.filter(
				(f) =>
					f.reqd &&
					(report.values[f.fieldname] === null ||
						report.values[f.fieldname] === undefined ||
						report.values[f.fieldname] === ""),
			)
			.map((f) => f.label);
	},
	setValue: (f, v) => (report.form ? report.form.setValue(f, v) : (report.values[f] = v)),
	run: () => run(),
});

const visibleFilters = computed(() =>
	report.filters.filter((f) => report.form?.visible(report.form.df(f.fieldname) || f)),
);
const isNum = (c) => ["Currency", "Float", "Int", "Percent"].includes(c.fieldtype);
const cell = (row, c) => reportCell(report, row[c.fieldname], c, row);

// Old-style column definitions: "Label:Fieldtype/Options:Width"
function normaliseColumn(c, i) {
	if (typeof c !== "string") return { ...c, fieldname: c.fieldname || `col${i}` };
	const [label, type = "Data", width] = c.split(":");
	const [fieldtype, options] = type.split("/");
	return {
		label,
		fieldtype: fieldtype || "Data",
		options,
		width,
		fieldname: label.toLowerCase().replace(/[^a-z0-9]+/g, "_") || `col${i}`,
	};
}

let seq = 0;
async function run() {
	if (report.missing.length) {
		report.rows = [];
		return;
	}
	const mine = ++seq;
	report.loading = true;
	report.error = "";
	try {
		const filters = Object.fromEntries(
			Object.entries(report.values).filter(
				([, v]) => v !== null && v !== undefined && v !== "",
			),
		);
		const res = await call("frappe.desk.query_report.run", {
			report_name: props.name,
			filters,
			ignore_prepared_report: false,
		});
		if (mine !== seq) return;
		if (res?.prepared_report && !res.result?.length) {
			report.message =
				"This report runs in the background. Open it in the classic desk to see the prepared result.";
		}
		report.columns = (res?.columns || []).map(normaliseColumn).filter((c) => !c.hidden);
		const rows = (res?.result || []).map((r) =>
			Array.isArray(r)
				? Object.fromEntries(report.columns.map((c, i) => [c.fieldname, r[i]]))
				: r,
		);
		if (res?.add_total_row && rows.length) {
			const total = { __total: true };
			report.columns.forEach((c, i) => {
				total[c.fieldname] = isNum(c)
					? rows.reduce((a, r) => a + (Number(r[c.fieldname]) || 0), 0)
					: i === 0
					  ? "Total"
					  : "";
			});
			rows.push(total);
		}
		report.rows = rows;
		report.message = res?.message || report.message;
		report.summary = (res?.report_summary || []).map((s) => ({
			...s,
			formatted: typeof s.value === "number" ? s.value.toLocaleString() : s.value,
		}));
	} catch (e) {
		if (mine === seq)
			report.error = messageOf(e, "The report couldn't run with these filters.");
	} finally {
		if (mine === seq) report.loading = false;
	}
}

async function exportReport(format) {
	const form = new FormData();
	form.append("report_name", props.name);
	form.append("file_format_type", format);
	form.append("filters", JSON.stringify(report.values));
	form.append("ignore_visible_idx", "1");
	try {
		const res = await fetch("/api/method/frappe.desk.query_report.export_query", {
			method: "POST",
			headers: { "X-Frappe-CSRF-Token": window.csrf_token },
			body: form,
		});
		if (!res.ok) throw new Error("Export failed");
		const blob = await res.blob();
		const a = document.createElement("a");
		a.href = URL.createObjectURL(blob);
		a.download = `${props.name}.${format === "Excel" ? "xlsx" : "csv"}`;
		a.click();
		URL.revokeObjectURL(a.href);
	} catch (e) {
		report.error = messageOf(e, "Export failed.");
	}
}

let timer;
watch(
	() => JSON.stringify(report.values),
	() => {
		clearTimeout(timer);
		timer = setTimeout(run, 350);
	},
);

onMounted(async () => {
	try {
		await attachReportScript(report);
		await run();
	} catch (e) {
		report.error = messageOf(e, `Couldn't open ${props.name}.`);
	}
});
</script>
