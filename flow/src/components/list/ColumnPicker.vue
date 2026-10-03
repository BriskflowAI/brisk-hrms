<template>
	<Dropdown :label="__('Columns')" icon="columns" align="right" width="w-[260px]">
		<div class="kicker px-3 pb-1 pt-1.5">{{ __("Show in the list") }}</div>
		<label
			v-for="f in fields"
			:key="f.fieldname"
			class="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-[13.5px] hover:bg-acc-tint"
		>
			<input
				type="checkbox"
				class="rounded border-line text-acc focus:ring-acc"
				:checked="current.includes(f.fieldname)"
				@change="toggle(f.fieldname)"
			/>
			<span class="truncate">{{ f.label }}</span>
		</label>
		<button
			v-if="modelValue"
			type="button"
			class="mt-1 block w-full border-t border-line-2 px-3 py-2 text-left text-[12.5px] font-semibold text-mut hover:text-ink"
			@click="$emit('update:modelValue', null)"
		>
			{{ __("Reset to the default columns") }}
		</button>
	</Dropdown>
</template>

<script setup>
import { computed } from "vue";
import Dropdown from "./Dropdown.vue";

const props = defineProps({
	fields: { type: Array, required: true },
	defaults: { type: Array, required: true }, // fieldnames shown when nothing is chosen
	modelValue: { type: Array, default: null },
});
const emit = defineEmits(["update:modelValue"]);

const current = computed(() => props.modelValue || props.defaults);

function toggle(fieldname) {
	const next = current.value.includes(fieldname)
		? current.value.filter((f) => f !== fieldname)
		: [...current.value, fieldname];
	emit("update:modelValue", next);
}
</script>
