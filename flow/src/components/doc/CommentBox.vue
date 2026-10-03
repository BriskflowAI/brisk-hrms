<template>
	<div class="relative flex flex-col gap-1.5">
		<label class="sr-only" :for="id">{{ placeholder }}</label>
		<textarea
			:id="id"
			ref="input"
			v-model="text"
			:rows="rows"
			:placeholder="placeholder"
			class="w-full rounded-lg border border-line bg-surf px-2.5 py-1.5 text-[13px] focus:border-acc focus:ring-1 focus:ring-acc"
			@input="detect"
			@click="detect"
			@keydown.down="people.length && (move(1), $event.preventDefault())"
			@keydown.up="people.length && (move(-1), $event.preventDefault())"
			@keydown.enter="onEnter"
			@keydown.esc="people = []"
			@blur="closePeople"
		/>
		<ul
			v-if="people.length"
			role="listbox"
			:aria-label="__('People to mention')"
			class="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-lg border border-line bg-surf py-1 shadow-xl"
		>
			<li
				v-for="(p, i) in people"
				:key="p.id"
				role="option"
				:aria-selected="i === cursor"
				class="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-[13px]"
				:class="i === cursor && 'bg-acc-tint'"
				@mousedown.prevent="mention(p)"
			>
				<Avatar :label="p.value" :size="20" />
				<span class="font-semibold">{{ p.value }}</span>
				<span v-if="p.is_group" class="text-[11.5px] text-mut">{{ __("group") }}</span>
			</li>
		</ul>
		<div v-if="text.trim() || cancellable" class="flex gap-2">
			<button
				type="button"
				class="btn-ghost h-8 px-3 text-[13px]"
				:disabled="!text.trim()"
				@click="submit"
			>
				{{ cta }}
			</button>
			<button
				v-if="cancellable"
				type="button"
				class="h-8 px-2 text-[13px] text-mut hover:text-ink"
				@click="$emit('cancel')"
			>
				{{ __("Cancel") }}
			</button>
			<span v-else class="self-center text-[11.5px] text-mut">{{
				__("Type @ to mention someone")
			}}</span>
		</div>
	</div>
</template>

<script setup>
import { call } from "frappe-ui";
import { onMounted, ref } from "vue";
import Avatar from "@/components/Avatar.vue";

const props = defineProps({
	initial: { type: String, default: "" }, // HTML of a comment being edited
	placeholder: { type: String, default: "Add a comment" },
	cta: { type: String, default: "Comment" },
	rows: { type: Number, default: 2 },
	cancellable: { type: Boolean, default: false },
});
const emit = defineEmits(["submit", "cancel"]);

const id = `comment-${Math.random().toString(36).slice(2, 8)}`;
const input = ref(null);
const text = ref("");
const people = ref([]);
const cursor = ref(0);
const known = new Map(); // "Full Name" -> mention data, for the names picked or already in the comment
let query = null; // { start, term } of the @word being typed

onMounted(() => {
	if (!props.initial) return;
	const doc = new DOMParser().parseFromString(props.initial, "text/html");
	for (const m of doc.querySelectorAll(".mention"))
		known.set(m.dataset.value, {
			id: m.dataset.id,
			value: m.dataset.value,
			is_group: m.dataset.isGroup === "true",
		});
	for (const br of doc.querySelectorAll("br")) br.replaceWith("\n");
	for (const p of doc.querySelectorAll("p")) p.append("\n");
	text.value = doc.body.textContent.replace(/\n+$/, "");
	input.value?.focus();
});

let timer;
function detect() {
	const el = input.value;
	const upto = text.value.slice(0, el.selectionStart);
	const m = upto.match(/(?:^|\s)@([^\s@]{0,30})$/);
	if (!m) {
		query = null;
		people.value = [];
		return;
	}
	query = { start: el.selectionStart - m[1].length - 1, term: m[1] };
	clearTimeout(timer);
	timer = setTimeout(async () => {
		const term = query?.term;
		if (!term) {
			people.value = [];
			return;
		}
		const res = await call("frappe.desk.search.get_names_for_mentions", {
			search_term: term,
		}).catch(() => []);
		people.value = res || [];
		cursor.value = 0;
	}, 150);
}

function closePeople() {
	setTimeout(() => (people.value = []), 150);
}

function move(step) {
	const n = people.value.length;
	cursor.value = (cursor.value + step + n) % n;
}

function onEnter(e) {
	if (!people.value.length) return;
	e.preventDefault();
	mention(people.value[cursor.value]);
}

function mention(p) {
	if (!query) return;
	known.set(p.value, p);
	const end = query.start + 1 + query.term.length;
	text.value = `${text.value.slice(0, query.start)}@${p.value} ${text.value.slice(end)}`;
	const caret = query.start + p.value.length + 2;
	people.value = [];
	query = null;
	requestAnimationFrame(() => {
		input.value.focus();
		input.value.setSelectionRange(caret, caret);
	});
}

const escape = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttr = (t) => escape(String(t)).replace(/"/g, "&quot;");

// Mentions become the same markup the desk's comment box makes, so Frappe notifies people.
function toHtml(raw) {
	let html = escape(raw);
	const names = [...known.keys()].sort((a, b) => b.length - a.length);
	for (const name of names) {
		const p = known.get(name);
		const span = `<span class="mention" data-id="${escapeAttr(p.id)}" data-value="${escapeAttr(
			p.value,
		)}" data-denotation-char="@"${p.is_group ? ' data-is-group="true"' : ""}>@${escape(p.value)}</span>`;
		html = html.split(`@${escape(name)}`).join(span);
	}
	return `<div>${html.replace(/\n/g, "<br>")}</div>`;
}

function submit() {
	const raw = text.value.trim();
	if (!raw) return;
	emit("submit", toHtml(raw), () => (text.value = ""));
}

defineExpose({ clear: () => (text.value = "") });
</script>
