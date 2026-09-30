<template>
	<aside
		:aria-label="`${area.label} navigation`"
		class="flex w-[236px] shrink-0 flex-col gap-[18px] overflow-y-auto border-r border-line bg-side px-2.5 py-3.5"
	>
		<div class="flex items-center gap-1 pl-2 pr-1">
			<span class="flex-grow font-display text-[19px] font-bold tracking-tight">{{
				area.label
			}}</span>
			<button
				type="button"
				aria-label="Collapse sidebar"
				class="flex h-7 w-7 items-center justify-center rounded-md text-mut hover:bg-surf"
				@click="$emit('collapse')"
			>
				<Icon name="collapse" :size="15" />
			</button>
		</div>

		<div v-for="section in area.sections" :key="section.label" class="flex flex-col gap-px">
			<div class="kicker px-2 pb-1">{{ section.label }}</div>
			<template v-for="item in section.items" :key="item.label">
				<router-link
					v-if="item.doctype"
					:to="{ name: 'List', params: { doctype: item.doctype } }"
					class="flex h-[30px] items-center gap-2 rounded-[7px] px-2 text-[13.5px] transition-colors"
					:class="
						isActive(item)
							? 'bg-surf font-bold text-ink shadow-[0_0_0_1px] shadow-line'
							: 'font-medium text-ink-2 hover:bg-surf/70'
					"
				>
					<span
						class="h-1.5 w-1.5 shrink-0 rounded-sm"
						:class="isActive(item) ? 'bg-acc' : 'bg-line'"
					/>
					<span class="truncate">{{ item.label }}</span>
				</router-link>
				<router-link
					v-else-if="item.report"
					:to="{ name: 'Report', params: { name: item.report } }"
					class="flex h-[30px] items-center gap-2 rounded-[7px] px-2 text-[13.5px] transition-colors"
					:class="
						$route.params.name === item.report
							? 'bg-surf font-bold text-ink shadow-[0_0_0_1px] shadow-line'
							: 'font-medium text-ink-2 hover:bg-surf/70'
					"
				>
					<Icon name="chart" :size="14" class="shrink-0 text-mut" />
					<span class="truncate">{{ item.label }}</span>
				</router-link>
				<a
					v-else
					:href="item.href"
					class="flex h-[30px] items-center gap-2 rounded-[7px] px-2 text-[13.5px] font-medium text-ink-2 hover:bg-surf/70"
				>
					<Icon name="chart" :size="14" class="shrink-0 text-mut" />
					<span class="truncate">{{ item.label }}</span>
				</a>
			</template>
		</div>
	</aside>
</template>

<script setup>
import { useRoute } from "vue-router";
import Icon from "./Icon.vue";

defineProps({ area: { type: Object, required: true } });
defineEmits(["collapse"]);

const route = useRoute();
const isActive = (item) => item.doctype && route.params.doctype === item.doctype;
</script>
