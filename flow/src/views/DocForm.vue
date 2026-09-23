<template>
	<div class="flex flex-col">
		<p v-if="error" class="m-7 rounded-lg bg-neg-tint px-4 py-3 text-[13.5px] text-neg">
			{{ error }}
		</p>

		<template v-else-if="doc && meta">
			<header class="flex flex-col gap-4 border-b border-line bg-surf px-7 pt-6">
				<div class="flex items-end gap-3">
					<Avatar v-if="doctype === 'Employee'" :label="title" :size="56" />
					<div class="min-w-0 flex-grow">
						<div class="kicker">{{ doctype }}</div>
						<h1 class="mt-1.5 truncate text-[32px] leading-none">{{ title }}</h1>
						<div v-if="title !== doc.name" class="mt-1.5 text-[13px] text-mut">
							{{ doc.name }}
						</div>
					</div>
					<StatusChip :doc="doc" />
					<a :href="classicUrl(doctype, doc.name)" class="btn-ghost">
						<Icon name="ext" :size="15" />
						Actions in classic desk
					</a>
					<button
						v-if="editable"
						type="button"
						class="btn-ink"
						:disabled="!dirty || saving"
						:class="!dirty && 'opacity-50'"
						@click="save"
					>
						{{ saving ? "Saving…" : "Save" }}
					</button>
				</div>
				<nav v-if="tabs.length > 1" aria-label="Sections" class="flex gap-6 text-[14px]">
					<button
						v-for="(t, i) in tabs"
						:key="t.label"
						type="button"
						class="-mb-px border-b-2 py-2.5"
						:class="
							i === tab
								? 'border-ink font-bold text-ink'
								: 'border-transparent text-ink-2 hover:text-ink'
						"
						@click="tab = i"
					>
						{{ t.label }}
					</button>
				</nav>
				<div v-else class="h-1" />
			</header>

			<div
				v-if="notice"
				class="mx-7 mt-5 flex items-center gap-2 rounded-lg bg-warn-tint px-4 py-2.5 text-[13px] text-warn"
			>
				<Icon name="alert" :size="15" />
				{{ notice }}
			</div>
			<p
				v-if="saveError"
				class="mx-7 mt-5 rounded-lg bg-neg-tint px-4 py-2.5 text-[13px] text-neg"
			>
				{{ saveError }}
			</p>

			<div class="flex max-w-[1100px] flex-col gap-5 px-7 py-6">
				<section
					v-for="(s, si) in tabs[tab]?.sections || []"
					:key="si"
					class="rounded-xl border border-line bg-surf px-5 py-4"
				>
					<h2 v-if="s.label" class="mb-3 text-[17px]">{{ s.label }}</h2>
					<div
						class="grid gap-x-8"
						:style="{
							gridTemplateColumns: `repeat(${s.columns.length}, minmax(0, 1fr))`,
						}"
					>
						<div
							v-for="(col, ci) in s.columns"
							:key="ci"
							class="flex min-w-0 flex-col"
						>
							<div
								v-for="f in col"
								:key="f.fieldname"
								class="border-b border-line-2 py-2 last:border-0"
							>
								<template v-if="isTable(f)">
									<div class="mb-2 text-[12.5px] font-semibold text-mut">
										{{ f.label }}
									</div>
									<ChildTable
										:field="f"
										:rows="doc[f.fieldname] || []"
										:meta="byName[f.options]"
									/>
								</template>
								<label
									v-else
									class="grid grid-cols-[minmax(120px,40%)_minmax(0,1fr)] items-baseline gap-3"
								>
									<span class="text-[13px] text-mut">
										{{ f.label
										}}<span
											v-if="f.reqd"
											class="text-neg"
											aria-label="required"
											>*</span
										>
									</span>
									<FieldInput
										v-if="canEdit(f)"
										v-model="doc[f.fieldname]"
										:field="f"
										@update:model-value="dirty = true"
									/>
									<span v-else class="min-w-0 break-words text-[14px]"
										><FieldValue :field="f" :value="doc[f.fieldname]"
									/></span>
								</label>
							</div>
						</div>
					</div>
				</section>
			</div>
		</template>

		<div v-else class="px-7 py-10 text-[13.5px] text-mut">Loading…</div>
	</div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import Icon from "@/components/Icon.vue";
import Avatar from "@/components/Avatar.vue";
import FieldValue from "@/components/FieldValue.vue";
import FieldInput from "@/components/FieldInput.vue";
import ChildTable from "@/components/ChildTable.vue";
import StatusChip from "@/components/StatusChip.vue";
import { getDoc, getMeta, isLayout, isTable, saveDoc, titleField } from "@/composables/api";
import { classicUrl } from "@/nav";

const props = defineProps({
	doctype: { type: String, required: true },
	name: { type: String, required: true },
});

const meta = ref(null);
const byName = ref({});
const doc = ref(null);
const error = ref("");
const saveError = ref("");
const tab = ref(0);
const dirty = ref(false);
const saving = ref(false);

// Field types the generic form edits in place. Everything else is shown read-only
// and edited in the classic desk until it gets a proper control here.
const EDITABLE = new Set([
	"Data",
	"Small Text",
	"Text",
	"Long Text",
	"Select",
	"Int",
	"Float",
	"Currency",
	"Percent",
	"Date",
	"Check",
	"Link",
	"Phone",
]);

const title = computed(
	() => (meta.value && doc.value && doc.value[titleField(meta.value)]) || doc.value?.name,
);
const editable = computed(() => doc.value?.docstatus === 0 && meta.value && !meta.value.read_only);
const canEdit = (f) =>
	editable.value && EDITABLE.has(f.fieldtype) && !f.read_only && !f.fetch_from;

const notice = computed(() => {
	if (!meta.value || !doc.value) return "";
	if (meta.value.is_submittable && doc.value.docstatus === 0)
		return "Submitting, and any buttons this form has in the classic desk, are one click away under “Actions in classic desk”.";
	if (doc.value.docstatus === 1)
		return "This record is submitted, so it's locked. Cancel or amend it from the classic desk.";
	if (doc.value.docstatus === 2) return "This record is cancelled.";
	return "";
});

const visible = (f) => {
	if (f.hidden) return false;
	if (isLayout(f)) return true;
	const v = doc.value?.[f.fieldname];
	const has = !(v === null || v === undefined || v === "" || (Array.isArray(v) && !v.length));
	// Conditional fields only appear once they hold a value; the classic desk evaluates the full rules.
	if (f.depends_on) return has;
	return has || (editable.value && EDITABLE.has(f.fieldtype) && !f.read_only);
};

const tabs = computed(() => {
	if (!meta.value) return [];
	const out = [];
	let t = { label: "Details", sections: [] };
	let s = { label: "", columns: [[]] };
	const pushSection = () => {
		const cols = s.columns.filter((c) => c.length);
		if (cols.length) t.sections.push({ ...s, columns: cols });
	};
	for (const f of meta.value.fields) {
		if (f.fieldtype === "Tab Break") {
			pushSection();
			if (t.sections.length) out.push(t);
			t = { label: f.label || "More", sections: [] };
			s = { label: "", columns: [[]] };
		} else if (f.fieldtype === "Section Break") {
			pushSection();
			s = { label: f.label || "", columns: [[]] };
		} else if (f.fieldtype === "Column Break") {
			s.columns.push([]);
		} else if (!isLayout(f) && visible(f)) {
			s.columns[s.columns.length - 1].push(f);
		}
	}
	pushSection();
	if (t.sections.length) out.push(t);
	return out;
});

async function load() {
	try {
		const [m, d] = await Promise.all([
			getMeta(props.doctype),
			getDoc(props.doctype, props.name),
		]);
		meta.value = m.meta;
		byName.value = m.byName;
		doc.value = d;
	} catch (e) {
		error.value =
			e?.messages?.join(" ") ||
			e?.message ||
			`Couldn't open ${props.doctype} ${props.name}.`;
	}
}

async function save() {
	saving.value = true;
	saveError.value = "";
	try {
		doc.value = await saveDoc(doc.value);
		dirty.value = false;
	} catch (e) {
		saveError.value =
			e?.messages?.join(" ") || e?.message || "Couldn't save. Nothing was changed.";
	} finally {
		saving.value = false;
	}
}

onMounted(load);
</script>
