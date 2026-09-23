<template>
	<nav
		aria-label="Areas"
		class="flex w-[68px] shrink-0 flex-col items-center gap-0.5 bg-ink px-0 pb-3.5 pt-3"
	>
		<router-link
			to="/"
			:aria-label="`${brand.name} home`"
			class="mb-3 flex h-[38px] w-[38px] items-center justify-center rounded-[11px] bg-lime pb-[3px] font-display text-[22px] font-extrabold text-ink"
		>
			{{ brand.mark }}
		</router-link>

		<router-link
			v-for="area in areas"
			:key="area.key"
			:to="entryFor(area)"
			:aria-current="area.key === active ? 'page' : undefined"
			class="flex w-14 flex-col items-center gap-[3px] rounded-[10px] pb-1.5 pt-[7px] text-[10.5px] transition-colors"
			:class="
				area.key === active
					? 'bg-ink-nav font-bold text-surf'
					: 'font-medium text-ink-navtext hover:bg-ink-nav/60'
			"
		>
			<Icon :name="area.icon" :size="20" :class="area.key === active ? 'text-lime' : ''" />
			{{ area.label }}
		</router-link>

		<div class="mt-auto flex flex-col items-center gap-2.5">
			<a
				href="/app/hr-settings"
				class="flex w-14 flex-col items-center gap-[3px] rounded-[10px] pb-1.5 pt-[7px] text-[10.5px] font-medium text-ink-navtext hover:bg-ink-nav/60"
			>
				<Icon name="gear" :size="20" />
				Setup
			</a>
			<router-link
				to="/about"
				aria-label="About and licences"
				class="inline-flex rounded-full ring-2 ring-lime"
			>
				<Avatar :label="fullName" :size="32" />
			</router-link>
		</div>
	</nav>
</template>

<script setup>
import Icon from "./Icon.vue";
import Avatar from "./Avatar.vue";
import { areas } from "@/nav";
import { brand } from "@/brand";
import { useSession } from "@/composables/session";

defineProps({ active: { type: String, default: null } });

const { fullName } = useSession();

function entryFor(area) {
	if (area.to) return area.to;
	const first = area.sections.flatMap((s) => s.items).find((i) => i.doctype);
	return first ? { name: "List", params: { doctype: first.doctype } } : "/";
}
</script>
