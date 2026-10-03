<template>
	<div class="relative" @keydown.esc="open = false">
		<div class="relative">
			<input
				:id="inputId || undefined"
				ref="input"
				:value="open ? query : modelValue || ''"
				type="text"
				:aria-label="label"
				:placeholder="placeholder"
				role="combobox"
				:aria-expanded="open"
				autocomplete="off"
				:class="[inputClass, modelValue && doctype ? 'pr-9' : '']"
				@focus="onFocus"
				@input="onInput($event.target.value)"
				@keydown.down.prevent="move(1)"
				@keydown.up.prevent="move(-1)"
				@keydown.enter.prevent="pick(results[cursor])"
				@blur="onBlur"
			/>
			<router-link
				v-if="modelValue && doctype"
				:to="{ name: 'Form', params: { doctype, name: modelValue } }"
				:aria-label="`Open ${modelValue}`"
				class="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-mut hover:bg-side hover:text-acc"
				tabindex="-1"
			>
				<Icon name="ext" :size="14" />
			</router-link>
		</div>
		<ul
			v-if="open"
			role="listbox"
			class="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-lg border border-line bg-surf py-1 shadow-xl"
		>
			<li v-if="loading" class="px-3 py-2 text-[13px] text-mut">Searching…</li>
			<li v-else-if="!results.length" class="px-3 py-2 text-[13px] text-mut">
				No {{ doctype }} matches
			</li>
			<li
				v-for="(r, i) in results"
				:key="r.value"
				role="option"
				:aria-selected="i === cursor"
				class="cursor-pointer px-3 py-1.5"
				:class="i === cursor ? 'bg-acc-tint' : ''"
				@mousedown.prevent="pick(r)"
				@mouseenter="cursor = i"
			>
				<div class="text-[13.5px] font-semibold">{{ r.label || r.value }}</div>
				<div
					v-if="r.description && r.description !== r.value"
					class="truncate text-[12px] text-mut"
				>
					{{ strip(r.description) }}
				</div>
			</li>
			<li v-if="modelValue && !required" class="border-t border-line-2">
				<button
					type="button"
					class="w-full px-3 py-1.5 text-left text-[12.5px] text-mut hover:text-neg"
					@mousedown.prevent="clear"
				>
					Clear
				</button>
			</li>
		</ul>
	</div>
</template>

<script setup>
import { ref } from "vue";
import { call } from "frappe-ui";
import Icon from "@/components/Icon.vue";

const props = defineProps({
	modelValue: { default: null },
	inputId: { type: String, default: "" },
	doctype: { type: String, default: "" },
	getQuery: { type: Function, default: () => ({}) },
	referenceDoctype: { type: String, default: "" },
	label: { type: String, default: "" },
	placeholder: { type: String, default: "" },
	required: { type: Boolean, default: false },
	inputClass: { type: String, default: "" },
});
const emit = defineEmits(["update:modelValue"]);

const input = ref(null);
const open = ref(false);
const query = ref("");
const results = ref([]);
const cursor = ref(0);
const loading = ref(false);
let timer;
let seq = 0;

const strip = (html) =>
	new DOMParser().parseFromString(String(html || ""), "text/html").body.textContent;

function onFocus() {
	query.value = "";
	open.value = true;
	search("");
}
function onInput(v) {
	query.value = v;
	open.value = true;
	clearTimeout(timer);
	timer = setTimeout(() => search(v), 160);
}
function onBlur() {
	setTimeout(() => (open.value = false), 120);
}

async function search(txt) {
	if (!props.doctype) return;
	const mine = ++seq;
	loading.value = true;
	const q = props.getQuery() || {};
	try {
		const res = await call("frappe.desk.search.search_link", {
			doctype: props.doctype,
			txt,
			query: q.query || null,
			filters: q.filters || null,
			reference_doctype: props.referenceDoctype || null,
			page_length: 15,
		});
		if (mine === seq) {
			results.value = res || [];
			cursor.value = 0;
		}
	} catch {
		if (mine === seq) results.value = [];
	} finally {
		if (mine === seq) loading.value = false;
	}
}

function move(step) {
	if (!open.value) return onFocus();
	const n = results.value.length;
	if (n) cursor.value = (cursor.value + step + n) % n;
}
function pick(r) {
	if (!r) return;
	emit("update:modelValue", r.value);
	open.value = false;
	input.value?.blur();
}
function clear() {
	emit("update:modelValue", null);
	open.value = false;
}
</script>
