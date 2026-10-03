<template>
	<div v-if="!rows.length" class="text-[13px] text-mut">No rows</div>
	<div v-else class="overflow-x-auto rounded-lg border border-line-2">
		<table class="w-full border-collapse text-[13px]">
			<thead>
				<tr class="bg-paper">
					<th class="w-10 px-2.5 py-2 text-left font-semibold text-mut">#</th>
					<th
						v-for="c in cols"
						:key="c.fieldname"
						class="px-2.5 py-2 text-left font-semibold text-mut"
						:class="num(c) && 'text-right'"
					>
						{{ c.label }}
					</th>
				</tr>
			</thead>
			<tbody>
				<tr v-for="r in rows" :key="r.name" class="border-t border-line-2">
					<td class="px-2.5 py-2 text-mut tabular-nums">{{ r.idx }}</td>
					<td
						v-for="c in cols"
						:key="c.fieldname"
						class="px-2.5 py-2"
						:class="num(c) && 'text-right'"
					>
						<FieldValue :field="c" :value="r[c.fieldname]" />
					</td>
				</tr>
			</tbody>
		</table>
	</div>
</template>

<script setup>
import { computed } from "vue";
import FieldValue from "./FieldValue.vue";
import { isLayout, isTable } from "@/composables/api";

const props = defineProps({
	field: { type: Object, required: true },
	rows: { type: Array, default: () => [] },
	meta: { type: Object, default: null },
});

const num = (f) => ["Currency", "Float", "Int", "Percent"].includes(f.fieldtype);
const cols = computed(() => {
	const fields = (props.meta?.fields || []).filter(
		(f) => !isLayout(f) && !isTable(f) && !f.hidden,
	);
	const listed = fields.filter((f) => f.in_list_view);
	return (listed.length ? listed : fields).slice(0, 6);
});
</script>
