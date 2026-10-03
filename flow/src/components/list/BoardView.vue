<template>
	<!-- Kanban boards are Frappe "Kanban Board" records, shared with the classic desk. -->
	<section :aria-label="__('Board')" class="flex flex-col gap-3">
		<div class="flex flex-wrap items-center gap-2">
			<select
				v-if="boards.length"
				v-model="boardName"
				:aria-label="__('Board')"
				class="h-9 rounded-lg border border-line bg-surf py-0 pl-2.5 pr-8 text-[13.5px] font-semibold"
			>
				<option v-for="b in boards" :key="b.name" :value="b.name">{{ b.name }}</option>
			</select>
			<form
				v-if="creating || (!boards.length && !loading)"
				class="flex flex-wrap items-center gap-2"
				@submit.prevent="createBoard"
			>
				<span class="text-[13px] text-ink-2">{{ __("New board by") }}</span>
				<select
					v-model="draft.field"
					:aria-label="__('Group cards by')"
					class="h-9 rounded-lg border border-line bg-surf py-0 pl-2.5 pr-8 text-[13.5px]"
				>
					<option v-for="f in selectFields" :key="f.fieldname" :value="f.fieldname">
						{{ f.label }}
					</option>
				</select>
				<input
					v-model="draft.name"
					type="text"
					:aria-label="__('Board name')"
					:placeholder="__('Board name')"
					class="h-9 rounded-lg border border-line bg-surf px-2.5 text-[13.5px]"
				/>
				<button
					type="submit"
					class="btn-ink h-9"
					:disabled="!draft.field || !draft.name.trim()"
				>
					{{ __("Create board") }}
				</button>
				<button
					v-if="boards.length"
					type="button"
					class="btn-ghost h-9"
					@click="creating = false"
				>
					{{ __("Cancel") }}
				</button>
			</form>
			<button v-else type="button" class="btn-ghost h-9" @click="startCreate">
				{{ __("New board") }}
			</button>
			<span v-if="board" class="ml-auto text-[12.5px] text-mut"
				>{{ __("Cards grouped by") }} {{ fieldLabel
				}}{{ __(". Drag a card to change it.") }}</span
			>
		</div>
		<p v-if="!selectFields.length" class="text-[13.5px] text-mut">
			{{ doctype }} {{ __("has no choice fields to make a board from.") }}{{ " " }}
		</p>
		<p
			v-if="error"
			role="alert"
			class="rounded-lg bg-neg-tint px-4 py-2.5 text-[13.5px] text-neg"
		>
			{{ error }}
		</p>

		<div v-if="board" class="flex gap-3 overflow-x-auto pb-2">
			<section
				v-for="col in columns"
				:key="col.name"
				:aria-label="col.name"
				class="flex w-[280px] shrink-0 flex-col rounded-xl border bg-side/60 transition-colors"
				:class="dragOver === col.name ? 'border-acc bg-acc-tint/40' : 'border-line'"
				@dragover.prevent="dragOver = col.name"
				@dragleave="dragOver === col.name && (dragOver = null)"
				@drop.prevent="drop(col)"
			>
				<header class="flex items-center gap-2 px-3 py-2.5">
					<span class="h-2 w-2 rounded-full" :class="dot(col.indicator)" />
					<span class="flex-grow truncate text-[13.5px] font-bold">{{ col.name }}</span>
					<span class="text-[12px] tabular-nums text-mut">{{ col.total }}</span>
				</header>
				<ol class="flex min-h-[60px] flex-col gap-2 px-2 pb-2">
					<li
						v-for="c in col.cards"
						:key="c.name"
						:draggable="canWrite"
						class="cursor-grab rounded-lg border border-line bg-surf px-3 py-2.5 shadow-[0_1px_0_rgba(11,16,32,0.04)] active:cursor-grabbing"
						:class="dragging?.name === c.name && 'opacity-40'"
						@dragstart="dragging = { ...c, from: col.name }"
						@dragend="((dragging = null), (dragOver = null))"
					>
						<router-link
							:to="{ name: 'Form', params: { doctype, name: c.name } }"
							class="block text-[13.5px] font-semibold hover:text-acc"
							>{{ c[titleKey] || c.name }}</router-link
						>
						<div
							v-if="c[titleKey] && c[titleKey] !== c.name"
							class="mt-0.5 text-[11.5px] text-mut"
						>
							{{ c.name }}
						</div>
						<dl v-if="extra.length" class="mt-1.5 flex flex-col gap-0.5 text-[12px]">
							<div v-for="f in extra" :key="f.fieldname" class="flex gap-1.5">
								<dt class="text-mut">{{ f.label }}</dt>
								<dd class="truncate text-ink-2">
									<FieldValue :field="f" :value="c[f.fieldname]" />
								</dd>
							</div>
						</dl>
					</li>
					<li v-if="col.cards.length < col.total" class="px-1">
						<button
							type="button"
							class="text-[12.5px] font-semibold text-acc"
							@click="more(col)"
						>
							{{ " " }}{{ __("Show") }}
							{{ Math.min(50, col.total - col.cards.length) }} {{ __("more")
							}}{{ " " }}
						</button>
					</li>
				</ol>
			</section>
		</div>
	</section>
</template>

<script setup>
import { call } from "frappe-ui";
import { computed, reactive, ref, watch } from "vue";
import FieldValue from "@/components/FieldValue.vue";
import { listFields, titleField } from "@/composables/api";
import { messageOf } from "@/engine/form";

const props = defineProps({
	doctype: { type: String, required: true },
	meta: { type: Object, required: true },
	filters: { type: Array, required: true },
	canWrite: { type: Boolean, default: false },
});

const KB = "frappe.desk.doctype.kanban_board.kanban_board";
const boards = ref([]);
const boardName = ref("");
const board = ref(null);
const columns = ref([]);
const loading = ref(true);
const error = ref("");
const creating = ref(false);
const draft = reactive({ field: "", name: "" });
const dragging = ref(null);
const dragOver = ref(null);

const selectFields = computed(() =>
	props.meta.fields.filter((f) => f.fieldtype === "Select" && f.options && !f.hidden),
);
const titleKey = computed(() => titleField(props.meta) || "name");
const fieldLabel = computed(
	() => props.meta.fields.find((f) => f.fieldname === board.value?.field_name)?.label || "",
);
const extra = computed(() =>
	listFields(props.meta)
		.filter((f) => ![titleKey.value, board.value?.field_name].includes(f.fieldname))
		.slice(0, 3),
);
const dot = (c) =>
	({
		Green: "bg-pos",
		Red: "bg-neg",
		Orange: "bg-warn",
		Yellow: "bg-warn",
		Blue: "bg-acc",
		Purple: "bg-[#6A3BD0]",
		Pink: "bg-[#B8286E]",
	})[c] || "bg-line";

async function loadBoards() {
	loading.value = true;
	try {
		boards.value = (await call(`${KB}.get_kanban_boards`, { doctype: props.doctype })) || [];
		const saved = localStorage.getItem(`briskrew:board:${props.doctype}`);
		boardName.value =
			boards.value.find((b) => b.name === saved)?.name || boards.value[0]?.name || "";
		draft.field =
			selectFields.value.find((f) => f.fieldname === "status")?.fieldname ||
			selectFields.value[0]?.fieldname ||
			"";
		if (!boardName.value) loading.value = false;
	} catch (e) {
		error.value = messageOf(e, "Couldn't load boards.");
		loading.value = false;
	}
}

const fieldsToGet = () =>
	[
		...new Set([
			"name",
			"modified",
			titleKey.value,
			board.value.field_name,
			...extra.value.map((f) => f.fieldname),
		]),
	].filter(Boolean);
const columnFilters = (col) => [
	...props.filters,
	...boardFilters(),
	[props.doctype, board.value.field_name, "=", col.name],
];
function boardFilters() {
	try {
		return JSON.parse(board.value?.filters || "[]") || [];
	} catch {
		return [];
	}
}

async function loadBoard() {
	if (!boardName.value) return;
	loading.value = true;
	error.value = "";
	try {
		try {
			localStorage.setItem(`briskrew:board:${props.doctype}`, boardName.value);
		} catch {
			/* private mode */
		}
		board.value = await call("frappe.client.get", {
			doctype: "Kanban Board",
			name: boardName.value,
		});
		const active = (board.value.columns || []).filter((c) => c.status !== "Archived");
		columns.value = await Promise.all(
			active.map(async (c) => {
				const col = {
					name: c.column_name,
					indicator: c.indicator,
					order: parseOrder(c.order),
					cards: [],
					total: 0,
				};
				const [cards, total] = await Promise.all([
					call("frappe.client.get_list", {
						doctype: props.doctype,
						fields: fieldsToGet(),
						filters: columnFilters(col),
						order_by: "modified desc",
						limit_page_length: 50,
					}),
					call("frappe.client.get_count", {
						doctype: props.doctype,
						filters: columnFilters(col),
					}),
				]);
				col.cards = sortByOrder(cards || [], col.order);
				col.total = total || 0;
				return col;
			}),
		);
	} catch (e) {
		error.value = messageOf(e, "Couldn't load this board.");
	} finally {
		loading.value = false;
	}
}

function parseOrder(o) {
	try {
		return JSON.parse(o || "[]") || [];
	} catch {
		return [];
	}
}
// Cards keep the order people dragged them into; new ones go first.
function sortByOrder(cards, order) {
	const pos = new Map(order.map((n, i) => [n, i]));
	return [...cards].sort((a, b) => (pos.get(a.name) ?? -1) - (pos.get(b.name) ?? -1));
}

async function more(col) {
	const next = await call("frappe.client.get_list", {
		doctype: props.doctype,
		fields: fieldsToGet(),
		filters: columnFilters(col),
		order_by: "modified desc",
		limit_start: col.cards.length,
		limit_page_length: 50,
	}).catch(() => []);
	col.cards.push(...(next || []));
}

async function drop(to) {
	dragOver.value = null;
	const card = dragging.value;
	dragging.value = null;
	if (!card || card.from === to.name) return;
	const from = columns.value.find((c) => c.name === card.from);
	const moving = from.cards.find((c) => c.name === card.name);
	from.cards = from.cards.filter((c) => c.name !== card.name);
	from.total -= 1;
	to.cards = [{ ...moving, [board.value.field_name]: to.name }, ...to.cards];
	to.total += 1;
	try {
		await call(`${KB}.update_order_for_single_card`, {
			board_name: board.value.name,
			docname: card.name,
			from_colname: from.name,
			to_colname: to.name,
			from_order: JSON.stringify(from.cards.map((c) => c.name)),
			to_order: JSON.stringify(to.cards.map((c) => c.name)),
		});
	} catch (e) {
		error.value = messageOf(e, `Couldn't move ${card.name}.`);
		await loadBoard();
	}
}

function startCreate() {
	creating.value = true;
	draft.name = "";
}
async function createBoard() {
	try {
		const doc = await call(`${KB}.quick_kanban_board`, {
			doctype: props.doctype,
			board_name: draft.name.trim(),
			field_name: draft.field,
		});
		creating.value = false;
		await loadBoards();
		boardName.value = doc?.name || draft.name.trim();
	} catch (e) {
		error.value = messageOf(e, "Couldn't create the board.");
	}
}

watch(boardName, loadBoard);
watch(() => JSON.stringify(props.filters), loadBoard);
loadBoards();
</script>
