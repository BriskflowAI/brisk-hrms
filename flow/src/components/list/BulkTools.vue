<template>
	<!-- Assign, tag or print several records at once, with the desk's own endpoints. -->
	<div
		v-if="mode"
		class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/30 px-4 pt-[12vh]"
		@mousedown.self="close"
		@keydown.esc="close"
	>
		<form
			role="dialog"
			aria-modal="true"
			aria-labelledby="bulk-tools-title"
			class="mb-10 flex w-full max-w-[480px] flex-col gap-4 rounded-2xl border border-line bg-surf p-6 shadow-2xl"
			@submit.prevent="run"
		>
			<h2 id="bulk-tools-title" class="text-[21px]">{{ title }}</h2>

			<template v-if="mode === 'assign'">
				<div class="flex flex-col gap-1">
					<span class="text-[12.5px] font-semibold text-ink-2">{{ __("People") }}</span>
					<div v-if="assign.users.length" class="flex flex-wrap gap-1.5">
						<span
							v-for="u in assign.users"
							:key="u"
							class="chip gap-1 bg-acc-tint text-acc"
						>
							{{ u }}
							<button
								type="button"
								:aria-label="`Remove ${u}`"
								class="hover:text-neg"
								@click="assign.users = assign.users.filter((x) => x !== u)"
							>
								✕
							</button>
						</span>
					</div>
					<LinkInput
						:key="assign.users.length"
						doctype="User"
						:get-query="() => ({ filters: { enabled: 1, user_type: 'System User' } })"
						:label="__('Add a person')"
						:placeholder="__('Find a person…')"
						:input-class="cls"
						@update:model-value="
							(u) => u && !assign.users.includes(u) && assign.users.push(u)
						"
					/>
				</div>
				<div class="grid grid-cols-2 gap-3">
					<label class="flex flex-col gap-1">
						<span class="text-[12.5px] font-semibold text-ink-2">{{
							__("Due by")
						}}</span>
						<input v-model="assign.date" type="date" :class="cls" />
					</label>
					<label class="flex flex-col gap-1">
						<span class="text-[12.5px] font-semibold text-ink-2">{{
							__("Priority")
						}}</span>
						<select v-model="assign.priority" :class="cls">
							<option>{{ __("Low") }}</option>
							<option>{{ __("Medium") }}</option>
							<option>{{ __("High") }}</option>
						</select>
					</label>
				</div>
				<label class="flex flex-col gap-1">
					<span class="text-[12.5px] font-semibold text-ink-2">{{ __("Note") }}</span>
					<textarea v-model="assign.description" rows="2" :class="cls" />
				</label>
			</template>

			<template v-else-if="mode === 'tags'">
				<label class="flex flex-col gap-1">
					<span class="text-[12.5px] font-semibold text-ink-2">{{ __("Tags") }}</span>
					<input
						v-model="tags"
						type="text"
						:placeholder="__('urgent, q4 review')"
						:class="cls"
						autofocus
					/>
					<span class="text-[12px] text-mut">{{
						__("Separate tags with commas.")
					}}</span>
				</label>
			</template>

			<template v-else-if="mode === 'print'">
				<label class="flex flex-col gap-1">
					<span class="text-[12.5px] font-semibold text-ink-2">{{
						__("Print format")
					}}</span>
					<select v-model="print.format" :class="cls">
						<option value="">{{ __("Standard") }}</option>
						<option v-for="f in print.formats" :key="f" :value="f">{{ f }}</option>
					</select>
				</label>
				<label class="flex flex-col gap-1">
					<span class="text-[12.5px] font-semibold text-ink-2">{{
						__("Letter head")
					}}</span>
					<select v-model="print.letterhead" :class="cls">
						<option value="">{{ __("No letter head") }}</option>
						<option v-for="l in print.letterheads" :key="l" :value="l">{{ l }}</option>
					</select>
				</label>
				<p class="text-[12.5px] text-mut">
					{{ __("One PDF with every selected record.") }}
				</p>
			</template>

			<p
				v-if="error"
				role="alert"
				class="rounded-lg bg-neg-tint px-3 py-2 text-[13px] text-neg"
			>
				{{ error }}
			</p>
			<div class="flex justify-end gap-2">
				<button type="button" class="btn-ghost" @click="close">{{ __("Cancel") }}</button>
				<button type="submit" class="btn-ink" :disabled="busy || !ready">
					{{ busy ? "Working…" : cta }}
				</button>
			</div>
		</form>
	</div>
</template>

<script setup>
import { call } from "frappe-ui";
import { computed, reactive, ref, watch } from "vue";
import LinkInput from "@/components/fields/LinkInput.vue";
import { messageOf } from "@/engine/form";

const props = defineProps({
	doctype: { type: String, required: true },
	names: { type: Array, required: true },
});
const mode = defineModel({ type: String, default: null }); // assign | tags | print
const emit = defineEmits(["done"]);

const cls =
	"w-full rounded-lg border border-line bg-paper px-2.5 py-1.5 text-[14px] text-ink focus:border-acc focus:ring-1 focus:ring-acc";
const busy = ref(false);
const error = ref("");
const assign = reactive({ users: [], date: "", priority: "Medium", description: "" });
const tags = ref("");
const print = reactive({ format: "", letterhead: "", formats: [], letterheads: [] });

const n = computed(() => props.names.length);
const title = computed(
	() =>
		({
			assign: `Assign ${n.value} ${n.value === 1 ? "record" : "records"}`,
			tags: `Tag ${n.value} ${n.value === 1 ? "record" : "records"}`,
			print: `Print ${n.value} ${n.value === 1 ? "record" : "records"}`,
		})[mode.value],
);
const cta = computed(
	() => ({ assign: "Assign", tags: "Add tags", print: "Download PDF" })[mode.value],
);
const tagList = computed(() =>
	tags.value
		.split(",")
		.map((t) => t.trim())
		.filter(Boolean),
);
const ready = computed(
	() =>
		({ assign: assign.users.length > 0, tags: tagList.value.length > 0, print: true })[
			mode.value
		],
);

watch(mode, async (m) => {
	error.value = "";
	busy.value = false;
	if (m !== "print" || print.formats.length) return;
	const [formats, heads] = await Promise.all([
		call("frappe.client.get_list", {
			doctype: "Print Format",
			filters: { doc_type: props.doctype, disabled: 0 },
			pluck: "name",
			limit_page_length: 100,
		}).catch(() => []),
		call("frappe.client.get_list", {
			doctype: "Letter Head",
			filters: { disabled: 0 },
			fields: ["name", "is_default"],
			limit_page_length: 100,
		}).catch(() => []),
	]);
	print.formats = (formats || []).map((f) => f.name || f);
	print.letterheads = (heads || []).map((h) => h.name);
	print.letterhead = (heads || []).find((h) => h.is_default)?.name || "";
	const fallback = await call("frappe.client.get_value", {
		doctype: "Property Setter",
		filters: { doc_type: props.doctype, property: "default_print_format" },
		fieldname: "value",
	}).catch(() => null);
	if (fallback?.value && print.formats.includes(fallback.value)) print.format = fallback.value;
});

function close() {
	mode.value = null;
}

async function run() {
	busy.value = true;
	error.value = "";
	try {
		let message;
		if (mode.value === "assign") {
			await call("frappe.desk.form.assign_to.add_multiple", {
				doctype: props.doctype,
				name: JSON.stringify(props.names),
				assign_to: JSON.stringify(assign.users),
				date: assign.date || undefined,
				priority: assign.priority,
				description: assign.description || undefined,
				bulk_assign: true,
				re_assign: 0,
			});
			message = `Assigned ${n.value} to ${assign.users.join(", ")}.`;
			Object.assign(assign, { users: [], date: "", description: "" });
		} else if (mode.value === "tags") {
			await call("frappe.desk.doctype.tag.tag.add_tags", {
				tags: JSON.stringify(tagList.value),
				dt: props.doctype,
				docs: JSON.stringify(props.names),
			});
			message = `Tagged ${n.value} with ${tagList.value.join(", ")}.`;
			tags.value = "";
		} else {
			await downloadPdf();
			message = `Downloaded ${n.value} as one PDF.`;
		}
		mode.value = null;
		emit("done", message);
	} catch (e) {
		error.value = messageOf(e, "That didn't work. Nothing was changed.");
	} finally {
		busy.value = false;
	}
}

async function downloadPdf() {
	const body = new URLSearchParams({
		doctype: props.doctype,
		name: JSON.stringify(props.names),
		format: print.format || "Standard",
		no_letterhead: print.letterhead ? "0" : "1",
		letterhead: print.letterhead || "",
	});
	const res = await fetch("/api/method/frappe.utils.print_format.download_multi_pdf", {
		method: "POST",
		headers: { "X-Frappe-CSRF-Token": window.csrf_token || "" },
		body,
	});
	if (!res.ok) {
		const data = await res.json().catch(() => ({}));
		let messages = [];
		try {
			messages = JSON.parse(data._server_messages || "[]").map((m) => JSON.parse(m).message);
		} catch {
			/* no readable message */
		}
		throw { messages, message: data.exception || "Couldn't make the PDF." };
	}
	const blob = await res.blob();
	const a = document.createElement("a");
	a.href = URL.createObjectURL(blob);
	a.download = `${props.doctype}.pdf`;
	a.click();
	setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
</script>
