<template>
	<!-- Email from a record, through the same endpoint as the desk: the email is linked to the
	     record and shows in its activity. -->
	<div
		v-if="open"
		class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/30 px-4 pt-[6vh]"
		@mousedown.self="open = false"
		@keydown.esc="open = false"
	>
		<form
			role="dialog"
			aria-modal="true"
			aria-labelledby="email-title"
			class="mb-10 flex w-full max-w-[680px] flex-col rounded-2xl border border-line bg-surf shadow-2xl"
			@submit.prevent="send"
		>
			<div class="flex items-center gap-3 border-b border-line-2 px-6 py-4">
				<h2 id="email-title" class="flex-grow text-[20px]">
					{{ initial?.subject?.startsWith("Re:") ? "Reply" : "New email" }}
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
			<div class="flex flex-col gap-3 px-6 py-4">
				<div v-for="f in addressFields" :key="f.key" class="relative flex flex-col gap-1">
					<label :for="`email-${f.key}`" class="text-[12.5px] font-semibold text-ink-2"
						>{{ f.label }}
						<button
							v-if="f.key === 'to' && !showCc"
							type="button"
							class="ml-2 font-normal text-acc"
							@click="showCc = true"
						>
							{{ __("Cc / Bcc") }}
						</button></label
					>
					<input
						:id="`email-${f.key}`"
						v-model="draft[f.key]"
						type="text"
						autocomplete="off"
						:class="cls"
						:placeholder="f.key === 'to' ? 'name@company.com, …' : ''"
						@input="suggest(f.key)"
						@keydown.down.prevent="move(1)"
						@keydown.up.prevent="move(-1)"
						@keydown.enter="pickOnEnter($event)"
						@blur="closeSuggestions"
					/>
					<ul
						v-if="suggestions.length && active === f.key"
						role="listbox"
						class="absolute left-0 right-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-lg border border-line bg-surf py-1 shadow-xl"
					>
						<li
							v-for="(s, i) in suggestions"
							:key="s.value"
							role="option"
							:aria-selected="i === cursor"
							class="cursor-pointer px-3 py-1.5 text-[13px]"
							:class="i === cursor && 'bg-acc-tint'"
							@mousedown.prevent="pick(s)"
						>
							<span class="font-semibold">{{ s.description || s.value }}</span>
							<span v-if="s.description" class="ml-1.5 text-mut">{{ s.value }}</span>
						</li>
					</ul>
				</div>
				<div class="grid grid-cols-[1fr_200px] gap-3">
					<label class="flex flex-col gap-1">
						<span class="text-[12.5px] font-semibold text-ink-2">{{
							__("Subject")
						}}</span>
						<input v-model="draft.subject" type="text" :class="cls" />
					</label>
					<label class="flex flex-col gap-1">
						<span class="text-[12.5px] font-semibold text-ink-2">{{
							__("Template")
						}}</span>
						<select v-model="template" :class="cls" @change="applyTemplate">
							<option value="">{{ __("None") }}</option>
							<option v-for="t in templates" :key="t" :value="t">{{ t }}</option>
						</select>
					</label>
				</div>
				<label class="flex flex-col gap-1">
					<span class="text-[12.5px] font-semibold text-ink-2">{{ __("Message") }}</span>
					<textarea v-model="draft.message" rows="9" :class="cls" />
				</label>
				<div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-ink-2">
					<label class="flex items-center gap-2">
						<input
							v-model="draft.attachPrint"
							type="checkbox"
							class="rounded border-line text-acc"
						/>
						{{ __("Attach as PDF") }}{{ " " }}
					</label>
					<select
						v-if="draft.attachPrint"
						v-model="draft.printFormat"
						:aria-label="__('Print format')"
						class="h-8 rounded-md border border-line bg-paper px-2 text-[13px]"
					>
						<option value="">{{ __("Standard") }}</option>
						<option v-for="p in printFormats" :key="p" :value="p">{{ p }}</option>
					</select>
					<label class="flex items-center gap-2">
						<input
							v-model="draft.copyMe"
							type="checkbox"
							class="rounded border-line text-acc"
						/>
						{{ __("Send me a copy") }}{{ " " }}
					</label>
					<label class="flex items-center gap-2">
						<input
							v-model="draft.readReceipt"
							type="checkbox"
							class="rounded border-line text-acc"
						/>
						{{ __("Ask for a read receipt") }}{{ " " }}
					</label>
				</div>
				<fieldset v-if="files.length" class="flex flex-col gap-1">
					<legend class="mb-1 text-[12.5px] font-semibold text-ink-2">
						{{ __("Attach files from this record") }}
					</legend>
					<label
						v-for="a in files"
						:key="a.name"
						class="flex items-center gap-2 text-[13px] text-ink-2"
					>
						<input
							v-model="draft.files"
							type="checkbox"
							:value="a.name"
							class="rounded border-line text-acc"
						/>
						{{ a.file_name }}
					</label>
				</fieldset>
				<p
					v-if="error"
					role="alert"
					class="rounded-lg bg-neg-tint px-3 py-2 text-[13px] text-neg"
				>
					{{ error }}
				</p>
			</div>
			<div class="flex justify-end gap-2 border-t border-line-2 px-6 py-3.5">
				<button type="button" class="btn-ghost" @click="open = false">
					{{ __("Discard") }}
				</button>
				<button type="submit" class="btn-ink" :disabled="sending || !draft.to.trim()">
					<Icon name="mail" :size="15" /> {{ sending ? "Sending…" : "Send" }}
				</button>
			</div>
		</form>
	</div>
</template>

<script setup>
import { call } from "frappe-ui";
import { computed, reactive, ref, watch } from "vue";
import Icon from "@/components/Icon.vue";
import { messageOf } from "@/engine/form";

const props = defineProps({
	form: { type: Object, required: true },
	initial: { type: Object, default: null }, // { to, cc, subject, message }
});
const open = defineModel({ type: Boolean, default: false });

const cls =
	"w-full rounded-lg border border-line bg-paper px-2.5 py-1.5 text-[14px] text-ink focus:border-acc focus:ring-1 focus:ring-acc";
const draft = reactive(blank());
const showCc = ref(false);
const sending = ref(false);
const error = ref("");
const template = ref("");
const templates = ref([]);
const printFormats = ref([]);
const suggestions = ref([]);
const active = ref(null);
const cursor = ref(0);

const files = computed(() => props.form.docinfo?.attachments || []);
const addressFields = computed(() => [
	{ key: "to", label: "To" },
	...(showCc.value
		? [
				{ key: "cc", label: "Cc" },
				{ key: "bcc", label: "Bcc" },
		  ]
		: []),
]);

function blank() {
	return {
		to: "",
		cc: "",
		bcc: "",
		subject: "",
		message: "",
		attachPrint: false,
		printFormat: "",
		copyMe: false,
		readReceipt: false,
		files: [],
	};
}

// The record's own email field, as the desk does.
function defaultRecipient() {
	const doc = props.form.doc || {};
	const field = (props.form.meta?.fields || []).find(
		(f) => f.options === "Email" && doc[f.fieldname],
	);
	return (
		doc.personal_email ||
		doc.company_email ||
		doc.email_id ||
		(field && doc[field.fieldname]) ||
		""
	);
}

watch(open, async (v) => {
	if (!v) return;
	Object.assign(draft, blank());
	error.value = "";
	template.value = "";
	const doc = props.form.doc || {};
	const title = doc[props.form.meta?.title_field] || doc.name;
	draft.to = props.initial?.to ?? defaultRecipient();
	draft.cc = props.initial?.cc || "";
	showCc.value = !!draft.cc;
	draft.subject = props.initial?.subject || `${props.form.doctype}: ${title}`;
	draft.message = props.initial?.message || "";
	const [t, p] = await Promise.all([
		call("frappe.client.get_list", {
			doctype: "Email Template",
			pluck: "name",
			limit_page_length: 100,
		}).catch(() => []),
		call("frappe.client.get_list", {
			doctype: "Print Format",
			filters: { doc_type: props.form.doctype, disabled: 0 },
			pluck: "name",
			limit_page_length: 100,
		}).catch(() => []),
	]);
	templates.value = (t || []).map((x) => x.name || x);
	printFormats.value = (p || []).map((x) => x.name || x);
});

async function applyTemplate() {
	if (!template.value) return;
	try {
		const res = await call(
			"frappe.email.doctype.email_template.email_template.get_email_template",
			{
				template_name: template.value,
				doc: props.form.doc,
			},
		);
		if (res?.subject) draft.subject = res.subject;
		if (res?.message) draft.message = htmlToText(res.message);
	} catch (e) {
		error.value = messageOf(e, "Couldn't use that template.");
	}
}

// ---- address suggestions from contacts ----
let timer;
function lastToken(key) {
	return draft[key].split(",").pop().trim();
}
function suggest(key) {
	active.value = key;
	clearTimeout(timer);
	const q = lastToken(key);
	if (q.length < 2) {
		suggestions.value = [];
		return;
	}
	timer = setTimeout(async () => {
		const res = await call("frappe.email.get_contact_list", { txt: q }).catch(() => []);
		suggestions.value = (res || []).slice(0, 8);
		cursor.value = 0;
	}, 200);
}
function move(step) {
	const n = suggestions.value.length;
	if (n) cursor.value = (cursor.value + step + n) % n;
}
function pick(s) {
	const key = active.value;
	const parts = draft[key]
		.split(",")
		.slice(0, -1)
		.map((x) => x.trim())
		.filter(Boolean);
	draft[key] = [...parts, s.value].join(", ") + ", ";
	suggestions.value = [];
}
function pickOnEnter(e) {
	if (!suggestions.value.length) return;
	e.preventDefault();
	pick(suggestions.value[cursor.value]);
}
function closeSuggestions() {
	setTimeout(() => (suggestions.value = []), 150);
}

// ---- sending ----
const escape = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function textToHtml(text) {
	return escape(text).replace(/\n/g, "<br>");
}
function htmlToText(html) {
	const doc = new DOMParser().parseFromString(
		String(html)
			.replace(/<br\s*\/?>/gi, "\n")
			.replace(/<\/p>/gi, "\n"),
		"text/html",
	);
	return doc.body.textContent.replace(/\n{3,}/g, "\n\n").trim();
}
const list = (s) =>
	s
		.split(",")
		.map((x) => x.trim())
		.filter(Boolean)
		.join(", ");

async function send() {
	sending.value = true;
	error.value = "";
	try {
		await call("frappe.core.doctype.communication.email.make", {
			doctype: props.form.doctype,
			name: props.form.doc.name,
			recipients: list(draft.to),
			cc: list(draft.cc) || undefined,
			bcc: list(draft.bcc) || undefined,
			subject: draft.subject,
			content: textToHtml(draft.message),
			send_email: 1,
			print_format: draft.attachPrint ? draft.printFormat || "Standard" : undefined,
			attachments: draft.files,
			send_me_a_copy: draft.copyMe ? 1 : 0,
			read_receipt: draft.readReceipt ? 1 : 0,
			email_template: template.value || undefined,
		});
		open.value = false;
		await props.form.reloadDoc();
	} catch (e) {
		error.value = messageOf(e, "The email wasn't sent.");
	} finally {
		sending.value = false;
	}
}
</script>
