<template>
	<!-- The desk's Image view: a card per record with its picture, for types that have one. -->
	<section aria-label="Image view" class="flex flex-col gap-3">
		<p
			v-if="error"
			role="alert"
			class="rounded-lg bg-neg-tint px-4 py-2.5 text-[13.5px] text-neg"
		>
			{{ error }}
		</p>
		<ul class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
			<li v-for="r in rows" :key="r.name">
				<router-link
					:to="{ name: 'Form', params: { doctype, name: r.name } }"
					class="flex flex-col overflow-hidden rounded-xl border border-line bg-surf transition-colors hover:border-acc/50"
				>
					<div class="flex aspect-square items-center justify-center bg-side">
						<img
							v-if="r[imageField] && !broken.has(r.name)"
							:src="r[imageField]"
							:alt="r[titleKey] || r.name"
							loading="lazy"
							class="h-full w-full object-cover"
							@error="broken.add(r.name)"
						/>
						<Avatar v-else :label="r[titleKey] || r.name" :size="72" />
					</div>
					<div class="px-3 py-2.5">
						<div class="truncate text-[13.5px] font-semibold">
							{{ r[titleKey] || r.name }}
						</div>
						<div class="truncate text-[12px] text-mut">{{ r.name }}</div>
					</div>
				</router-link>
			</li>
		</ul>
		<div v-if="loading" class="py-6 text-center text-[13px] text-mut">Loading…</div>
		<p v-else-if="!rows.length" class="py-10 text-center text-[13.5px] text-mut">
			Nothing to show for these filters.
		</p>
		<button
			v-if="!loading && rows.length && !done"
			type="button"
			class="btn-ghost self-center"
			@click="load(true)"
		>
			Load more
		</button>
	</section>
</template>

<script setup>
import { call } from "frappe-ui";
import { computed, reactive, ref, watch } from "vue";
import Avatar from "@/components/Avatar.vue";
import { titleField } from "@/composables/api";
import { messageOf } from "@/engine/form";

const props = defineProps({
	doctype: { type: String, required: true },
	meta: { type: Object, required: true },
	filters: { type: Array, required: true },
});

const pageLength = 48;
const rows = ref([]);
const loading = ref(false);
const done = ref(false);
const error = ref("");
const broken = reactive(new Set());
const imageField = computed(() => props.meta.image_field);
const titleKey = computed(() => titleField(props.meta) || "name");

async function load(more = false) {
	loading.value = true;
	error.value = "";
	try {
		const page = await call("frappe.client.get_list", {
			doctype: props.doctype,
			fields: [...new Set(["name", imageField.value, titleKey.value])],
			filters: props.filters,
			order_by: "modified desc",
			limit_start: more ? rows.value.length : 0,
			limit_page_length: pageLength,
		});
		rows.value = more ? [...rows.value, ...(page || [])] : page || [];
		done.value = (page || []).length < pageLength;
	} catch (e) {
		error.value = messageOf(e, "Couldn't load the pictures.");
	} finally {
		loading.value = false;
	}
}
watch(
	() => JSON.stringify(props.filters),
	() => load(),
	{ immediate: true },
);
</script>
