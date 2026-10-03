<template>
	<div class="flex flex-col gap-5 px-4 md:px-7 py-6">
		<header class="flex flex-wrap items-end gap-3">
			<div class="mr-auto">
				<div class="kicker">People</div>
				<h1 class="mt-1.5 text-[28px] leading-none md:text-[34px]">Org chart</h1>
			</div>
			<LinkInput
				class="w-[260px]"
				doctype="Employee"
				:get-query="
					() => ({ filters: { status: 'Active', ...(company ? { company } : {}) } })
				"
				label="Find a person"
				placeholder="Find a person…"
				input-class="h-9 w-full rounded-lg border border-line bg-surf px-2.5 text-[13.5px] focus:border-acc focus:ring-1 focus:ring-acc"
				@update:model-value="(e) => e && focus(e)"
			/>
			<select
				v-if="companies.length > 1"
				v-model="company"
				aria-label="Company"
				class="h-9 rounded-lg border border-line bg-surf py-0 pl-2.5 pr-8 text-[13.5px]"
			>
				<option v-for="c in companies" :key="c" :value="c">{{ c }}</option>
			</select>
		</header>

		<p
			v-if="error"
			role="alert"
			class="rounded-lg bg-neg-tint px-4 py-3 text-[13.5px] text-neg"
		>
			{{ error }}
		</p>

		<div v-if="loading && !rows.length" class="text-[13.5px] text-mut">Loading…</div>
		<p v-else-if="!rows[0]?.length" class="text-[13.5px] text-mut">
			No active employees in {{ company || "this company" }}.
		</p>

		<!-- One row per level: the people at the top, then the reports of whoever is picked. -->
		<section
			v-for="(row, level) in rows"
			:key="level"
			:aria-label="level ? `Reports to ${path[level - 1]?.name}` : 'Top of the organisation'"
			class="flex flex-col gap-2"
		>
			<div v-if="level" class="flex items-center gap-2 pl-1 text-[12.5px] text-mut">
				<span aria-hidden="true">↳</span>
				<span
					><b class="text-ink-2">{{ path[level - 1]?.name }}</b
					>'s team · {{ row.length }}</span
				>
			</div>
			<ul class="flex flex-wrap gap-2.5">
				<li v-for="p in row" :key="p.id">
					<button
						type="button"
						class="flex w-[236px] items-center gap-3 rounded-xl border bg-surf px-3.5 py-3 text-left transition-colors"
						:class="
							path[level]?.id === p.id
								? 'border-acc shadow-[inset_0_0_0_1px] shadow-acc'
								: 'border-line hover:border-acc/40'
						"
						:aria-pressed="path[level]?.id === p.id"
						@click="pick(level, p)"
					>
						<Avatar :label="p.name" :image="p.image" :size="38" />
						<span class="min-w-0 flex-grow">
							<span class="block truncate text-[14px] font-bold">{{ p.name }}</span>
							<span class="block truncate text-[12.5px] text-mut">{{
								p.title || "No designation"
							}}</span>
							<span
								v-if="p.connections"
								class="mt-0.5 block text-[11.5px] font-semibold text-acc"
								>{{ p.connections }}
								{{ p.connections === 1 ? "person" : "people" }} below</span
							>
						</span>
					</button>
				</li>
			</ul>
		</section>

		<div
			v-if="path.length"
			class="sticky bottom-4 flex w-fit items-center gap-3 self-start rounded-xl border border-line bg-surf px-4 py-2.5 shadow-lg"
		>
			<Avatar :label="last.name" :image="last.image" :size="28" />
			<span class="text-[13.5px] font-semibold">{{ last.name }}</span>
			<router-link
				:to="{ name: 'Form', params: { doctype: 'Employee', name: last.id } }"
				class="text-[13px] font-semibold text-acc"
				>Open profile →</router-link
			>
		</div>
	</div>
</template>

<script setup>
import { call } from "frappe-ui";
import { computed, onMounted, ref, watch } from "vue";
import Avatar from "@/components/Avatar.vue";
import LinkInput from "@/components/fields/LinkInput.vue";
import { messageOf } from "@/engine/form";

const METHOD = "hrms.hr.page.organizational_chart.organizational_chart.get_children";
const companies = ref([]);
const company = ref("");
const rows = ref([]); // rows[0] = top level, rows[i + 1] = reports of path[i]
const path = ref([]);
const loading = ref(false);
const error = ref("");
const last = computed(() => path.value[path.value.length - 1]);

const children = (parent) =>
	call(METHOD, { parent: parent || company.value, company: company.value }).then((r) => r || []);

async function loadTop() {
	loading.value = true;
	error.value = "";
	path.value = [];
	try {
		rows.value = [await children(null)];
	} catch (e) {
		error.value = messageOf(e, "Couldn't load the org chart.");
		rows.value = [];
	} finally {
		loading.value = false;
	}
}

async function pick(level, person) {
	path.value = [...path.value.slice(0, level), person];
	rows.value = rows.value.slice(0, level + 1);
	if (!person.expandable) return;
	try {
		const kids = await children(person.id);
		if (path.value[level]?.id === person.id)
			rows.value = [...rows.value.slice(0, level + 1), kids];
	} catch (e) {
		error.value = messageOf(e, "Couldn't load this team.");
	}
}

// Jump to anyone: open every level from the top down to them.
async function focus(employee) {
	try {
		const [me] = await call("frappe.client.get_list", {
			doctype: "Employee",
			filters: { name: employee },
			fields: ["name", "lft", "rgt", "company"],
		});
		if (!me) return;
		if (me.company !== company.value) {
			company.value = me.company;
			await loadTop();
		}
		const chain = await call("frappe.client.get_list", {
			doctype: "Employee",
			filters: [
				["lft", "<=", me.lft],
				["rgt", ">=", me.rgt],
				["status", "=", "Active"],
			],
			fields: ["name"],
			order_by: "lft asc",
			limit_page_length: 50,
		});
		for (const [level, { name }] of chain.entries()) {
			const person = rows.value[level]?.find((p) => p.id === name);
			if (!person) break;
			await pick(level, person);
		}
	} catch (e) {
		error.value = messageOf(e, "Couldn't find them in the org chart.");
	}
}

watch(company, (c, old) => old && c !== old && loadTop());

onMounted(async () => {
	const [list, boot] = await Promise.all([
		call("frappe.client.get_list", {
			doctype: "Company",
			pluck: "name",
			limit_page_length: 100,
		}).catch(() => []),
		call("hrms.briskrew.api.boot").catch(() => ({})),
	]);
	companies.value = (list || []).map((c) => c.name || c);
	company.value = boot?.defaults?.company || companies.value[0] || "";
	await loadTop();
});
</script>
