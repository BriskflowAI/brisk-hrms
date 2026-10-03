<template>
	<section :aria-label="__('Tree')" class="rounded-xl border border-line bg-surf">
		<div
			v-if="filters.length"
			class="flex flex-wrap items-end gap-3 border-b border-line-2 px-4 py-3"
		>
			<label v-for="f in filters" :key="f.fieldname" class="flex flex-col gap-1">
				<span class="text-[12px] font-semibold text-ink-2">{{ f.label }}</span>
				<select v-if="f.fieldtype === 'Select'" v-model="args[f.fieldname]" :class="cls">
					<option v-for="o in optionsOf(f)" :key="o" :value="o">{{ o }}</option>
				</select>
				<LinkInput
					v-else-if="f.fieldtype === 'Link'"
					v-model="args[f.fieldname]"
					:doctype="f.options"
					:label="f.label"
					:input-class="cls"
					class="w-[220px]"
				/>
				<input v-else v-model="args[f.fieldname]" type="text" :class="cls" />
			</label>
			<label v-if="hasDisabled" class="flex items-center gap-2 pb-2 text-[13px] text-ink-2">
				<input
					v-model="includeDisabled"
					type="checkbox"
					class="rounded border-line text-acc"
				/>
				{{ __("Show disabled") }}{{ " " }}
			</label>
			<button type="button" class="btn-ghost ml-auto h-9" @click="expandAll">
				{{ __("Expand all") }}
			</button>
		</div>
		<p v-if="error" role="alert" class="bg-neg-tint px-4 py-2 text-[13px] text-neg">
			{{ error }}
		</p>
		<ul role="tree" :aria-label="`${doctype} tree`" class="py-2">
			<TreeNode
				:node="root"
				:depth="0"
				:doctype="doctype"
				:load="children"
				:can-create="canCreate"
				:parent-field="parentField"
			/>
		</ul>
	</section>
</template>

<script setup>
import { call } from "frappe-ui";
import { computed, reactive, ref, watch } from "vue";
import LinkInput from "@/components/fields/LinkInput.vue";
import TreeNode from "./TreeNode.vue";
import { messageOf } from "@/engine/form";

const props = defineProps({
	doctype: { type: String, required: true },
	meta: { type: Object, required: true },
	settings: { type: Object, required: true }, // frappe.treeview_settings[doctype]
	canCreate: { type: Boolean, default: false },
});

const cls =
	"h-9 rounded-lg border border-line bg-paper px-2.5 py-0 text-[13.5px] focus:border-acc focus:ring-1 focus:ring-acc";
const method = computed(
	() => props.settings.get_tree_nodes || "frappe.desk.treeview.get_children",
);
const filters = computed(() => props.settings.filters || []);
const hasDisabled = computed(() => props.meta.fields.some((f) => f.fieldname === "disabled"));
const parentField = computed(
	() =>
		props.meta.nsm_parent_field || `parent_${props.doctype.toLowerCase().replace(/ /g, "_")}`,
);
const includeDisabled = ref(false);
const error = ref("");
const args = reactive({});
for (const f of filters.value) {
	const d = typeof f.default === "function" ? f.default() : f.default;
	args[f.fieldname] = d ?? (f.fieldtype === "Select" ? optionsOf(f)[0] : "");
}

const root = reactive({ value: null, label: props.doctype, expandable: true, isRoot: true });

function optionsOf(f) {
	const o = f.options;
	return (Array.isArray(o) ? o : String(o || "").split("\n")).filter(Boolean);
}

// Flags go only when set, as text, the way the desk sends them: tree methods type them differently.
const baseArgs = () => ({
	doctype: props.doctype,
	...Object.fromEntries(Object.entries(args).filter(([, v]) => v !== "" && v != null)),
	...(includeDisabled.value ? { include_disabled: "1" } : {}),
});

async function children(value, isRoot = false) {
	try {
		return (
			(await call(method.value, {
				...baseArgs(),
				parent: value ?? "",
				...(isRoot ? { is_root: true } : {}),
			})) || []
		);
	} catch (e) {
		error.value = messageOf(e, "Couldn't load this part of the tree.");
		return [];
	}
}

// Like the desk: when the tree has a single top node, that node is the root.
async function setRoot() {
	error.value = "";
	const label = filters.value.map((f) => args[f.fieldname]).find(Boolean);
	root.value = null;
	root.label = label || props.settings.root_label || props.doctype;
	if (props.settings.get_tree_root !== false) {
		const top = await children(undefined);
		if (top.length === 1) {
			root.value = top[0].value;
			root.label = top[0].title || top[0].value;
		} else root.value = "";
	}
	root.version = (root.version || 0) + 1;
}

function expandAll() {
	root.expandAll = (root.expandAll || 0) + 1;
}

watch([() => JSON.stringify(args), includeDisabled], setRoot, { immediate: true });
</script>
