<template>
	<span v-if="empty" class="text-mut">—</span>
	<router-link
		v-else-if="field.fieldtype === 'Link' && field.options"
		:to="{ name: 'Form', params: { doctype: field.options, name: String(value) } }"
		class="font-medium text-acc hover:text-acc-hover"
		@click.stop
	>
		{{ value }}
	</router-link>
	<span v-else-if="field.fieldtype === 'Check'" :class="value ? 'text-pos' : 'text-mut'">{{
		value ? "Yes" : "No"
	}}</span>
	<span v-else-if="numeric" class="tabular-nums">{{ formatted }}</span>
	<span
		v-else-if="field.fieldtype === 'Text Editor' || field.fieldtype === 'HTML Editor'"
		class="whitespace-pre-line"
		>{{ stripped }}</span
	>
	<span v-else class="whitespace-pre-line">{{ formatted }}</span>
</template>

<script setup>
import { computed } from "vue";
import dayjs from "dayjs";

const props = defineProps({
	field: { type: Object, required: true },
	value: { default: null },
});

const empty = computed(
	() => props.value === null || props.value === undefined || props.value === "",
);
const numeric = computed(() =>
	["Currency", "Float", "Int", "Percent"].includes(props.field.fieldtype),
);

const formatted = computed(() => {
	const v = props.value;
	switch (props.field.fieldtype) {
		case "Currency":
			return Number(v).toLocaleString(undefined, {
				minimumFractionDigits: 2,
				maximumFractionDigits: 2,
			});
		case "Float":
			// 1 rather than 1.00; keeps real decimals (0.5 days, 7.25 hours).
			return Number(v).toLocaleString(undefined, {
				maximumFractionDigits: Number(props.field.precision) || 3,
			});
		case "Percent":
			return `${Number(v)}%`;
		case "Date":
			return dayjs(v).format("D MMM YYYY");
		case "Datetime":
			return dayjs(v).format("D MMM YYYY, HH:mm");
		case "Time":
			// "12:49:32.401331" -> "12:49:32"
			return String(v).split(".")[0];
		default:
			return v;
	}
});

const stripped = computed(
	() => new DOMParser().parseFromString(String(props.value), "text/html").body.textContent,
);
</script>
