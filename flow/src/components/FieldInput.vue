<template>
	<select v-if="field.fieldtype === 'Select'" v-model="model" :class="cls">
		<option v-for="o in options" :key="o" :value="o">{{ o || "—" }}</option>
	</select>
	<input
		v-else-if="field.fieldtype === 'Check'"
		v-model="checked"
		type="checkbox"
		class="h-4 w-4 rounded border-line text-acc focus:ring-acc"
	/>
	<textarea
		v-else-if="['Small Text', 'Text', 'Long Text'].includes(field.fieldtype)"
		v-model="model"
		rows="3"
		:class="cls"
	/>
	<input v-else v-model="model" :type="inputType" :step="step" :class="cls" />
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({ field: { type: Object, required: true } });
const model = defineModel({ default: null });

const cls =
	"w-full rounded-lg border border-line bg-paper px-2.5 py-1.5 text-[14px] text-ink focus:border-acc focus:ring-1 focus:ring-acc";
const options = computed(() => (props.field.options || "").split("\n"));
const inputType = computed(
	() =>
		({ Int: "number", Float: "number", Currency: "number", Percent: "number", Date: "date" })[
			props.field.fieldtype
		] || "text",
);
const step = computed(() =>
	props.field.fieldtype === "Int"
		? "1"
		: ["Float", "Currency", "Percent"].includes(props.field.fieldtype)
		  ? "any"
		  : undefined,
);
const checked = computed({ get: () => !!model.value, set: (v) => (model.value = v ? 1 : 0) });
</script>
