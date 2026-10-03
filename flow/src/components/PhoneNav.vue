<template>
	<!-- Phones: tabs along the bottom, and everything else in a menu that slides in. -->
	<nav
		aria-label="Areas"
		class="fixed inset-x-0 bottom-0 z-30 flex h-[60px] border-t border-ink-nav bg-ink pb-[env(safe-area-inset-bottom)] md:hidden"
	>
		<router-link
			v-for="t in tabs"
			:key="t.key"
			:to="t.to"
			:aria-current="t.key === active ? 'page' : undefined"
			class="relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[10.5px]"
			:class="t.key === active ? 'font-bold text-surf' : 'font-medium text-ink-navtext'"
		>
			<Icon :name="t.icon" :size="20" :class="t.key === active ? 'text-lime' : ''" />
			{{ __(t.label) }}
			<span
				v-if="t.key === 'inbox' && inboxCount"
				class="absolute left-1/2 top-1 ml-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-lime px-1 text-[10px] font-extrabold text-ink"
				>{{ inboxCount > 99 ? "99+" : inboxCount }}</span
			>
		</router-link>
		<button
			type="button"
			class="flex flex-1 flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium text-ink-navtext"
			:aria-expanded="open"
			@click="open = true"
		>
			<Icon name="menu" :size="20" />
			More
		</button>
	</nav>

	<div v-if="open" class="fixed inset-0 z-40 bg-ink/40 md:hidden" @click="open = false" />
	<div
		v-if="open"
		role="dialog"
		aria-modal="true"
		aria-label="Menu"
		class="fixed inset-y-0 left-0 z-50 flex w-[86vw] max-w-[340px] flex-col overflow-y-auto bg-side shadow-2xl md:hidden"
		@keydown.esc="open = false"
	>
		<div class="flex items-center gap-3 bg-ink px-4 py-3.5 text-surf">
			<Avatar :label="fullName" :size="34" />
			<div class="min-w-0 flex-grow">
				<div class="truncate text-[14px] font-bold">{{ fullName }}</div>
				<div class="truncate text-[12px] text-ink-navtext">{{ user }}</div>
			</div>
			<button
				type="button"
				aria-label="Close menu"
				class="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-ink-nav"
				@click="open = false"
			>
				<Icon name="x" :size="18" />
			</button>
		</div>
		<div class="grid grid-cols-4 gap-1 border-b border-line px-2 py-3">
			<button
				v-for="a in visibleAreas"
				:key="a.key"
				type="button"
				class="flex flex-col items-center gap-1 rounded-lg py-2 text-[11px] font-semibold"
				:class="
					a.key === shown?.key
						? 'bg-surf text-ink shadow-[inset_0_0_0_1px] shadow-line'
						: 'text-ink-2'
				"
				@click="pick(a)"
			>
				<Icon
					:name="a.icon"
					:size="20"
					:class="a.key === shown?.key ? 'text-acc' : 'text-mut'"
				/>
				{{ __(a.label) }}
			</button>
		</div>
		<ContextSidebar v-if="shown?.sections.length" :area="shown" embedded />
		<div class="mt-auto flex flex-col border-t border-line py-2 text-[14px]">
			<router-link
				:to="{ name: 'Form', params: { doctype: 'User', name: user } }"
				class="px-4 py-2.5"
				>My settings</router-link
			>
			<router-link to="/about" class="px-4 py-2.5">About and licences</router-link>
			<a href="/app" class="px-4 py-2.5">Classic desk</a>
			<button
				type="button"
				class="px-4 py-2.5 text-left font-semibold text-neg"
				@click="logout"
			>
				Log out
			</button>
		</div>
	</div>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import Icon from "./Icon.vue";
import Avatar from "./Avatar.vue";
import ContextSidebar from "./ContextSidebar.vue";
import { visibleAreas } from "@/composables/access";
import { inboxCount } from "@/composables/inbox";
import { logout, useSession } from "@/composables/session";

const props = defineProps({ active: { type: String, default: null } });
const open = defineModel("open", { type: Boolean, default: false });
const route = useRoute();
const router = useRouter();
const { fullName, user } = useSession();
const browsing = ref(null); // the area picked in the menu, before going anywhere

const tabs = computed(() =>
	["home", "inbox", "people", "time"]
		.map((k) => visibleAreas.value.find((a) => a.key === k))
		.filter(Boolean)
		.map((a) => ({ key: a.key, label: a.label, icon: a.icon, to: entryFor(a) })),
);
const shown = computed(
	() => browsing.value || visibleAreas.value.find((a) => a.key === props.active) || null,
);

function entryFor(area) {
	if (area.to) return area.to;
	const first = area.sections.flatMap((s) => s.items).find((i) => i.route || i.doctype);
	if (first?.route) return first.route;
	return first ? { name: "List", params: { doctype: first.doctype } } : "/";
}

function pick(a) {
	if (!a.sections.length) {
		open.value = false;
		router.push(entryFor(a));
		return;
	}
	browsing.value = a;
}

watch(
	() => route.fullPath,
	() => {
		open.value = false;
		browsing.value = null;
	},
);
watch(open, (v) => !v && (browsing.value = null));
</script>
