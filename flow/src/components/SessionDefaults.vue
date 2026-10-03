<template>
	<div
		v-if="open"
		class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/30 px-4 pt-[10vh]"
		@mousedown.self="open = false"
		@keydown.esc="open = false"
	>
		<form
			role="dialog"
			aria-modal="true"
			aria-labelledby="session-defaults-title"
			class="mb-10 w-full max-w-[480px] rounded-2xl border border-line bg-surf shadow-2xl"
			@submit.prevent="save"
		>
			<div class="flex items-center gap-3 border-b border-line-2 px-6 py-4">
				<h2 id="session-defaults-title" class="flex-grow text-[20px]">Session defaults</h2>
				<button
					type="button"
					aria-label="Close"
					class="text-mut hover:text-ink"
					@click="open = false"
				>
					<Icon name="x" :size="16" />
				</button>
			</div>
			<div class="flex flex-col gap-3.5 px-6 py-5">
				<p class="text-[13px] text-mut">
					New records start with these values until you log out.
				</p>
				<div v-if="loading" class="py-4 text-[13px] text-mut">Loading…</div>
				<p v-else-if="!fields.length" class="text-[13px] text-mut">
					No session defaults are set up. An administrator can add them in Session
					Default Settings.
				</p>
				<div v-for="f in fields" :key="f.fieldname" class="flex flex-col gap-1">
					<label
						:for="`sd-${f.fieldname}`"
						class="text-[12.5px] font-semibold text-ink-2"
						>{{ f.label }}</label
					>
					<LinkInput
						v-model="values[f.fieldname]"
						:input-id="`sd-${f.fieldname}`"
						:doctype="f.options"
						:label="f.label"
						:input-class="cls"
					/>
				</div>
				<p
					v-if="error"
					role="alert"
					class="rounded-lg bg-neg-tint px-3 py-2 text-[13px] text-neg"
				>
					{{ error }}
				</p>
			</div>
			<div class="flex justify-end gap-2 border-t border-line-2 px-6 py-3.5">
				<button type="button" class="btn-ghost" @click="open = false">Cancel</button>
				<button type="submit" class="btn-ink" :disabled="saving || !fields.length">
					{{ saving ? "Saving…" : "Save" }}
				</button>
			</div>
		</form>
	</div>
</template>

<script setup>
import { call } from "frappe-ui";
import { reactive, ref, watch } from "vue";
import Icon from "./Icon.vue";
import LinkInput from "./fields/LinkInput.vue";
import { messageOf } from "@/engine/form";

const open = defineModel({ type: Boolean, default: false });
const METHOD = "frappe.core.doctype.session_default_settings.session_default_settings";
const cls =
	"w-full rounded-lg border border-line bg-paper px-2.5 py-1.5 text-[14px] text-ink focus:border-acc focus:ring-1 focus:ring-acc";

const fields = ref([]);
const values = reactive({});
const loading = ref(false);
const saving = ref(false);
const error = ref("");

watch(open, async (v) => {
	if (!v) return;
	error.value = "";
	loading.value = true;
	try {
		const res = await call(`${METHOD}.get_session_default_values`);
		fields.value = typeof res === "string" ? JSON.parse(res) : res || [];
		for (const f of fields.value) values[f.fieldname] = f.default || "";
	} catch (e) {
		error.value = messageOf(e, "Couldn't load your session defaults.");
	} finally {
		loading.value = false;
	}
});

async function save() {
	saving.value = true;
	error.value = "";
	try {
		const res = await call(`${METHOD}.set_session_default_values`, {
			default_values: JSON.stringify(values),
		});
		if (res !== "success") throw new Error("Couldn't save your session defaults.");
		// Open screens picked up the old defaults; start fresh.
		window.location.reload();
	} catch (e) {
		error.value = messageOf(e, "Couldn't save your session defaults.");
		saving.value = false;
	}
}
</script>
