<template>
	<div class="flex h-screen overflow-hidden bg-paper font-body text-ink">
		<Rail :active="area?.key" />
		<ContextSidebar
			v-if="area?.sections.length && !collapsed"
			:area="area"
			@collapse="collapsed = true"
		/>
		<div class="flex min-w-0 flex-grow flex-col">
			<TopBar
				:crumbs="crumbs"
				:collapsed="!!area?.sections.length && collapsed"
				@search="paletteOpen = true"
				@expand="collapsed = false"
			/>
			<main class="relative min-h-0 flex-grow overflow-y-auto">
				<router-view :key="$route.fullPath" />
			</main>
		</div>
		<CommandPalette v-model="paletteOpen" />
	</div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import Rail from "@/components/Rail.vue";
import ContextSidebar from "@/components/ContextSidebar.vue";
import TopBar from "@/components/TopBar.vue";
import CommandPalette from "@/components/CommandPalette.vue";
import { areas, areaForDoctype } from "@/nav";
import { brand } from "@/brand";

const route = useRoute();
const paletteOpen = ref(false);
const collapsed = ref(localPref("flow.sidebarCollapsed") === "1");

watch(collapsed, (v) => savePref("flow.sidebarCollapsed", v ? "1" : "0"));

const area = computed(() => {
	if (route.name === "Home") return areas[0];
	if (route.name === "Report")
		return (
			areas.find((a) =>
				a.sections.some((sec) => sec.items.some((i) => i.report === route.params.name)),
			) || areas.find((a) => a.key === "reports")
		);
	if (route.name === "PayrollReview") return areas.find((a) => a.key === "pay");
	if (route.name === "People") return areas.find((a) => a.key === "people");
	if (route.name === "LeavePolicies") return areas.find((a) => a.key === "time");
	if (route.name === "Overview") return areas.find((a) => a.key === route.params.area);
	if (route.name === "Inbox") return areas.find((a) => a.key === "inbox");
	if (route.params.doctype) return areaForDoctype(route.params.doctype) || null;
	return null;
});

const crumbs = computed(() => {
	const out = [];
	if (area.value) out.push({ label: area.value.label });
	if (route.name === "List") out.push({ label: route.params.doctype });
	if (route.name === "Form") {
		out.push({
			label: route.params.doctype,
			to: { name: "List", params: { doctype: route.params.doctype } },
		});
		out.push({ label: route.params.name });
	}
	if (route.name === "About") out.push({ label: "About" });
	if (route.name === "LeavePolicies") out.push({ label: "Leave policies" });
	if (route.name === "Overview") out.push({ label: "Overview" });
	if (route.name === "Inbox") out.push({ label: "Decide" });
	if (route.name === "PayrollReview") out.push({ label: "Runs" }, { label: route.params.name });
	return out;
});

watch(
	() => route.fullPath,
	() => {
		const last = crumbs.value[crumbs.value.length - 1];
		document.title = last ? `${last.label} · ${brand.name}` : brand.name;
	},
	{ immediate: true },
);

function onKey(e) {
	if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
		e.preventDefault();
		paletteOpen.value = !paletteOpen.value;
	}
}
onMounted(() => window.addEventListener("keydown", onKey));
onBeforeUnmount(() => window.removeEventListener("keydown", onKey));

function localPref(key) {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}
function savePref(key, value) {
	try {
		localStorage.setItem(key, value);
	} catch {
		/* storage unavailable: preference just isn't remembered */
	}
}
</script>
