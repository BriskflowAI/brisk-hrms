<template>
	<div
		v-if="open"
		class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/30 px-4 pt-[10vh]"
		@mousedown.self="open = false"
		@keydown.esc="open = false"
	>
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="shortcuts-title"
			class="mb-10 w-full max-w-[560px] rounded-2xl border border-line bg-surf p-6 shadow-2xl"
		>
			<div class="mb-4 flex items-center">
				<h2 id="shortcuts-title" class="flex-grow text-[21px]">
					{{ __("Keyboard shortcuts") }}
				</h2>
				<button
					type="button"
					:aria-label="__('Close')"
					class="text-mut hover:text-ink"
					@click="open = false"
				>
					<Icon name="x" :size="16" />
				</button>
			</div>
			<section v-for="g in groups" :key="g.title" class="mb-4 last:mb-0">
				<h3 class="kicker mb-2">{{ g.title }}</h3>
				<dl class="flex flex-col gap-1.5 text-[13.5px]">
					<div v-for="s in g.items" :key="s.what" class="flex items-center gap-3">
						<dt class="flex-grow text-ink-2">{{ s.what }}</dt>
						<dd class="flex gap-1">
							<kbd
								v-for="k in s.keys"
								:key="k"
								class="inline-flex h-6 min-w-6 items-center justify-center rounded border border-line bg-paper px-1.5 font-body text-[12px] font-semibold"
								>{{ k }}</kbd
							>
						</dd>
					</div>
				</dl>
			</section>
		</div>
	</div>
</template>

<script setup>
import { onBeforeUnmount, onMounted } from "vue";
import Icon from "./Icon.vue";
import { modKey } from "@/composables/platform";

import { shortcutsOpen as open } from "@/composables/ui";
const mod = modKey.trim();

const groups = [
	{
		title: "Anywhere",
		items: [
			{ what: "Search people, records and reports", keys: [mod, "K"] },
			{ what: "Show these shortcuts", keys: ["?"] },
			{ what: "Close a dialog or menu", keys: ["Esc"] },
		],
	},
	{
		title: "On a record",
		items: [
			{ what: "Save", keys: [mod, "S"] },
			{ what: "Undo a change", keys: [mod, "Z"] },
			{ what: "Redo", keys: [mod, "Shift", "Z"] },
			{ what: "Jump to a field", keys: [mod, "J"] },
			{ what: "New record of this type", keys: [mod, "B"] },
		],
	},
	{
		title: "Inbox",
		items: [
			{ what: "Next / previous request", keys: ["J", "K"] },
			{ what: "Approve and go to the next", keys: ["A"] },
			{ what: "Reject", keys: ["R"] },
			{ what: "Comment", keys: ["C"] },
		],
	},
];

// "?" anywhere outside a text field.
function onKey(e) {
	if (e.key !== "?" || e.metaKey || e.ctrlKey || e.altKey) return;
	const el = document.activeElement;
	if (el && (el.matches?.("input, textarea, select") || el.isContentEditable)) return;
	e.preventDefault();
	open.value = !open.value;
}
onMounted(() => window.addEventListener("keydown", onKey));
onBeforeUnmount(() => window.removeEventListener("keydown", onKey));
</script>
