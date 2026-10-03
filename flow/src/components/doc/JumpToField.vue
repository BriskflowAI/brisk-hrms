<template>
	<div
		v-if="open"
		class="fixed inset-0 z-50 flex items-start justify-center bg-ink/30 px-4 pt-[12vh]"
		@mousedown.self="open = false"
	>
		<div
			role="dialog"
			aria-modal="true"
			aria-label="Jump to field"
			class="w-full max-w-[460px] overflow-hidden rounded-2xl border border-line bg-surf shadow-2xl"
		>
			<input
				ref="input"
				v-model="query"
				type="text"
				placeholder="Jump to field…"
				aria-label="Jump to field"
				class="w-full border-0 border-b border-line-2 bg-transparent px-4 py-3.5 text-[15px] focus:ring-0"
				@keydown.down.prevent="move(1)"
				@keydown.up.prevent="move(-1)"
				@keydown.enter.prevent="pick(matches[cursor])"
				@keydown.esc="open = false"
			/>
			<ul class="max-h-[50vh] overflow-y-auto py-1" role="listbox">
				<li
					v-for="(m, i) in matches"
					:key="m.key"
					role="option"
					:aria-selected="i === cursor"
					class="flex cursor-pointer items-baseline gap-2 px-4 py-2 text-[13.5px]"
					:class="i === cursor && 'bg-acc-tint'"
					@mousedown.prevent="pick(m)"
					@mousemove="cursor = i"
				>
					<span class="font-semibold">{{ m.label }}</span>
					<span class="ml-auto truncate text-[12px] text-mut">{{ m.where }}</span>
				</li>
				<li v-if="!matches.length" class="px-4 py-3 text-[13px] text-mut">
					No field matches
				</li>
			</ul>
		</div>
	</div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from "vue";

const props = defineProps({
	fields: { type: Array, required: true }, // [{ key, label, where, go }]
});
const open = defineModel({ type: Boolean, default: false });
const input = ref(null);
const query = ref("");
const cursor = ref(0);

const matches = computed(() => {
	const q = query.value.trim().toLowerCase();
	return props.fields.filter((f) => !q || f.label.toLowerCase().includes(q)).slice(0, 40);
});
watch(query, () => (cursor.value = 0));
watch(open, async (v) => {
	if (!v) return;
	query.value = "";
	await nextTick();
	input.value?.focus();
});

function move(step) {
	const n = matches.value.length;
	if (n) cursor.value = (cursor.value + step + n) % n;
}
function pick(m) {
	if (!m) return;
	open.value = false;
	m.go();
}
</script>
