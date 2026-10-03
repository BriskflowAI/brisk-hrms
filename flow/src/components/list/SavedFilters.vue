<template>
	<!-- Saved filters are Frappe "List Filter" records, so they're shared with the classic desk. -->
	<Dropdown :label="__('Saved')" icon="star" :width="'w-[300px]'" @click.capture="load">
		<template #default="{ close }">
			<div v-if="loading" class="px-3 py-2 text-[13px] text-mut">{{ __("Loading…") }}</div>
			<div v-else-if="!saved.length" class="px-3 py-2 text-[13px] text-mut">
				{{ __("No saved filters yet.") }}
			</div>
			<div
				v-for="s in saved"
				:key="s.name"
				class="group flex items-center gap-1 pr-2 hover:bg-acc-tint"
			>
				<button
					type="button"
					class="min-w-0 flex-grow truncate px-3 py-1.5 text-left text-[13.5px]"
					@click="(apply(s), close())"
				>
					{{ s.filter_name }}
					<span v-if="!s.for_user" class="text-[11.5px] text-mut">{{
						__("· everyone")
					}}</span>
				</button>
				<button
					v-if="s.owner === user || s.for_user === user"
					type="button"
					class="text-mut opacity-0 hover:text-neg group-hover:opacity-100 focus:opacity-100"
					:aria-label="`Delete saved filter ${s.filter_name}`"
					@click="remove(s)"
				>
					✕
				</button>
			</div>
			<form
				v-if="filters.length"
				class="mt-1 flex flex-col gap-2 border-t border-line-2 px-3 pb-2 pt-2.5"
				@submit.prevent="save"
			>
				<label class="text-[12px] font-semibold text-ink-2" for="saved-filter-name">{{
					__("Save the current filters")
				}}</label>
				<input
					id="saved-filter-name"
					v-model="name"
					type="text"
					:placeholder="__('Name, e.g. Pending in Sales')"
					class="h-8 rounded-md border border-line bg-paper px-2 text-[13px]"
				/>
				<label class="flex items-center gap-2 text-[12.5px] text-ink-2">
					<input
						v-model="forEveryone"
						type="checkbox"
						class="rounded border-line text-acc"
					/>
					{{ __("Everyone can use it") }}{{ " " }}
				</label>
				<p v-if="error" class="text-[12px] text-neg">{{ error }}</p>
				<button type="submit" class="btn-ink h-8 self-end" :disabled="!name.trim()">
					{{ __("Save") }}
				</button>
			</form>
		</template>
	</Dropdown>
</template>

<script setup>
import { call } from "frappe-ui";
import { ref } from "vue";
import Dropdown from "./Dropdown.vue";
import { useSession } from "@/composables/session";
import { messageOf } from "@/engine/form";

const props = defineProps({
	doctype: { type: String, required: true },
	filters: { type: Array, required: true }, // [{ field, op, value }]
});
const emit = defineEmits(["apply"]);
const { user } = useSession();

const saved = ref([]);
const loading = ref(false);
const name = ref("");
const forEveryone = ref(false);
const error = ref("");

async function load() {
	loading.value = true;
	try {
		saved.value =
			(await call("frappe.client.get_list", {
				doctype: "List Filter",
				fields: ["name", "filter_name", "for_user", "filters", "owner"],
				filters: { reference_doctype: props.doctype },
				or_filters: [
					["for_user", "=", user],
					["for_user", "is", "not set"],
				],
				order_by: "filter_name asc",
				limit_page_length: 100,
			})) || [];
	} catch {
		saved.value = [];
	} finally {
		loading.value = false;
	}
}

// Stored the way the desk stores them: [doctype, field, operator, value].
const toTuple = (f) =>
	f.op === "is set" || f.op === "is not set"
		? [props.doctype, f.field, "is", f.op === "is set" ? "set" : "not set"]
		: [props.doctype, f.field, f.op, f.value];
const fromTuple = (t) => {
	const [field, op, value] = t.length === 4 ? t.slice(1) : t;
	if (op === "is") return { field, op: value === "set" ? "is set" : "is not set", value: "" };
	return { field, op, value };
};

function apply(s) {
	let tuples = [];
	try {
		tuples = JSON.parse(s.filters || "[]");
	} catch {
		/* unreadable */
	}
	emit("apply", tuples.map(fromTuple));
}

async function save() {
	error.value = "";
	try {
		await call("frappe.client.insert", {
			doc: {
				doctype: "List Filter",
				filter_name: name.value.trim(),
				reference_doctype: props.doctype,
				for_user: forEveryone.value ? "" : user,
				filters: JSON.stringify(props.filters.map(toTuple)),
			},
		});
		name.value = "";
		forEveryone.value = false;
		await load();
	} catch (e) {
		error.value = messageOf(e, "Couldn't save these filters.");
	}
}

async function remove(s) {
	await call("frappe.client.delete", { doctype: "List Filter", name: s.name }).catch(() => {});
	await load();
}
</script>
