<template>
	<li role="treeitem" :aria-expanded="node.expandable ? open : undefined">
		<div
			class="group flex h-9 items-center gap-1.5 pr-3 text-[13.5px] hover:bg-paper"
			:style="{ paddingLeft: `${12 + depth * 22}px` }"
		>
			<button
				v-if="node.expandable"
				type="button"
				class="flex h-6 w-6 items-center justify-center rounded text-mut hover:bg-line-2 hover:text-ink"
				:aria-label="open ? `Collapse ${label}` : `Expand ${label}`"
				@click="toggle"
			>
				<Icon name="chev" :size="14" :class="open ? '' : '-rotate-90'" />
			</button>
			<span v-else class="w-6" />
			<Icon
				:name="node.expandable ? 'folder' : 'file'"
				:size="15"
				class="shrink-0"
				:class="node.expandable ? 'text-acc' : 'text-mut'"
			/>
			<router-link
				v-if="!node.isRoot && node.value"
				:to="{ name: 'Form', params: { doctype, name: node.value } }"
				class="truncate font-medium hover:text-acc"
				>{{ label }}</router-link
			>
			<span v-else class="truncate font-semibold">{{ label }}</span>
			<span v-if="loading" class="text-[12px] text-mut">{{ __("Loading…") }}</span>
			<router-link
				v-if="canCreate && node.expandable && (node.value || node.isRoot)"
				:to="{
					name: 'Form',
					params: { doctype, name: 'new' },
					query: node.value ? { [parentField]: node.value } : {},
				}"
				class="ml-auto hidden text-[12.5px] font-semibold text-acc group-hover:inline group-focus-within:inline"
				>{{ __("+ Add child") }}</router-link
			>
		</div>
		<ul v-if="open && kids.length" role="group">
			<TreeNode
				v-for="k in kids"
				:key="k.value"
				:node="k"
				:depth="depth + 1"
				:doctype="doctype"
				:load="load"
				:can-create="canCreate"
				:parent-field="parentField"
				:expand-signal="expandSignal ?? node.expandAll"
			/>
		</ul>
		<div
			v-else-if="open && !loading && !kids.length"
			class="py-1 text-[12.5px] text-mut"
			:style="{ paddingLeft: `${46 + (depth + 1) * 22}px` }"
		>
			{{ " " }}{{ __("Nothing under") }} {{ label }}
		</div>
	</li>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import Icon from "@/components/Icon.vue";

const props = defineProps({
	node: { type: Object, required: true }, // { value, title?, expandable, isRoot? }
	depth: { type: Number, default: 0 },
	doctype: { type: String, required: true },
	load: { type: Function, required: true },
	canCreate: { type: Boolean, default: false },
	parentField: { type: String, default: "" },
	expandSignal: { type: Number, default: null },
});

const open = ref(false);
const loading = ref(false);
const kids = ref([]);
const label = computed(() => props.node.label || props.node.title || props.node.value);

async function fetchKids() {
	loading.value = true;
	kids.value = (await props.load(props.node.value, !!props.node.isRoot)).map((k) => ({
		...k,
		expandable: !!Number(k.expandable),
	}));
	loading.value = false;
}

async function toggle() {
	open.value = !open.value;
	if (open.value) await fetchKids();
}

// The root reopens whenever the tree is reset (filters changed).
watch(
	() => props.node.version,
	async () => {
		if (!props.node.isRoot) return;
		open.value = true;
		await fetchKids();
	},
	{ immediate: true },
);
watch(
	() => props.expandSignal ?? props.node.expandAll,
	async (v) => {
		if (!v || !props.node.expandable) return;
		open.value = true;
		await fetchKids();
	},
	{ immediate: true },
);
</script>
