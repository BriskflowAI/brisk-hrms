<template>
	<div class="flex min-h-full flex-col">
		<p
			v-if="form.error && !form.ready"
			class="m-7 rounded-lg bg-neg-tint px-4 py-3 text-[13.5px] text-neg"
		>
			{{ form.error }}
		</p>

		<template v-else-if="form.ready && form.doc">
			<!-- Header -->
			<header
				class="sticky top-0 z-20 flex flex-col gap-3 border-b border-line bg-surf px-7 pt-5"
			>
				<div class="flex items-end gap-3">
					<Avatar v-if="doctype === 'Employee'" :label="form.titleValue" :size="52" />
					<div class="min-w-0 flex-grow">
						<router-link
							:to="{ name: 'List', params: { doctype } }"
							class="kicker hover:text-acc"
							>{{ doctype }}</router-link
						>
						<h1 class="mt-1.5 truncate text-[30px] leading-none">
							{{ form.isNew ? `New ${doctype}` : form.titleValue }}
						</h1>
						<div
							v-if="!form.isNew && form.titleValue !== form.doc.name"
							class="mt-1.5 text-[13px] text-mut"
						>
							{{ form.doc.name }}
						</div>
					</div>
					<span v-if="form.dirty" class="chip bg-warn-tint text-warn">Not saved</span>
					<span v-if="form.indicator" class="chip" :class="tone(form.indicator.color)">{{
						form.indicator.label
					}}</span>
					<span v-else-if="form.workflowState" class="chip bg-acc-tint text-acc">{{
						form.workflowState
					}}</span>
					<StatusChip
						v-else-if="!form.isNew"
						:doc="form.doc"
						:submittable="!!form.meta?.is_submittable"
					/>

					<!-- Buttons added by the form's own script, grouped like the desk -->
					<div v-for="g in buttonGroups" :key="g.group" class="relative">
						<template v-if="!g.group">
							<button
								v-for="b in g.buttons"
								:key="b.label"
								type="button"
								class="btn-ghost ml-1"
								:disabled="!!form.busy"
								@click="runButton(b)"
							>
								{{ b.label }}
							</button>
						</template>
						<template v-else>
							<button
								type="button"
								class="btn-ghost"
								:aria-expanded="menu === g.group"
								@click="menu = menu === g.group ? null : g.group"
							>
								{{ g.group }} <Icon name="chev" :size="14" />
							</button>
							<div
								v-if="menu === g.group"
								class="absolute right-0 top-full z-30 mt-1 min-w-[200px] rounded-lg border border-line bg-surf py-1 shadow-xl"
							>
								<button
									v-for="b in g.buttons"
									:key="b.label"
									type="button"
									class="block w-full px-3 py-1.5 text-left text-[13.5px] hover:bg-acc-tint"
									@click="runButton(b)"
								>
									{{ b.label }}
								</button>
							</div>
						</template>
					</div>

					<!-- More -->
					<div class="relative">
						<button
							type="button"
							class="btn-ghost px-2.5"
							aria-label="More actions"
							:aria-expanded="menu === 'more'"
							@click="menu = menu === 'more' ? null : 'more'"
						>
							•••
						</button>
						<div
							v-if="menu === 'more'"
							class="absolute right-0 top-full z-30 mt-1 w-[230px] rounded-lg border border-line bg-surf py-1 shadow-xl"
						>
							<template v-if="!form.isNew">
								<div
									class="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-mut"
								>
									Print
								</div>
								<a
									v-for="p in form.printFormats"
									:key="p"
									:href="form.printUrl(p)"
									target="_blank"
									rel="noopener"
									class="block px-3 py-1.5 text-[13.5px] hover:bg-acc-tint"
								>
									{{ p }}
								</a>
								<a
									:href="form.pdfUrl()"
									class="block px-3 py-1.5 text-[13.5px] hover:bg-acc-tint"
									>Download PDF</a
								>
								<div class="my-1 border-t border-line-2" />
								<button type="button" class="menu-item" @click="duplicate">
									Duplicate
								</button>
								<button
									v-if="form.meta.allow_rename && form.perms?.write"
									type="button"
									class="menu-item"
									@click="askRename"
								>
									Rename
								</button>
								<button type="button" class="menu-item" @click="copyLink">
									Copy link
								</button>
								<button
									type="button"
									class="menu-item"
									@click="form.follow(!form.docinfo?.is_document_followed)"
								>
									{{
										form.docinfo?.is_document_followed ? "Unfollow" : "Follow"
									}}
								</button>
								<button type="button" class="menu-item" @click="reload">
									Reload
								</button>
								<button
									v-if="form.perms?.delete && form.docstatus !== 1"
									type="button"
									class="menu-item text-neg"
									@click="confirmAction('delete')"
								>
									Delete
								</button>
								<div class="my-1 border-t border-line-2" />
							</template>
							<a
								:href="
									classicUrl(doctype, form.isNew ? null : form.doc.name) +
									(form.isNew ? '/new' : '')
								"
								class="block px-3 py-1.5 text-[13.5px] hover:bg-acc-tint"
								>Open in classic desk</a
							>
						</div>
					</div>

					<!-- Workflow or standard primary actions -->
					<template v-if="form.transitions.length && !form.dirty">
						<button
							v-for="t in form.transitions"
							:key="t.action"
							type="button"
							class="btn-ink"
							:disabled="!!form.busy"
							@click="form.applyWorkflow(t.action)"
						>
							{{ t.action }}
						</button>
					</template>
					<button
						v-else-if="primary"
						type="button"
						:class="primary.danger ? 'btn-ghost text-neg' : 'btn-ink'"
						:disabled="!!form.busy"
						@click="primary.run()"
					>
						{{ form.busy || primary.label }}
						<kbd v-if="primary.label === 'Save'" class="kbd">{{ modKey }}S</kbd>
					</button>
				</div>

				<nav
					v-if="layout.length > 1"
					aria-label="Sections"
					class="-mb-px flex gap-6 overflow-x-auto text-[14px]"
				>
					<button
						v-for="(t, i) in layout"
						:key="t.label + i"
						type="button"
						class="whitespace-nowrap border-b-2 py-2.5"
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

			<!-- Messages -->
			<div class="flex flex-col gap-2 px-7 pt-4 empty:hidden">
				<div
					v-if="changedBy"
					role="status"
					class="flex flex-wrap items-center gap-3 rounded-lg bg-warn-tint px-4 py-2.5 text-[13.5px] text-ink"
				>
					<span class="flex-grow"
						><b>{{ changedBy }}</b> changed this record while you were editing
						it.</span
					>
					<button
						type="button"
						class="btn-ghost h-8 px-3 text-[13px]"
						@click="reloadLatest"
					>
						Load their changes
					</button>
				</div>
				<p
					v-if="form.error"
					role="alert"
					class="rounded-lg bg-neg-tint px-4 py-2.5 text-[13.5px] text-neg"
				>
					{{ form.error }}
				</p>
				<p
					v-if="form.intro"
					class="rounded-lg px-4 py-2.5 text-[13.5px]"
					:class="tone(form.intro.color)"
					v-html="form.intro.text"
				/>
				<div
					v-if="form.headline"
					class="rounded-lg bg-acc-tint px-4 py-2.5 text-[13.5px] text-ink"
					v-html="form.headline"
				/>
				<p v-if="notice" class="rounded-lg bg-warn-tint px-4 py-2.5 text-[13px] text-warn">
					{{ notice }}
				</p>
				<p
					v-if="form.unsupported.length"
					class="rounded-lg bg-line-2 px-4 py-2.5 text-[12.5px] text-ink-2"
				>
					A few parts of this form's script ({{
						form.unsupported.slice(0, 3).join(", ")
					}}) run only in the classic desk.
					<a
						:href="classicUrl(doctype, form.isNew ? null : form.doc.name)"
						class="font-semibold text-acc"
						>Open there</a
					>
					if something seems missing.
				</p>
				<details
					v-for="sec in form.sections"
					:key="sec.title"
					open
					class="rounded-xl border border-line bg-surf px-5 py-3"
				>
					<summary class="cursor-pointer text-[14px] font-semibold">
						{{ sec.title || "Details" }}
					</summary>
					<div class="desk-html mt-2 overflow-x-auto text-[13.5px]" v-html="sec.html" />
				</details>
				<div v-if="form.dashboard.length" class="flex flex-wrap gap-2">
					<span
						v-for="d in form.dashboard"
						:key="d.label"
						class="chip"
						:class="tone(d.color)"
						>{{ d.label }}</span
					>
				</div>
			</div>

			<div class="flex min-h-0 flex-grow gap-6 px-7 py-5">
				<!-- Fields -->
				<div class="flex min-w-0 flex-grow flex-col gap-5">
					<section
						v-for="(s, si) in layout[tab]?.sections || []"
						:key="si"
						class="rounded-xl border border-line bg-surf px-5 py-4"
					>
						<button
							v-if="s.label"
							type="button"
							class="mb-2 flex w-full items-center gap-2 text-left"
							:aria-expanded="!collapsed[s.key]"
							@click="collapsed[s.key] = !collapsed[s.key]"
						>
							<h2 class="flex-grow text-[16px]">{{ s.label }}</h2>
							<Icon
								v-if="s.collapsible"
								:name="collapsed[s.key] ? 'chevr' : 'chev'"
								:size="15"
								class="text-mut"
							/>
						</button>
						<div
							v-if="!collapsed[s.key]"
							class="grid gap-x-8"
							:style="{
								gridTemplateColumns: `repeat(${s.columns.length}, minmax(0, 1fr))`,
							}"
						>
							<div
								v-for="(col, ci) in s.columns"
								:key="ci"
								class="flex min-w-0 flex-col gap-2.5"
							>
								<Field
									v-for="df in col"
									:key="df.fieldname"
									:form="form"
									:df="df"
								/>
							</div>
						</div>
					</section>
				</div>

				<!-- Sidebar -->
				<aside v-if="!form.isNew" class="flex w-[280px] shrink-0 flex-col gap-5">
					<DocSidebar :form="form" />
				</aside>
			</div>
		</template>

		<div v-else class="px-7 py-10 text-[13.5px] text-mut">Loading…</div>

		<!-- Confirm -->
		<div
			v-if="confirming"
			class="fixed inset-0 z-50 flex items-center justify-center bg-ink/30"
			@mousedown.self="confirming = null"
		>
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="confirm-title"
				class="w-[440px] rounded-2xl border border-line bg-surf p-6 shadow-2xl"
			>
				<h2 id="confirm-title" class="text-[21px]">{{ confirming.title }}</h2>
				<p class="mt-2 text-[14px] leading-relaxed text-ink-2">{{ confirming.body }}</p>
				<label v-if="confirming.input !== undefined" class="mt-4 flex flex-col gap-1.5">
					<span class="text-[13px] font-semibold">{{ confirming.inputLabel }}</span>
					<input
						v-model="confirming.input"
						type="text"
						class="rounded-lg border border-line bg-paper px-3 py-2 text-[14px] focus:border-acc focus:ring-1 focus:ring-acc"
					/>
				</label>
				<div class="mt-5 flex justify-end gap-2">
					<button type="button" class="btn-ghost" @click="confirming = null">
						Back
					</button>
					<button
						type="button"
						:class="confirming.danger ? 'btn border-neg bg-neg text-surf' : 'btn-ink'"
						@click="confirming.run()"
					>
						{{ confirming.cta }}
					</button>
				</div>
			</div>
		</div>

		<CompatDialogs />
	</div>
</template>

<script setup>
import { modKey } from "@/composables/platform";
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { useLiveCheck } from "@/composables/live";
import { call } from "frappe-ui";
import { onBeforeRouteLeave, useRouter } from "vue-router";
import Icon from "@/components/Icon.vue";
import Avatar from "@/components/Avatar.vue";
import StatusChip from "@/components/StatusChip.vue";
import Field from "@/components/fields/Field.vue";
import DocSidebar from "@/components/DocSidebar.vue";
import CompatDialogs from "@/components/CompatDialogs.vue";
import { createForm } from "@/engine/form";
import { attachFormScript, detachFormScript } from "@/engine/compat";
import { classicUrl } from "@/nav";

const props = defineProps({
	doctype: { type: String, required: true },
	name: { type: String, required: true },
});
const router = useRouter();

const form = createForm(props.doctype, props.name === "new" ? null : props.name);
const tab = ref(0);
const menu = ref(null);
const collapsed = reactive({});
const confirming = ref(null);

// ---- layout: tabs > sections > columns, honouring every visibility rule ----
const layout = computed(() => {
	if (!form.meta) return [];
	const out = [];
	let t = { label: "Details", sections: [] };
	let s = null;
	const newSection = (df) => ({
		key: df?.fieldname || `s${out.length}-${t.sections.length}`,
		label: df?.label || "",
		collapsible: !!df?.collapsible,
		columns: [[]],
	});
	const push = () => {
		if (!s) return;
		const cols = s.columns.filter((c) => c.length);
		if (cols.length) t.sections.push({ ...s, columns: cols });
	};
	s = newSection(null);
	for (const base of form.meta.fields) {
		const df = form.df(base.fieldname) || base;
		if (df.fieldtype === "Tab Break") {
			push();
			if (t.sections.length) out.push(t);
			t = { label: df.label || "More", sections: [] };
			s = newSection(null);
			continue;
		}
		if (df.fieldtype === "Section Break") {
			push();
			s = form.visible(df) ? newSection(df) : { ...newSection(df), hiddenSection: true };
			continue;
		}
		if (df.fieldtype === "Column Break") {
			s.columns.push([]);
			continue;
		}
		if (s.hiddenSection || !form.visible(df)) continue;
		s.columns[s.columns.length - 1].push(df);
	}
	push();
	if (t.sections.length) out.push(t);
	return out;
});

// Collapsible sections start closed, as in the desk.
watch(
	() => form.ready,
	(ready) => {
		if (!ready) return;
		for (const df of form.meta.fields)
			if (
				df.fieldtype === "Section Break" &&
				df.collapsible &&
				collapsed[df.fieldname] === undefined
			)
				collapsed[df.fieldname] = !(
					df.collapsible_depends_on && form.evaluate(df.collapsible_depends_on)
				);
	},
);

// ---- actions ----
const primary = computed(() => {
	const p = form.perms || {};
	const submittable = !!form.meta?.is_submittable;
	if (form.saveDisabled && !form.isNew) return null;
	if (form.isNew || form.dirty)
		return form.canWrite
			? { label: form.docstatus === 1 ? "Update" : "Save", run: save }
			: null;
	if (form.docstatus === 0 && submittable && p.submit)
		return { label: "Submit", run: () => confirmAction("submit") };
	if (form.docstatus === 1 && submittable && p.cancel)
		return { label: "Cancel", danger: true, run: () => confirmAction("cancel") };
	if (form.docstatus === 2 && p.amend) return { label: "Amend", run: amend };
	return null;
});

const notice = computed(() => {
	if (form.docstatus === 1)
		return "Submitted. Only fields marked “allow on submit” can still change.";
	if (form.docstatus === 2) return "Cancelled. Amend it to make a corrected copy.";
	return "";
});

const buttonGroups = computed(() => {
	const groups = new Map();
	for (const b of form.buttons) {
		const g = b.group || "";
		if (!groups.has(g)) groups.set(g, []);
		groups.get(g).push(b);
	}
	return [...groups.entries()].map(([group, buttons]) => ({ group, buttons }));
});

async function runButton(b) {
	menu.value = null;
	try {
		await b.action();
	} catch (e) {
		form.error = e?.message || `${b.label} failed`;
	}
}

async function save() {
	const wasNew = form.isNew;
	const ok = await form.save();
	if (ok && wasNew)
		router.replace({ name: "Form", params: { doctype: props.doctype, name: form.doc.name } });
}

function confirmAction(kind) {
	menu.value = null;
	const name = form.titleValue;
	const map = {
		submit: {
			title: `Submit ${name}?`,
			body: "Submitted records are locked. You can cancel and amend later if needed.",
			cta: "Submit",
			run: () => form.submit(),
		},
		cancel: {
			title: `Cancel ${name}?`,
			body: "This reverses its effects (ledger entries, balances). You can amend it afterwards.",
			cta: "Cancel it",
			danger: true,
			run: () => form.cancel(),
		},
		delete: {
			title: `Delete ${name}?`,
			body: "This can't be undone.",
			cta: "Delete",
			danger: true,
			run: async () => {
				if (await form.remove())
					router.replace({ name: "List", params: { doctype: props.doctype } });
			},
		},
	};
	const c = map[kind];
	confirming.value = {
		...c,
		run: async () => {
			confirming.value = null;
			await c.run();
		},
	};
}

function openCopy(values) {
	sessionStorage.setItem(`briskrew:copy:${props.doctype}`, JSON.stringify(values));
	router.push({
		name: "Form",
		params: { doctype: props.doctype, name: "new" },
		query: { from: "copy" },
	});
}
const amend = () => openCopy(form.copy(true));
function duplicate() {
	menu.value = null;
	openCopy(form.copy(false));
}

function askRename() {
	menu.value = null;
	confirming.value = {
		title: `Rename ${form.doc.name}`,
		body: "Links from other records follow the new name.",
		inputLabel: "New name",
		input: form.doc.name,
		cta: "Rename",
		run: async () => {
			const to = confirming.value.input.trim();
			confirming.value = null;
			if (to && to !== form.doc.name) {
				const n = await form.rename(to);
				if (n)
					router.replace({
						name: "Form",
						params: { doctype: props.doctype, name: form.doc.name },
					});
			}
		},
	};
}

async function copyLink() {
	menu.value = null;
	try {
		await navigator.clipboard.writeText(window.location.href);
	} catch {
		/* clipboard blocked; the URL is still in the address bar */
	}
}

async function reload() {
	menu.value = null;
	await form.reload();
}

const tone = (c) =>
	({
		green: "bg-pos-tint text-pos",
		red: "bg-neg-tint text-neg",
		orange: "bg-warn-tint text-warn",
		yellow: "bg-warn-tint text-warn",
		blue: "bg-acc-tint text-acc",
	})[c] || "bg-line-2 text-ink-2";

// ---- live: pick up changes others make while this record is open ----
const changedBy = ref("");
useLiveCheck(async () => {
	if (!form.ready || form.isNew || !form.doc?.modified) return;
	const latest = await call("frappe.client.get_value", {
		doctype: props.doctype,
		filters: { name: form.doc.name },
		fieldname: ["modified", "modified_by"],
	});
	if (!latest?.modified || latest.modified === form.doc.modified) return;
	// Someone typing in a field counts as editing even before the field reports its value.
	const el = document.activeElement;
	const typing = el && (el.matches?.("input, textarea, select") || el.isContentEditable);
	if (form.dirty || typing) {
		const who = await call("frappe.client.get_value", {
			doctype: "User",
			filters: { name: latest.modified_by },
			fieldname: "full_name",
		}).catch(() => null);
		changedBy.value = who?.full_name || latest.modified_by;
	} else {
		await form.reloadDoc();
	}
});
async function reloadLatest() {
	changedBy.value = "";
	document.activeElement?.blur?.();
	form.dirty = false;
	await form.reloadDoc();
}
watch(
	() => form.doc?.modified,
	(modified, before) => before && modified !== before && !form.dirty && (changedBy.value = ""),
);

function onKey(e) {
	if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
		e.preventDefault();
		if (form.canWrite && (form.dirty || form.isNew)) save();
	}
}

onBeforeRouteLeave(() => {
	if (form.dirty && !window.confirm("You have unsaved changes. Leave anyway?")) return false;
});

onMounted(async () => {
	window.addEventListener("keydown", onKey);
	await form.load();
	if (form.isNew) {
		const raw = sessionStorage.getItem(`briskrew:copy:${props.doctype}`);
		if (raw) {
			sessionStorage.removeItem(`briskrew:copy:${props.doctype}`);
			Object.assign(form.doc, JSON.parse(raw), {
				name: form.doc.name,
				__islocal: 1,
				docstatus: 0,
			});
			form.dirty = true;
		}
		// Values passed in the URL (e.g. from a list filter or a script) prefill the new record.
		for (const [k, v] of Object.entries(router.currentRoute.value.query))
			if (k !== "from" && form.meta.fields.some((d) => d.fieldname === k)) form.doc[k] = v;
	}
	if (form.ready) await attachFormScript(form, router);
});
onBeforeUnmount(() => {
	window.removeEventListener("keydown", onKey);
	detachFormScript(form);
});
</script>

<style scoped>
.menu-item {
	@apply block w-full px-3 py-1.5 text-left text-[13.5px] hover:bg-acc-tint;
}
</style>
