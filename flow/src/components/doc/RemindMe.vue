<template>
	<div
		v-if="open"
		class="fixed inset-0 z-50 flex items-start justify-center bg-ink/30 px-4 pt-[14vh]"
		@mousedown.self="open = false"
		@keydown.esc="open = false"
	>
		<form
			role="dialog"
			aria-modal="true"
			aria-labelledby="remind-title"
			class="flex w-full max-w-[420px] flex-col gap-4 rounded-2xl border border-line bg-surf p-6 shadow-2xl"
			@submit.prevent="save"
		>
			<h2 id="remind-title" class="text-[21px]">Remind me</h2>
			<div class="flex flex-wrap gap-1.5">
				<button
					v-for="q in quick"
					:key="q.label"
					type="button"
					class="chip bg-line-2 text-ink-2 hover:bg-acc-tint hover:text-acc"
					@click="when = q.value()"
				>
					{{ q.label }}
				</button>
			</div>
			<label class="flex flex-col gap-1">
				<span class="text-[12.5px] font-semibold text-ink-2">When</span>
				<input v-model="when" type="datetime-local" required :class="cls" />
			</label>
			<label class="flex flex-col gap-1">
				<span class="text-[12.5px] font-semibold text-ink-2">Note</span>
				<textarea v-model="note" rows="2" :class="cls" />
			</label>
			<p
				v-if="error"
				role="alert"
				class="rounded-lg bg-neg-tint px-3 py-2 text-[13px] text-neg"
			>
				{{ error }}
			</p>
			<div class="flex justify-end gap-2">
				<button type="button" class="btn-ghost" @click="open = false">Cancel</button>
				<button type="submit" class="btn-ink" :disabled="!when || saving">
					{{ saving ? "Saving…" : "Set reminder" }}
				</button>
			</div>
		</form>
	</div>
</template>

<script setup>
import { call } from "frappe-ui";
import dayjs from "dayjs";
import { ref, watch } from "vue";
import { messageOf } from "@/engine/form";

const props = defineProps({
	doctype: { type: String, required: true },
	name: { type: String, required: true },
	title: { type: String, default: "" },
});
const open = defineModel({ type: Boolean, default: false });
const emit = defineEmits(["done"]);

const cls =
	"w-full rounded-lg border border-line bg-paper px-2.5 py-1.5 text-[14px] text-ink focus:border-acc focus:ring-1 focus:ring-acc";
const fmt = (d) => d.format("YYYY-MM-DDTHH:mm");
const quick = [
	{ label: "In 1 hour", value: () => fmt(dayjs().add(1, "hour")) },
	{ label: "Tomorrow 9:00", value: () => fmt(dayjs().add(1, "day").hour(9).minute(0)) },
	{
		label: "Next Monday",
		value: () =>
			fmt(
				dayjs()
					.add((8 - dayjs().day()) % 7 || 7, "day")
					.hour(9)
					.minute(0),
			),
	},
	{ label: "In a week", value: () => fmt(dayjs().add(7, "day")) },
];
const when = ref("");
const note = ref("");
const saving = ref(false);
const error = ref("");

watch(open, (v) => {
	if (!v) return;
	when.value = quick[1].value();
	note.value = props.title ? `Follow up on ${props.title}` : "";
	error.value = "";
});

async function save() {
	saving.value = true;
	error.value = "";
	try {
		await call("frappe.automation.doctype.reminder.reminder.create_new_reminder", {
			remind_at: dayjs(when.value).format("YYYY-MM-DD HH:mm:ss"),
			description: note.value || props.title || props.name,
			reminder_doctype: props.doctype,
			reminder_docname: props.name,
		});
		open.value = false;
		emit("done", `We'll remind you ${dayjs(when.value).format("D MMM, HH:mm")}.`);
	} catch (e) {
		error.value = messageOf(e, "Couldn't set the reminder.");
	} finally {
		saving.value = false;
	}
}
</script>
