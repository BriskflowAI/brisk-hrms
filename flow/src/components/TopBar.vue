<template>
	<header
		class="flex h-[52px] shrink-0 items-center gap-2 border-b border-line bg-surf pl-2 pr-3 md:gap-3.5 md:pl-4 md:pr-5"
	>
		<button
			type="button"
			aria-label="Menu"
			class="flex h-9 w-9 items-center justify-center rounded-lg text-ink-2 hover:bg-side md:hidden"
			@click="$emit('menu')"
		>
			<Icon name="menu" :size="20" />
		</button>
		<button
			v-if="collapsed"
			type="button"
			aria-label="Expand sidebar"
			class="hidden h-8 w-8 md:flex items-center justify-center rounded-lg text-mut hover:bg-side"
			@click="$emit('expand')"
		>
			<Icon name="expand" :size="16" />
		</button>
		<nav aria-label="Breadcrumb" class="min-w-0 flex-1 truncate text-[13px] text-mut">
			<template v-for="(c, i) in crumbs" :key="i">
				<span v-if="i" aria-hidden="true" class="mx-1.5 hidden md:inline">/</span>
				<router-link
					v-if="c.to"
					:to="c.to"
					class="hover:text-ink"
					:class="i < crumbs.length - 1 && 'hidden md:inline'"
					>{{ c.label }}</router-link
				>
				<span
					v-else
					class="text-ink-2"
					:class="i < crumbs.length - 1 && 'hidden md:inline'"
					>{{ c.label }}</span
				>
			</template>
		</nav>
		<button
			type="button"
			aria-label="Search"
			class="flex h-[34px] w-9 shrink-0 items-center justify-center gap-2.5 rounded-[9px] border border-line bg-paper px-2.5 text-left text-[13.5px] text-mut hover:border-acc/40 md:w-[400px] md:justify-start"
			@click="$emit('search')"
		>
			<Icon name="search" :size="15" />
			<span class="hidden flex-grow md:inline">Search people, records, reports…</span>
			<kbd class="kbd hidden md:inline-flex">{{ modKey }}K</kbd>
		</button>
		<div class="flex items-center justify-end gap-2 md:flex-1">
			<NotificationsMenu />
			<a href="/app" class="btn-ghost hidden h-8 px-3 text-[13px] md:inline-flex">
				<Icon name="ext" :size="14" />
				Classic desk
			</a>
		</div>
	</header>
</template>

<script setup>
import { modKey } from "@/composables/platform";
import Icon from "./Icon.vue";
import NotificationsMenu from "./NotificationsMenu.vue";

defineProps({
	crumbs: { type: Array, default: () => [] },
	collapsed: { type: Boolean, default: false },
});
defineEmits(["search", "expand", "menu"]);
</script>
