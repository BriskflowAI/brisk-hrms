<template>
	<!-- Counts per value, like the desk's list sidebar; picking one filters the list. -->
	<Dropdown :label="__('Group by')" icon="chart" width="w-[300px]">
		<template #default="{ close }">
			<template v-if="!field">
				<div class="kicker px-3 pb-1 pt-1.5">{{ __("Count by") }}</div>
				<button
					v-for="o in options"
					:key="o.fieldname"
					type="button"
					class="block w-full px-3 py-1.5 text-left text-[13.5px] hover:bg-acc-tint"
					@click="pick(o)"
				>
					{{ o.label }}
				</button>
			</template>
			<template v-else>
				<button
					type="button"
					class="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-[12.5px] font-semibold text-mut hover:text-ink"
					@click="field = null"
				>
					← {{ field.label }}
				</button>
				<div v-if="loading" class="px-3 py-2 text-[13px] text-mut">
					{{ __("Counting…") }}
				</div>
				<div v-else-if="error" class="px-3 py-2 text-[13px] text-neg">{{ error }}</div>
				<div v-else-if="!counts.length" class="px-3 py-2 text-[13px] text-mut">
					{{ __("Nothing to count.") }}
				</div>
				<button
					v-for="c in counts"
					:key="c.name ?? '∅'"
					type="button"
					class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13.5px] hover:bg-acc-tint"
					@click="(choose(c), close())"
				>
					<span class="min-w-0 flex-grow truncate">{{
						c.title || c.name || "Not set"
					}}</span>
					<span class="tabular-nums text-mut">{{ c.count }}</span>
				</button>
			</template>
		</template>
	</Dropdown>
</template>

<script setup>
import { call } from "frappe-ui";
import { ref } from "vue";
import Dropdown from "./Dropdown.vue";
import { messageOf } from "@/engine/form";

const props = defineProps({
	doctype: { type: String, required: true },
	options: { type: Array, required: true }, // [{ fieldname, label }]
	filters: { type: Function, required: true }, // current server filters
});
const emit = defineEmits(["filter"]);

const field = ref(null);
const counts = ref([]);
const loading = ref(false);
const error = ref("");

async function pick(o) {
	field.value = o;
	loading.value = true;
	error.value = "";
	try {
		const rows = await call("frappe.desk.listview.get_group_by_count", {
			doctype: props.doctype,
			current_filters: JSON.stringify(props.filters()),
			field: o.fieldname,
		});
		counts.value = rows || [];
	} catch (e) {
		error.value = messageOf(e, "Couldn't count these.");
	} finally {
		loading.value = false;
	}
}

function choose(c) {
	const f = field.value;
	field.value = null;
	if (f.fieldname === "assigned_to")
		emit("filter", { field: "_assign", op: "like", value: `%${c.name}%` });
	else if (c.name === null || c.name === "")
		emit("filter", { field: f.fieldname, op: "is not set", value: "" });
	else emit("filter", { field: f.fieldname, op: "=", value: c.name });
}
</script>
