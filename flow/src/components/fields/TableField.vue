<template>
	<div class="overflow-hidden rounded-lg border border-line">
		<table class="w-full border-collapse text-[13px]">
			<thead class="bg-paper">
				<tr>
					<th class="w-10 px-2.5 py-2 text-left font-semibold text-mut">#</th>
					<th
						v-for="c in columns"
						:key="c.fieldname"
						class="px-2.5 py-2 text-left font-semibold text-mut"
						:class="num(c) && 'text-right'"
					>
						{{ c.label }}<span v-if="form.required(c)" class="text-neg">*</span>
					</th>
					<th class="w-20" />
				</tr>
			</thead>
			<tbody>
				<template v-for="(row, i) in rows" :key="row.name">
					<tr
						class="border-t border-line-2"
						:class="open === row.name ? 'bg-acc-tint/40' : 'hover:bg-paper'"
					>
						<td class="px-2.5 py-2 tabular-nums text-mut">{{ row.idx }}</td>
						<td
							v-for="c in columns"
							:key="c.fieldname"
							class="max-w-[220px] truncate px-2.5 py-2"
							:class="num(c) && 'text-right'"
						>
							<FieldValue :field="c" :value="row[c.fieldname]" />
						</td>
						<td class="whitespace-nowrap px-1.5 py-1 text-right">
							<button
								type="button"
								class="rounded px-1.5 py-1 text-[12px] font-semibold text-acc hover:bg-surf"
								@click="toggle(row)"
							>
								{{ open === row.name ? "Done" : editable ? "Edit" : "View" }}
							</button>
							<button
								v-if="editable && !df.cannot_delete_rows"
								type="button"
								:aria-label="`Delete row ${row.idx}`"
								class="rounded px-1.5 py-1 text-[12px] text-mut hover:text-neg"
								@click="form.removeRow(df.fieldname, row)"
							>
								✕
							</button>
						</td>
					</tr>
					<tr v-if="open === row.name">
						<td
							:colspan="columns.length + 2"
							class="border-t border-line-2 bg-surf px-4 py-3"
						>
							<div class="grid grid-cols-2 gap-x-8 gap-y-1">
								<template v-for="c in rowFields" :key="c.fieldname">
									<div
										v-if="
											form.visible(form.df(c.fieldname, df.fieldname), row)
										"
										:class="c.fieldtype === 'Table' && 'col-span-2'"
									>
										<Field
											:form="form"
											:df="form.df(c.fieldname, df.fieldname)"
											:row="row"
										/>
									</div>
								</template>
							</div>
							<div v-if="editable" class="mt-2 flex gap-2">
								<button
									v-if="i > 0"
									type="button"
									class="text-[12.5px] text-mut hover:text-ink"
									@click="moveRow(i, -1)"
								>
									{{ __("Move up") }}
								</button>
								<button
									v-if="i < rows.length - 1"
									type="button"
									class="text-[12.5px] text-mut hover:text-ink"
									@click="moveRow(i, 1)"
								>
									{{ __("Move down") }}
								</button>
							</div>
						</td>
					</tr>
				</template>
				<tr v-if="!rows.length">
					<td :colspan="columns.length + 2" class="px-3 py-4 text-center text-mut">
						{{ __("No rows yet") }}
					</td>
				</tr>
			</tbody>
		</table>
		<div
			v-if="editable && !df.cannot_add_rows"
			class="border-t border-line-2 bg-paper px-2.5 py-1.5"
		>
			<button
				type="button"
				class="text-[13px] font-semibold text-acc hover:text-acc-hover"
				@click="add"
			>
				{{ __("+ Add row") }}
			</button>
		</div>
	</div>
</template>

<script setup>
import { computed, defineAsyncComponent, ref } from "vue";
import FieldValue from "@/components/FieldValue.vue";
import { isLayout } from "@/composables/api";

// Field renders TableField, so load it lazily to avoid a circular import.
const Field = defineAsyncComponent(() => import("./Field.vue"));

const props = defineProps({
	form: { type: Object, required: true },
	df: { type: Object, required: true },
});

const open = ref(null);
const rows = computed(() => props.form.doc?.[props.df.fieldname] || []);
const childFields = computed(() => props.form.fieldsOf(props.df.options));
const rowFields = computed(() => childFields.value.filter((c) => !isLayout(c)));
const columns = computed(() => {
	const listed = rowFields.value.filter((c) => c.in_list_view && !c.hidden);
	return (listed.length ? listed : rowFields.value.filter((c) => !c.hidden)).slice(0, 6);
});
const editable = computed(() => !props.form.readOnly(props.df));
const num = (f) => ["Currency", "Float", "Int", "Percent"].includes(f.fieldtype);

function toggle(row) {
	open.value = open.value === row.name ? null : row.name;
}
async function add() {
	const row = await props.form.addRow(props.df.fieldname);
	open.value = row.name;
}
function moveRow(i, step) {
	const list = props.form.doc[props.df.fieldname];
	const [r] = list.splice(i, 1);
	list.splice(i + step, 0, r);
	list.forEach((x, n) => (x.idx = n + 1));
	props.form.dirty = true;
}
</script>
