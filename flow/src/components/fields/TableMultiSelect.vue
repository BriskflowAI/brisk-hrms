<template>
	<div class="flex flex-col gap-2">
		<div v-if="rows.length" class="flex flex-wrap gap-1.5">
			<span v-for="row in rows" :key="row.name" class="chip gap-1.5 bg-acc-tint text-acc">
				{{ row[linkField?.fieldname] }}
				<button
					v-if="editable"
					type="button"
					:aria-label="`Remove ${row[linkField?.fieldname]}`"
					class="hover:text-neg"
					@click="form.removeRow(df.fieldname, row)"
				>
					✕
				</button>
			</span>
		</div>
		<LinkInput
			v-if="editable && linkField"
			:model-value="null"
			:doctype="linkField.options"
			:get-query="() => form.linkQuery(df)"
			:label="`Add ${df.label}`"
			:placeholder="`Add ${linkField.options}…`"
			input-class="w-full rounded-lg border border-line bg-paper px-2.5 py-1.5 text-[14px] focus:border-acc focus:ring-1 focus:ring-acc"
			@update:model-value="add"
		/>
	</div>
</template>

<script setup>
import { computed } from "vue";
import LinkInput from "./LinkInput.vue";

const props = defineProps({
	form: { type: Object, required: true },
	df: { type: Object, required: true },
});

const rows = computed(() => props.form.doc?.[props.df.fieldname] || []);
const linkField = computed(() =>
	props.form.fieldsOf(props.df.options).find((f) => f.fieldtype === "Link"),
);
const editable = computed(() => !props.form.readOnly(props.df));

function add(value) {
	if (!value || rows.value.some((r) => r[linkField.value.fieldname] === value)) return;
	props.form.addRow(props.df.fieldname, { [linkField.value.fieldname]: value });
}
</script>
