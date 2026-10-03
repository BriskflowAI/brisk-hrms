<template>
	<span v-if="text" class="chip" :class="tone">{{ text }}</span>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({ doc: { type: Object, required: true } });

const text = computed(() => {
	if (props.doc.status) return props.doc.status;
	return { 0: "Draft", 1: "Submitted", 2: "Cancelled" }[props.doc.docstatus] || "";
});

const tone = computed(() => {
	const t = (text.value || "").toLowerCase();
	if (
		["approved", "active", "submitted", "paid", "completed", "present", "open"].some((w) =>
			t.includes(w),
		)
	)
		return t.includes("open") ? "bg-warn-tint text-warn" : "bg-pos-tint text-pos";
	if (
		["rejected", "cancelled", "left", "absent", "overdue", "failed"].some((w) => t.includes(w))
	)
		return "bg-neg-tint text-neg";
	if (["draft", "pending", "unpaid"].some((w) => t.includes(w))) return "bg-warn-tint text-warn";
	return "bg-line-2 text-ink-2";
});
</script>
