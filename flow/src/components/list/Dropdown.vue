<template>
	<div class="relative" @keydown.esc="open = false">
		<button
			type="button"
			class="btn-ghost h-9"
			:class="active && 'border-acc/50 text-acc'"
			:aria-expanded="open"
			@click="open = !open"
		>
			<Icon v-if="icon" :name="icon" :size="14" /> {{ label }}
		</button>
		<div v-if="open" class="fixed inset-0 z-20" @click="open = false" />
		<div
			v-if="open"
			class="absolute top-full z-30 mt-1 max-h-[420px] overflow-y-auto rounded-lg border border-line bg-surf py-1 shadow-xl"
			:class="[align === 'right' ? 'right-0' : 'left-0', width]"
		>
			<slot :close="() => (open = false)" />
		</div>
	</div>
</template>

<script setup>
import { ref } from "vue";
import Icon from "@/components/Icon.vue";

defineProps({
	label: { type: String, required: true },
	icon: { type: String, default: "" },
	active: { type: Boolean, default: false },
	align: { type: String, default: "left" },
	width: { type: String, default: "w-[260px]" },
});
const open = ref(false);
</script>
