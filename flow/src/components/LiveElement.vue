<template>
	<div ref="host" />
</template>

<script setup>
// Shows a DOM element a desk script built and still holds (an HTML field's wrapper), so the
// script's later changes and click handlers keep working.
import { onMounted, ref, watch } from "vue";

const props = defineProps({ el: { type: Object, required: true } });
const host = ref(null);

function mount() {
	if (host.value && props.el && props.el.parentNode !== host.value)
		host.value.replaceChildren(props.el);
}
onMounted(mount);
watch(() => props.el, mount);
</script>
