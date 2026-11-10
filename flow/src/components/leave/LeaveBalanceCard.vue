<template>
	<article
		class="flex w-full flex-col items-center rounded-xl border border-line bg-surf px-3 pb-4 pt-3.5 text-center sm:w-[172px] sm:px-4"
	>
		<h3 class="w-full truncate text-[13.5px] font-semibold text-ink" :title="card.leave_type">
			{{ card.leave_type }}
		</h3>
		<span
			class="mt-3 inline-flex h-11 w-11 items-center justify-center rounded-full"
			:class="card.paid ? 'bg-acc-tint text-acc' : 'bg-line-2 text-ink-2'"
		>
			<Icon name="cal" :size="22" />
		</span>
		<dl class="mt-4 grid w-full grid-cols-[1fr_auto] gap-y-1.5 text-left text-[13px]">
			<dt class="text-ink-2">{{ __("Available") }}</dt>
			<dd
				class="font-semibold tabular-nums"
				:class="
					card.available === null
						? 'text-mut'
						: card.available > 0
						  ? 'text-pos'
						  : 'text-ink'
				"
			>
				{{ card.available === null ? __("Unpaid") : qty(card.available) }}
			</dd>
			<dt class="text-ink-2">{{ __("Booked") }}</dt>
			<dd class="relative flex items-center justify-end gap-1 font-semibold tabular-nums">
				{{ qty(card.used + card.planned) }}
				<button
					type="button"
					class="peer inline-flex h-4 w-4 items-center justify-center rounded-full border border-line text-[10px] font-bold text-mut hover:border-acc hover:text-acc focus-visible:outline focus-visible:outline-2 focus-visible:outline-acc"
					:aria-label="`${card.leave_type}: ${breakdown}`"
				>
					i
				</button>
				<span
					role="tooltip"
					class="pointer-events-none absolute right-0 top-6 z-10 hidden w-[150px] rounded-lg border border-line bg-surf p-2.5 text-left text-[12px] font-normal shadow-lg peer-hover:block peer-focus-visible:block"
				>
					<span class="flex justify-between"
						><span class="text-ink-2">{{ __("Used") }}</span
						><b class="tabular-nums">{{ qty(card.used) }}</b></span
					>
					<span class="mt-1 flex justify-between"
						><span class="text-ink-2">{{ __("Planned") }}</span
						><b class="tabular-nums">{{ qty(card.planned) }}</b></span
					>
					<span class="mt-1 flex justify-between"
						><span class="text-ink-2">{{ __("Pending approval") }}</span
						><b class="tabular-nums">{{ qty(card.pending) }}</b></span
					>
					<span v-if="card.expired" class="mt-1 flex justify-between"
						><span class="text-ink-2">{{ __("Expired") }}</span
						><b class="tabular-nums">{{ qty(card.expired) }}</b></span
					>
				</span>
			</dd>
		</dl>
	</article>
</template>

<script setup>
import { computed } from "vue";
import Icon from "@/components/Icon.vue";
import { qty } from "@/composables/format";
import { __ } from "@/composables/i18n";

const props = defineProps({ card: { type: Object, required: true } });

const breakdown = computed(
	() =>
		`${__("Used")} ${qty(props.card.used)}, ${__("Planned")} ${qty(props.card.planned)}, ${__(
			"Pending approval",
		)} ${qty(props.card.pending)}`,
);
</script>
