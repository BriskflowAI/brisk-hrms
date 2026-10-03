<template>
	<!-- Layout-ish types that render content, not an input -->
	<LiveElement
		v-if="df.fieldtype === 'HTML' && df.__el"
		:el="df.__el"
		class="desk-html min-w-0 text-[14px]"
	/>
	<div
		v-else-if="df.fieldtype === 'HTML'"
		class="desk-html min-w-0 text-[14px]"
		v-html="df.__html ?? df.options ?? ''"
	/>
	<h3 v-else-if="df.fieldtype === 'Heading'" class="text-[16px]">{{ df.label }}</h3>
	<div v-else-if="df.fieldtype === 'Button'">
		<button
			type="button"
			class="btn-ghost"
			:disabled="form.busy"
			@click="form.trigger('button', df.fieldname, row)"
		>
			{{ df.label }}
		</button>
	</div>

	<!-- Tables span the full width -->
	<div v-else-if="df.fieldtype === 'Table'" class="flex flex-col gap-2">
		<div class="text-[13px] font-semibold text-ink-2">
			{{ df.label }}<span v-if="required" class="text-neg" aria-label="required">*</span>
		</div>
		<TableField :form="form" :df="df" />
	</div>

	<div v-else class="grid grid-cols-[minmax(120px,38%)_minmax(0,1fr)] items-start gap-3">
		<label :for="id" class="pt-1.5 text-[13px] text-mut">
			{{ df.label }}<span v-if="required" class="text-neg" aria-label="required">*</span>
			<span
				v-if="df.description"
				class="mt-0.5 block text-[11.5px] leading-snug text-mut/80"
				v-html="df.description"
			/>
		</label>

		<div class="min-w-0">
			<!-- Read-only display -->
			<div v-if="readOnly" class="min-h-[32px] break-words pt-1.5 text-[14px]">
				<template v-if="df.fieldtype === 'Geolocation'">
					<a
						v-if="coords"
						:href="`https://www.openstreetmap.org/?mlat=${coords[1]}&mlon=${coords[0]}`"
						target="_blank"
						rel="noopener"
						class="font-semibold text-acc"
					>
						{{ coords[1].toFixed(5) }}, {{ coords[0].toFixed(5) }}
					</a>
					<span v-else class="text-mut">—</span>
				</template>
				<a
					v-else-if="isAttach && value"
					:href="value"
					target="_blank"
					rel="noopener"
					class="font-semibold text-acc"
					>{{ fileName }}</a
				>
				<span
					v-else-if="df.fieldtype === 'Rating'"
					:aria-label="`${stars} of 5`"
					class="text-[16px] tracking-wider text-warn"
				>
					{{ "★".repeat(stars)
					}}<span class="text-line">{{ "★".repeat(5 - stars) }}</span>
				</span>
				<span
					v-else-if="df.fieldtype === 'Color' && value"
					class="inline-flex items-center gap-2"
				>
					<span
						class="h-4 w-4 rounded border border-line"
						:style="{ background: value }"
					/>{{ value }}
				</span>
				<FieldValue v-else :field="df" :value="value" />
			</div>

			<!-- Editable controls -->
			<LinkInput
				v-else-if="df.fieldtype === 'Link' || df.fieldtype === 'Dynamic Link'"
				:input-id="id"
				:model-value="value"
				:doctype="linkDoctype"
				:get-query="() => form.linkQuery(df, row)"
				:reference-doctype="form.doctype"
				:label="df.label"
				:required="required"
				:input-class="cls"
				@update:model-value="set"
			/>
			<template v-else-if="df.fieldtype === 'Autocomplete'">
				<input
					:id="id"
					:list="`${id}-options`"
					:value="value ?? ''"
					:class="cls"
					autocomplete="off"
					@change="set($event.target.value || null)"
				/>
				<datalist :id="`${id}-options`">
					<option v-for="o in options.filter(Boolean)" :key="o" :value="o" />
				</datalist>
			</template>
			<select
				v-else-if="df.fieldtype === 'Select'"
				:id="id"
				:value="value ?? ''"
				:class="cls"
				@change="set($event.target.value)"
			>
				<option v-for="o in options" :key="o" :value="o">{{ o || "—" }}</option>
			</select>
			<label
				v-else-if="df.fieldtype === 'Check'"
				class="inline-flex min-h-[32px] items-center gap-2"
			>
				<input
					:id="id"
					type="checkbox"
					:checked="!!value"
					class="h-4 w-4 rounded border-line text-acc focus:ring-acc"
					@change="set($event.target.checked ? 1 : 0)"
				/>
				<span class="text-[13px] text-ink-2">{{ value ? "Yes" : "No" }}</span>
			</label>
			<textarea
				v-else-if="
					[
						'Small Text',
						'Text',
						'Long Text',
						'Code',
						'JSON',
						'Markdown Editor',
					].includes(df.fieldtype)
				"
				:id="id"
				:value="value ?? ''"
				:rows="df.fieldtype === 'Small Text' ? 2 : 5"
				:class="[
					cls,
					df.fieldtype === 'Code' || df.fieldtype === 'JSON'
						? 'font-mono text-[13px]'
						: '',
				]"
				@change="set($event.target.value)"
			/>
			<TextEditor
				v-else-if="df.fieldtype === 'Text Editor' || df.fieldtype === 'HTML Editor'"
				:content="value || ''"
				editor-class="prose-sm min-h-[110px] max-w-none rounded-lg border border-line bg-paper px-3 py-2 focus-within:border-acc"
				:editable="true"
				@change="set"
			/>
			<div v-else-if="isAttach" class="flex flex-wrap items-center gap-2">
				<a
					v-if="value"
					:href="value"
					target="_blank"
					rel="noopener"
					class="max-w-full truncate text-[13.5px] font-semibold text-acc"
					>{{ fileName }}</a
				>
				<img
					v-if="value && df.fieldtype === 'Attach Image'"
					:src="value"
					alt=""
					class="h-16 w-16 rounded-lg border border-line object-cover"
				/>
				<label
					class="btn-ghost h-8 cursor-pointer px-3 text-[13px]"
					:class="form.isNew && 'pointer-events-none opacity-50'"
				>
					{{ value ? "Replace" : "Upload" }}
					<input
						type="file"
						class="sr-only"
						:accept="df.fieldtype === 'Attach Image' ? 'image/*' : undefined"
						:disabled="form.isNew"
						@change="upload"
					/>
				</label>
				<button
					v-if="value"
					type="button"
					class="text-[12.5px] text-mut hover:text-neg"
					@click="set(null)"
				>
					Remove
				</button>
				<span v-if="form.isNew" class="text-[12px] text-mut"
					>Save first to attach files</span
				>
			</div>
			<div
				v-else-if="df.fieldtype === 'Rating'"
				class="flex min-h-[32px] items-center gap-0.5"
				role="radiogroup"
				:aria-label="df.label"
			>
				<button
					v-for="n in 5"
					:key="n"
					type="button"
					role="radio"
					:aria-checked="stars === n"
					:aria-label="`${n} star${n > 1 ? 's' : ''}`"
					class="text-[20px] leading-none"
					:class="n <= stars ? 'text-warn' : 'text-line'"
					@click="set(stars === n ? 0 : n / 5)"
				>
					★
				</button>
			</div>
			<TableMultiSelect
				v-else-if="df.fieldtype === 'Table MultiSelect'"
				:form="form"
				:df="df"
			/>
			<div v-else-if="df.fieldtype === 'Duration'" class="flex items-center gap-2">
				<input
					:id="id"
					type="number"
					min="0"
					step="60"
					:value="value ?? ''"
					:class="cls"
					@change="set(num($event.target.value))"
				/>
				<span class="whitespace-nowrap text-[12.5px] text-mut">{{ durationText }}</span>
			</div>
			<input
				v-else
				:id="id"
				:type="inputType"
				:step="step"
				:value="inputValue"
				:class="cls"
				:autocomplete="df.fieldtype === 'Password' ? 'new-password' : 'off'"
				@change="onInput($event.target.value)"
			/>
		</div>
	</div>
</template>

<script setup>
import { computed } from "vue";
import { TextEditor } from "frappe-ui";
import FieldValue from "@/components/FieldValue.vue";
import LiveElement from "@/components/LiveElement.vue";
import LinkInput from "./LinkInput.vue";
import TableField from "./TableField.vue";
import TableMultiSelect from "./TableMultiSelect.vue";

const props = defineProps({
	form: { type: Object, required: true },
	df: { type: Object, required: true },
	row: { type: Object, default: null },
});

const cls =
	"w-full rounded-lg border border-line bg-paper px-2.5 py-1.5 text-[14px] text-ink focus:border-acc focus:ring-1 focus:ring-acc";
const target = computed(() => props.row || props.form.doc);
const value = computed(() => target.value?.[props.df.fieldname]);
const id = computed(() => `f-${props.row ? `${props.row.name}-` : ""}${props.df.fieldname}`);
const readOnly = computed(() => props.form.readOnly(props.df, props.row));
const required = computed(() => props.form.required(props.df, props.row));
const options = computed(() => {
	const opts = String(props.df.options || "").split("\n");
	return required.value ? opts.filter((o) => o !== "") : opts[0] === "" ? opts : ["", ...opts];
});
const linkDoctype = computed(() =>
	props.df.fieldtype === "Dynamic Link" ? target.value?.[props.df.options] : props.df.options,
);
const isAttach = computed(
	() => props.df.fieldtype === "Attach" || props.df.fieldtype === "Attach Image",
);
const fileName = computed(() =>
	decodeURIComponent(
		String(value.value || "")
			.split("/")
			.pop(),
	),
);
const stars = computed(() => Math.round(Number(value.value || 0) * 5));
const coords = computed(() => {
	try {
		const g = typeof value.value === "string" ? JSON.parse(value.value) : value.value;
		return g?.features?.[0]?.geometry?.coordinates || null;
	} catch {
		return null;
	}
});

const inputType = computed(() => {
	const t = props.df.fieldtype;
	if (["Int", "Float", "Currency", "Percent"].includes(t)) return "number";
	if (t === "Date") return "date";
	if (t === "Datetime") return "datetime-local";
	if (t === "Time") return "time";
	if (t === "Color") return "color";
	if (t === "Password") return "password";
	if (props.df.options === "Email") return "email";
	if (props.df.options === "Phone" || t === "Phone") return "tel";
	if (props.df.options === "URL") return "url";
	return "text";
});
const step = computed(() =>
	props.df.fieldtype === "Int"
		? "1"
		: ["Float", "Currency", "Percent"].includes(props.df.fieldtype)
		  ? "any"
		  : props.df.fieldtype === "Time"
		    ? "1"
		    : undefined,
);
const inputValue = computed(() => {
	const v = value.value;
	if (v === null || v === undefined) return "";
	if (props.df.fieldtype === "Datetime") return String(v).slice(0, 16).replace(" ", "T");
	return v;
});
const durationText = computed(() => {
	const s = Number(value.value || 0);
	const d = Math.floor(s / 86400);
	const h = Math.floor((s % 86400) / 3600);
	const m = Math.floor((s % 3600) / 60);
	return [d && `${d}d`, h && `${h}h`, m && `${m}m`].filter(Boolean).join(" ") || "0m";
});

const num = (v) => (v === "" ? null : Number(v));

function onInput(v) {
	const t = props.df.fieldtype;
	if (["Int"].includes(t)) return set(v === "" ? 0 : parseInt(v, 10));
	if (["Float", "Currency", "Percent"].includes(t)) return set(v === "" ? 0 : parseFloat(v));
	if (t === "Datetime") return set(v ? `${v.replace("T", " ")}:00`.slice(0, 19) : null);
	return set(v === "" ? null : v);
}

function set(v) {
	props.form.setValue(props.df.fieldname, v, props.row);
}

async function upload(e) {
	const file = e.target.files?.[0];
	if (!file) return;
	await props.form
		.upload(file, null, props.df.fieldtype === "Attach Image" ? 0 : 1)
		.then((res) => res?.file_url && set(res.file_url));
	e.target.value = "";
}
</script>
