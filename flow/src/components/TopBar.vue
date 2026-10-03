<template>
	<header
		class="flex h-[52px] shrink-0 items-center gap-3.5 border-b border-line bg-surf pl-4 pr-5"
	>
		<button
			v-if="collapsed"
			type="button"
			aria-label="Expand sidebar"
			class="flex h-8 w-8 items-center justify-center rounded-lg text-mut hover:bg-side"
			@click="$emit('expand')"
		>
			<Icon name="expand" :size="16" />
		</button>
		<nav aria-label="Breadcrumb" class="min-w-0 flex-1 truncate text-[13px] text-mut">
			<template v-for="(c, i) in crumbs" :key="i">
				<span v-if="i" aria-hidden="true" class="mx-1.5">/</span>
				<router-link v-if="c.to" :to="c.to" class="hover:text-ink">{{
					c.label
				}}</router-link>
				<span v-else class="text-ink-2">{{ c.label }}</span>
			</template>
		</nav>
		<button
			type="button"
			class="flex h-[34px] w-[400px] items-center gap-2.5 rounded-[9px] border border-line bg-paper px-2.5 text-left text-[13.5px] text-mut hover:border-acc/40"
			@click="$emit('search')"
		>
			<Icon name="search" :size="15" />
			<span class="flex-grow">Search people, records, reports…</span>
			<kbd class="rounded border border-current px-1 text-[11px] font-semibold">⌘K</kbd>
		</button>
		<div class="flex flex-1 items-center justify-end gap-2">
			<a href="/app" class="btn-ghost h-8 px-3 text-[13px]">
				<Icon name="ext" :size="14" />
				Classic desk
			</a>
		</div>
	</header>
</template>

<script setup>
import Icon from "./Icon.vue";

defineProps({
	crumbs: { type: Array, default: () => [] },
	collapsed: { type: Boolean, default: false },
});
defineEmits(["search", "expand"]);
</script>
