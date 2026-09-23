<template>
	<div class="flex flex-col gap-4 px-7 py-6">
		<header class="flex items-end gap-3">
			<div class="flex-grow">
				<div class="kicker">{{ area?.label || meta?.module }}</div>
				<h1 class="mt-1.5 text-[34px] leading-none">{{ label }}</h1>
			</div>
			<a :href="classicUrl(doctype)" class="btn-ghost">
				<Icon name="ext" :size="15" />
				Open in classic desk
			</a>
			<a v-if="canCreate" :href="`${classicUrl(doctype)}/new`" class="btn-ink">
				<Icon name="plus" :size="15" />
				New {{ singular }}
			</a>
		</header>

		<div class="flex items-center gap-3">
			<label
				class="flex h-9 w-[320px] items-center gap-2 rounded-lg border border-line bg-surf px-2.5"
			>
				<Icon name="search" :size="15" class="text-mut" />
				<input
					v-model="search"
					type="text"
					:aria-label="`Search ${label}`"
					:placeholder="`Search ${label.toLowerCase()}…`"
					class="h-full flex-grow border-0 bg-transparent p-0 text-[13.5px] focus:ring-0"
				/>
			</label>
			<span class="text-[13px] text-mut tabular-nums">
				{{ total === null ? "" : `${rows.length} of ${total}` }}
			</span>
		</div>

		<p v-if="error" class="rounded-lg bg-neg-tint px-4 py-3 text-[13.5px] text-neg">
			{{ error }}
		</p>

		<div v-else class="overflow-hidden rounded-xl border border-line bg-surf">
			<table class="w-full border-collapse">
				<thead>
					<tr>
						<th :class="th">{{ titleLabel }}</th>
						<th
							v-for="f in columns"
							:key="f.fieldname"
							:class="[th, isNum(f) && 'text-right']"
						>
							{{ f.label }}
						</th>
						<th :class="th">Status</th>
					</tr>
				</thead>
				<tbody>
					<tr
						v-for="row in rows"
						:key="row.name"
						tabindex="0"
						class="cursor-pointer border-t border-line-2 hover:bg-paper focus:bg-acc-tint focus:outline-none"
						@click="open(row)"
						@keydown.enter="open(row)"
					>
						<td class="px-3.5 py-2.5 text-[13.5px]">
							<span class="flex items-center gap-2.5">
								<Avatar
									v-if="doctype === 'Employee' || row.employee_name"
									:label="row[titleKey] || row.name"
									:size="26"
								/>
								<span class="font-semibold">{{ row[titleKey] || row.name }}</span>
								<span
									v-if="titleKey && row[titleKey] && row[titleKey] !== row.name"
									class="text-[12px] text-mut"
									>{{ row.name }}</span
								>
							</span>
						</td>
						<td
							v-for="f in columns"
							:key="f.fieldname"
							class="px-3.5 py-2.5 text-[13.5px] text-ink-2"
							:class="isNum(f) && 'text-right'"
						>
							<FieldValue :field="f" :value="row[f.fieldname]" />
						</td>
						<td class="px-3.5 py-2.5"><StatusChip :doc="row" /></td>
					</tr>
				</tbody>
			</table>

			<div v-if="!loading && !rows.length" class="px-6 py-14 text-center">
				<p class="font-display text-[20px] font-bold">
					{{
						search
							? `No ${label.toLowerCase()} match “${search}”`
							: `No ${label.toLowerCase()} yet`
					}}
				</p>
				<p class="mt-2 text-[13.5px] text-mut">
					{{
						search
							? "Try a shorter search, or search by ID."
							: `Records you create here or in the classic desk show up in this list.`
					}}
				</p>
			</div>
			<div v-if="loading" class="px-6 py-6 text-center text-[13px] text-mut">Loading…</div>
		</div>

		<button
			v-if="!loading && total !== null && rows.length < total"
			type="button"
			class="btn-ghost self-center"
			@click="load(true)"
		>
			Load 30 more
		</button>
	</div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import Icon from "@/components/Icon.vue";
import Avatar from "@/components/Avatar.vue";
import FieldValue from "@/components/FieldValue.vue";
import StatusChip from "@/components/StatusChip.vue";
import { getMeta, getList, getCount, listFields, titleField } from "@/composables/api";
import { allNavItems, areaForDoctype, classicUrl } from "@/nav";

const props = defineProps({ doctype: { type: String, required: true } });
const router = useRouter();

const th =
	"px-3.5 py-2.5 text-left text-[11.5px] font-semibold uppercase tracking-[0.08em] text-mut";
const meta = ref(null);
const rows = ref([]);
const total = ref(null);
const loading = ref(true);
const error = ref("");
const search = ref("");

const area = computed(() => areaForDoctype(props.doctype));
const navItem = computed(() => allNavItems().find((i) => i.doctype === props.doctype));
const label = computed(() => navItem.value?.label || props.doctype);
const singular = computed(() => props.doctype.toLowerCase());
const columns = computed(() =>
	meta.value
		? listFields(meta.value).filter(
				(f) => f.fieldname !== titleKey.value && f.fieldname !== "status",
		  )
		: [],
);
const titleKey = computed(() => (meta.value ? titleField(meta.value) : null));
const titleLabel = computed(
	() => meta.value?.fields.find((f) => f.fieldname === titleKey.value)?.label || "ID",
);
const canCreate = computed(() => meta.value && !meta.value.issingle && !meta.value.istable);
const isNum = (f) => ["Currency", "Float", "Int", "Percent"].includes(f.fieldtype);

const filters = computed(() => {
	const q = search.value.trim();
	if (!q) return {};
	return titleKey.value
		? { [titleKey.value]: ["like", `%${q}%`] }
		: { name: ["like", `%${q}%`] };
});

async function load(more = false) {
	loading.value = true;
	error.value = "";
	try {
		if (!meta.value) meta.value = (await getMeta(props.doctype)).meta;
		if (meta.value.issingle) {
			router.replace({
				name: "Form",
				params: { doctype: props.doctype, name: props.doctype },
			});
			return;
		}
		const hasStatus = meta.value.fields.some((f) => f.fieldname === "status");
		const fields = [
			"name",
			"docstatus",
			titleKey.value,
			hasStatus && "status",
			...columns.value.map((f) => f.fieldname),
		].filter(Boolean);
		const [page, count] = await Promise.all([
			getList(props.doctype, {
				fields,
				filters: filters.value,
				start: more ? rows.value.length : 0,
				orderBy: "modified desc",
			}),
			more ? Promise.resolve(total.value) : getCount(props.doctype, filters.value),
		]);
		rows.value = more ? [...rows.value, ...page] : page;
		total.value = count;
	} catch (e) {
		error.value = errorText(e, `You may not have permission to see ${props.doctype}.`);
	} finally {
		loading.value = false;
	}
}

let timer;
watch(search, () => {
	clearTimeout(timer);
	timer = setTimeout(() => load(), 250);
});

function open(row) {
	router.push({ name: "Form", params: { doctype: props.doctype, name: row.name } });
}

function errorText(e, fallback) {
	return e?.messages?.join(" ") || e?.message || fallback;
}

onMounted(() => load());
</script>
