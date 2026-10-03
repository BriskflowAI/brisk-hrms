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
			<ColumnPicker
				v-if="report.columns.length"
				v-model="shownNames"
				:fields="report.columns"
				:defaults="report.columns.map((c) => c.fieldname)"
			/>
			<div class="relative" @keydown.esc="menu = false">
				<button
					type="button"
					class="btn-ghost px-2.5"
					aria-label="More"
					:aria-expanded="menu"
					@click="menu = !menu"
				>
					•••
				</button>
				<div v-if="menu" class="fixed inset-0 z-20" @click="menu = false" />
				<div
					v-if="menu"
					class="absolute right-0 top-full z-30 mt-1 w-[230px] rounded-lg border border-line bg-surf py-1 shadow-xl"
					@click="menu = false"
				>
					<button
						v-if="chart"
						type="button"
						class="menu-item"
						@click="chartHidden = !chartHidden"
					>
						{{ chartHidden ? "Show chart" : "Hide chart" }}
					</button>
					<button
						type="button"
						class="menu-item"
						:disabled="!report.rows.length"
						@click="printReport"
					>
						Print
					</button>
					<button
						type="button"
						class="menu-item"
						:disabled="!report.rows.length"
						@click="pdfReport"
					>
						Download PDF
					</button>
					<button
						type="button"
						class="menu-item"
						:disabled="!report.rows.length"
						@click="exportReport('Excel')"
					>
						Export to Excel
					</button>
					<button
						type="button"
						class="menu-item"
						:disabled="!report.rows.length"
						@click="exportReport('CSV')"
					>
						Export to CSV
					</button>
					<div class="my-1 border-t border-line-2" />
					<button type="button" class="menu-item" @click="saveAsOpen = true">
						Save as…
					</button>
					<router-link
						:to="{
							name: 'Form',
							params: { doctype: 'Auto Email Report', name: 'new' },
							query: { report: name },
						}"
						class="menu-item"
						>Email this regularly</router-link
					>
					<a :href="`/app/query-report/${encodeURIComponent(name)}`" class="menu-item"
						>Open in classic desk</a
					>
				</div>
			</div>
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

		<section
			v-if="chart && !chartHidden && report.rows.length"
			aria-label="Chart"
			class="rounded-xl border border-line bg-surf px-5 py-4"
		>
			<ReportChart :chart="chart" :title="`${name} chart`" />
		</section>

		<form
			v-if="saveAsOpen"
			class="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surf px-4 py-3"
			@submit.prevent="saveAs"
		>
			<label for="save-as-name" class="text-[13px] font-semibold text-ink-2"
				>Save these filters and columns as</label
			>
			<input
				id="save-as-name"
				v-model="saveAsName"
				type="text"
				placeholder="Report name"
				class="h-9 min-w-[240px] flex-grow rounded-lg border border-line bg-paper px-2.5 text-[13.5px]"
			/>
			<button type="submit" class="btn-ink" :disabled="!saveAsName.trim()">Save</button>
			<button type="button" class="btn-ghost" @click="saveAsOpen = false">Cancel</button>
		</form>
		<p
			v-if="notice"
			role="status"
			class="rounded-lg bg-acc-tint px-4 py-2.5 text-[13.5px] text-ink"
		>
			{{ notice }}
		</p>

		<div class="overflow-auto rounded-xl border border-line bg-surf">
			<table class="w-full border-collapse text-[13px]">
				<thead class="sticky top-0 bg-paper">
					<tr>
						<th
							v-for="c in shownColumns"
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
							v-for="c in shownColumns"
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
import { computed, onMounted, reactive, ref, watch } from "vue";
import { call } from "frappe-ui";
import Icon from "@/components/Icon.vue";
import Field from "@/components/fields/Field.vue";
import CompatDialogs from "@/components/CompatDialogs.vue";
import ColumnPicker from "@/components/list/ColumnPicker.vue";
import ReportChart from "@/components/charts/ReportChart.vue";
import { useRouter } from "vue-router";
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

const router = useRouter();
const menu = ref(false);
const chart = ref(null);
const chartHidden = ref(false);
const shownNames = ref(null); // the user's column choice for this report; null shows all
const saveAsOpen = ref(false);
const saveAsName = ref("");
const notice = ref("");
const shownColumns = computed(() =>
	shownNames.value
		? report.columns.filter((c) => shownNames.value.includes(c.fieldname))
		: report.columns,
);

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
		chart.value = chartFor(res, rows);
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

// The report's own chart, or the one its script builds from the data, as the desk does.
function chartFor(res, rows) {
	let c = res?.chart;
	if ((!c || !c.data) && typeof report.settings?.get_chart_data === "function") {
		try {
			c = report.settings.get_chart_data(res.columns, res.result);
		} catch {
			c = null;
		}
	}
	return c?.data?.labels?.length && rows.length ? c : null;
}

// ---- columns, kept in the user's settings for this report ----
let savedColumns = null;
async function loadColumnChoice() {
	try {
		const raw = await call("frappe.model.utils.user_settings.get", { doctype: props.name });
		const saved = (typeof raw === "string" ? JSON.parse(raw || "{}") : raw || {})
			.briskrew_columns;
		shownNames.value = Array.isArray(saved) && saved.length ? saved : null;
	} catch {
		shownNames.value = null;
	}
	savedColumns = JSON.stringify(shownNames.value);
}
watch(shownNames, (cols) => {
	if (savedColumns === null || JSON.stringify(cols) === savedColumns) return;
	savedColumns = JSON.stringify(cols);
	call("frappe.model.utils.user_settings.save", {
		doctype: props.name,
		user_settings: JSON.stringify({ briskrew_columns: cols }),
	}).catch(() => {});
});

// ---- print and PDF: a plain table of what's on screen, with the filters used ----
const esc = (t) =>
	String(t ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
const plain = (html) =>
	new DOMParser().parseFromString(String(html ?? ""), "text/html").body.textContent;
function printableHtml() {
	const filters = report.filters
		.filter((f) => !["", null, undefined].includes(report.values[f.fieldname]))
		.map((f) => `${esc(f.label)}: <b>${esc(report.values[f.fieldname])}</b>`)
		.join(" &nbsp;·&nbsp; ");
	const head = shownColumns.value
		.map((c) => `<th style="text-align:${isNum(c) ? "right" : "left"}">${esc(c.label)}</th>`)
		.join("");
	const body = report.rows
		.map(
			(r) =>
				`<tr${r.__total ? ' style="font-weight:700"' : ""}>${shownColumns.value
					.map(
						(c) =>
							`<td style="text-align:${isNum(c) ? "right" : "left"}">${esc(
								plain(cell(r, c)),
							)}</td>`,
					)
					.join("")}</tr>`,
		)
		.join("");
	return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(props.name)}</title>
<style>body{font-family:Geist,Inter,Arial,sans-serif;font-size:11px;color:#0B1020;margin:24px}
h1{font-size:18px;margin:0 0 4px}p{color:#4A5068;margin:0 0 14px}
table{width:100%;border-collapse:collapse}th,td{padding:4px 6px;border-bottom:1px solid #E6E8F0}
th{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#6B7083}</style></head>
<body><h1>${esc(props.name)}</h1><p>${filters}</p><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
}
function printReport() {
	const w = window.open("", "_blank");
	if (!w) {
		report.error = "Allow pop-ups for this site to print.";
		return;
	}
	w.document.write(printableHtml());
	w.document.close();
	w.focus();
	setTimeout(() => w.print(), 300);
}
async function pdfReport() {
	try {
		const res = await fetch("/api/method/frappe.utils.print_format.report_to_pdf", {
			method: "POST",
			headers: { "X-Frappe-CSRF-Token": window.csrf_token || "" },
			body: new URLSearchParams({ html: printableHtml(), orientation: "Landscape" }),
		});
		if (!res.ok) throw new Error("Couldn't make the PDF.");
		const blob = await res.blob();
		const a = document.createElement("a");
		a.href = URL.createObjectURL(blob);
		a.download = `${props.name}.pdf`;
		a.click();
		setTimeout(() => URL.revokeObjectURL(a.href), 1000);
	} catch (e) {
		report.error = messageOf(e, "Couldn't make the PDF.");
	}
}

// ---- save as a custom report (the desk's "Save As") ----
async function saveAs() {
	try {
		const saved = await call("frappe.desk.query_report.save_report", {
			reference_report: report.reference || props.name,
			report_name: saveAsName.value.trim(),
			columns: JSON.stringify(
				shownColumns.value.map(({ fieldname, label, fieldtype, options, width }) => ({
					fieldname,
					label,
					fieldtype,
					options,
					width,
				})),
			),
			filters: JSON.stringify(report.values),
		});
		saveAsOpen.value = false;
		saveAsName.value = "";
		router.push({ name: "Report", params: { name: saved } });
	} catch (e) {
		report.error = messageOf(e, "Couldn't save the report.");
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
		await Promise.all([attachReportScript(report), loadColumnChoice()]);
		await run();
	} catch (e) {
		report.error = messageOf(e, `Couldn't open ${props.name}.`);
	}
});
</script>

<style scoped>
.menu-item {
	@apply block w-full px-3 py-1.5 text-left text-[13.5px] hover:bg-acc-tint disabled:opacity-40;
}
</style>
