<template>
	<div
		v-if="open"
		class="fixed inset-0 z-50 flex items-start justify-center bg-ink/30 pt-[12vh]"
		@mousedown.self="close"
	>
		<div
			role="dialog"
			aria-modal="true"
			aria-label="Search"
			class="w-[640px] overflow-hidden rounded-2xl border border-line bg-surf shadow-2xl"
		>
			<label class="flex items-center gap-3 border-b border-line-2 px-4">
				<Icon name="search" :size="18" class="text-mut" />
				<input
					ref="input"
					v-model="query"
					type="text"
					aria-label="Search"
					placeholder="Jump to a person, record type or report…"
					class="h-14 flex-grow border-0 bg-transparent p-0 text-[16px] text-ink placeholder:text-mut focus:ring-0"
					@keydown.down.prevent="move(1)"
					@keydown.up.prevent="move(-1)"
					@keydown.enter.prevent="choose(results[cursor])"
					@keydown.esc="close"
				/>
			</label>
			<ul class="max-h-[420px] overflow-y-auto p-2" role="listbox">
				<li v-if="!results.length" class="px-3 py-6 text-center text-[13.5px] text-mut">
					Nothing matches “{{ query }}”. Try a person's name or a record type such as
					“Salary Slip”.
				</li>
				<li
					v-for="(r, i) in results"
					:key="r.key"
					role="option"
					:aria-selected="i === cursor"
					class="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2"
					:class="i === cursor ? 'bg-acc-tint' : ''"
					@mouseenter="cursor = i"
					@click="choose(r)"
				>
					<Avatar v-if="r.kind === 'person'" :label="r.label" :size="26" />
					<span
						v-else
						class="flex h-[26px] w-[26px] items-center justify-center rounded-md bg-side text-mut"
					>
						<Icon :name="r.kind === 'report' ? 'chart' : 'file'" :size="15" />
					</span>
					<span class="flex-grow truncate text-[14px] font-semibold">{{ r.label }}</span>
					<span class="truncate text-[12.5px] text-mut">{{ r.hint }}</span>
				</li>
			</ul>
		</div>
	</div>
</template>

<script setup>
import { dept } from "@/composables/format";
import { computed, nextTick, ref, watch } from "vue";
import { useRouter } from "vue-router";
import Icon from "./Icon.vue";
import Avatar from "./Avatar.vue";
import { allNavItems } from "@/nav";
import { searchDoctypes, searchEmployees } from "@/composables/api";
import { canOpen, canReadDoctype } from "@/composables/access";

const open = defineModel({ type: Boolean, default: false });
const router = useRouter();
const input = ref(null);
const query = ref("");
const cursor = ref(0);
const remote = ref([]);
const nav = allNavItems();

const local = computed(() => {
	const q = query.value.trim().toLowerCase();
	return nav
		.filter(canOpen)
		.filter(
			(i) =>
				!q ||
				i.label.toLowerCase().includes(q) ||
				(i.doctype || "").toLowerCase().includes(q),
		)
		.slice(0, q ? 8 : 6)
		.map((i) => ({
			key: `nav:${i.area}:${i.label}`,
			kind: i.doctype ? "doctype" : "report",
			report: i.report,
			route: i.route,
			label: i.label,
			hint: `${i.area} · ${i.section}`,
			doctype: i.doctype,
			href: i.href,
		}));
});

const results = computed(() => {
	const seen = new Set(local.value.map((r) => r.doctype).filter(Boolean));
	return [
		...local.value,
		...remote.value.filter((r) => !r.doctype || r.kind === "person" || !seen.has(r.doctype)),
	];
});

let timer;
watch(query, (q) => {
	cursor.value = 0;
	clearTimeout(timer);
	if (q.trim().length < 2) {
		remote.value = [];
		return;
	}
	timer = setTimeout(async () => {
		// Anything the classic desk can open is reachable here, not only what the sidebar lists.
		const [people, doctypes] = await Promise.all([
			searchEmployees(q).catch(() => []),
			searchDoctypes(q).catch(() => []),
		]);
		remote.value = [
			...people.map((p) => ({
				key: `emp:${p.name}`,
				kind: "person",
				label: p.employee_name || p.name,
				hint: [p.designation, dept(p.department)].filter(Boolean).join(" · "),
				doctype: "Employee",
				name: p.name,
			})),
			...doctypes
				.filter((d) => canReadDoctype(d.name))
				.map((d) => ({
					key: `dt:${d.name}`,
					kind: "doctype",
					label: d.name,
					hint: d.module,
					doctype: d.name,
				})),
		];
	}, 180);
});

watch(open, async (v) => {
	if (!v) return;
	query.value = "";
	await nextTick();
	input.value?.focus();
});

function move(step) {
	const n = results.value.length;
	if (n) cursor.value = (cursor.value + step + n) % n;
}

function close() {
	open.value = false;
}

function choose(r) {
	if (!r) return;
	close();
	if (r.route) router.push(r.route);
	else if (r.report) router.push({ name: "Report", params: { name: r.report } });
	else if (r.href) window.location.href = r.href;
	else if (r.name) router.push({ name: "Form", params: { doctype: r.doctype, name: r.name } });
	else router.push({ name: "List", params: { doctype: r.doctype } });
}
</script>
