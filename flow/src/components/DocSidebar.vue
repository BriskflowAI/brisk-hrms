<template>
	<!-- Assigned to -->
	<section>
		<div class="kicker mb-2 flex items-center">
			<span class="flex-grow">{{ __("Assigned To") }}</span>
			<button
				v-if="!adding.assign"
				type="button"
				class="text-acc"
				:aria-label="__('Assign')"
				@click="adding.assign = true"
			>
				+
			</button>
		</div>
		<ul class="flex flex-col gap-1.5">
			<li
				v-for="a in assignments"
				:key="a.owner"
				class="flex items-center gap-2 text-[13px]"
			>
				<Avatar :label="a.fullname || a.owner" :size="22" />
				<span class="flex-grow truncate">{{ a.fullname || a.owner }}</span>
				<button
					type="button"
					class="text-mut hover:text-neg"
					:aria-label="`Unassign ${a.owner}`"
					@click="form.unassign(a.owner)"
				>
					✕
				</button>
			</li>
			<li v-if="!assignments.length && !adding.assign" class="text-[13px] text-mut">
				{{ __("Nobody") }}
			</li>
		</ul>
		<LinkInput
			v-if="adding.assign"
			class="mt-2"
			doctype="User"
			:get-query="() => ({ filters: { enabled: 1, user_type: 'System User' } })"
			:label="__('Assign to')"
			:placeholder="__('Find a person…')"
			:input-class="inputCls"
			@update:model-value="(u) => u && form.assign([u]).then(() => (adding.assign = false))"
		/>
	</section>

	<!-- Attachments -->
	<section>
		<div class="kicker mb-2 flex items-center">
			<span class="flex-grow">{{ __("Attachments") }}</span>
			<label class="cursor-pointer text-acc" :aria-label="__('Attach a file')">
				+
				<input type="file" class="sr-only" @change="upload" />
			</label>
		</div>
		<ul class="flex flex-col gap-1.5">
			<li v-for="a in attachments" :key="a.name" class="flex items-center gap-2 text-[13px]">
				<Icon name="file" :size="14" class="shrink-0 text-mut" />
				<a
					:href="a.file_url"
					target="_blank"
					rel="noopener"
					class="flex-grow truncate font-medium text-acc"
					>{{ a.file_name }}</a
				>
				<span v-if="a.is_private" class="text-[11px] text-mut">{{ __("private") }}</span>
				<button
					type="button"
					class="text-mut hover:text-neg"
					:aria-label="`Remove ${a.file_name}`"
					@click="form.removeAttachment(a.name)"
				>
					✕
				</button>
			</li>
			<li v-if="!attachments.length" class="text-[13px] text-mut">{{ __("None") }}</li>
		</ul>
	</section>

	<!-- Tags -->
	<section>
		<div class="kicker mb-2">{{ __("Tags") }}</div>
		<div class="flex flex-wrap items-center gap-1.5">
			<span v-for="t in tags" :key="t" class="chip gap-1 bg-line-2 text-ink-2">
				{{ t }}
				<button
					type="button"
					:aria-label="`Remove tag ${t}`"
					class="hover:text-neg"
					@click="form.removeTag(t)"
				>
					✕
				</button>
			</span>
			<input
				v-model="newTag"
				type="text"
				:aria-label="__('Add a tag')"
				:placeholder="__('Add tag')"
				class="w-24 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-[12.5px] focus:border-line focus:ring-0"
				@keydown.enter.prevent="addTag"
			/>
		</div>
	</section>

	<!-- Shared with -->
	<section>
		<div class="kicker mb-2 flex items-center">
			<span class="flex-grow">{{ __("Shared With") }}</span>
			<button
				v-if="!adding.share"
				type="button"
				class="text-acc"
				:aria-label="__('Share')"
				@click="adding.share = true"
			>
				+
			</button>
		</div>
		<ul class="flex flex-col gap-1.5">
			<li v-for="s in shared" :key="s.name" class="text-[13px] text-ink-2">
				{{ s.everyone ? "Everyone" : s.user }}
				<span class="text-[11.5px] text-mut"
					>·
					{{ ["read", "write", "share", "submit"].filter((k) => s[k]).join(", ") }}</span
				>
			</li>
			<li v-if="!shared.length && !adding.share" class="text-[13px] text-mut">
				{{ __("Only people with access") }}
			</li>
		</ul>
		<LinkInput
			v-if="adding.share"
			class="mt-2"
			doctype="User"
			:get-query="() => ({ filters: { enabled: 1 } })"
			:label="__('Share with')"
			:placeholder="__('Share with…')"
			:input-class="inputCls"
			@update:model-value="(u) => u && form.share(u).then(() => (adding.share = false))"
		/>
	</section>

	<!-- Connections -->
	<section v-if="connections.length">
		<div class="kicker mb-2">{{ __("Connections") }}</div>
		<div class="flex flex-col gap-3">
			<div v-for="g in connections" :key="g.label">
				<div class="mb-1 text-[12px] font-semibold text-ink-2">{{ __(g.label) }}</div>
				<ul class="flex flex-col gap-1">
					<li
						v-for="i in g.items"
						:key="i.doctype"
						class="flex items-center gap-2 text-[13px]"
					>
						<router-link
							:to="{ name: 'List', params: { doctype: i.doctype }, query: i.filter }"
							class="flex-grow truncate hover:text-acc"
						>
							{{ __(i.doctype) }}
						</router-link>
						<span class="tabular-nums text-mut">{{ i.count }}</span>
						<router-link
							:to="{
								name: 'Form',
								params: { doctype: i.doctype, name: 'new' },
								query: i.filter,
							}"
							class="text-acc"
							:aria-label="`New ${i.doctype}`"
						>
							+
						</router-link>
					</li>
				</ul>
			</div>
		</div>
	</section>

	<!-- Activity -->
	<section class="flex flex-col gap-3">
		<div class="kicker flex items-center">
			<span class="flex-grow">{{ __("Activity") }}</span>
			<button
				v-if="canEmail"
				type="button"
				class="flex items-center gap-1 normal-case tracking-normal text-acc"
				@click="compose()"
			>
				<Icon name="mail" :size="13" /> {{ __("New email") }}{{ " " }}
			</button>
		</div>
		<CommentBox @submit="postComment" />
		<ol class="flex flex-col gap-3">
			<li v-for="item in timeline" :key="item.key" class="flex gap-2.5 text-[13px]">
				<Avatar :label="item.by" :size="22" />
				<div class="min-w-0 flex-grow">
					<div>
						<span class="font-semibold">{{ item.by }}</span>
						{{ " " }}<span class="text-mut">{{ item.what }}</span>
					</div>
					<CommentBox
						v-if="editing === item.key"
						class="mt-1"
						:initial="item.html"
						cta="Save"
						:rows="3"
						cancellable
						@submit="(html) => saveComment(item, html)"
						@cancel="editing = null"
					/>
					<div
						v-else-if="item.body"
						class="mt-1 whitespace-pre-line break-words rounded-lg border border-line-2 bg-surf px-2.5 py-1.5 text-ink-2"
						:class="item.kind === 'email' && !expanded.has(item.key) && 'line-clamp-4'"
						v-text="item.body"
					/>
					<div
						class="mt-0.5 flex flex-wrap items-center gap-x-2.5 text-[11.5px] text-mut"
					>
						<span>{{ ago(item.when) }}</span>
						<template
							v-if="item.kind === 'comment' && item.mine && editing !== item.key"
						>
							<button
								type="button"
								class="hover:text-ink"
								@click="editing = item.key"
							>
								{{ __("Edit") }}
							</button>
							<button
								type="button"
								class="hover:text-neg"
								@click="deleteComment(item)"
							>
								{{ __("Delete") }}
							</button>
						</template>
						<template v-if="item.kind === 'email'">
							<button
								v-if="item.body.length > 240"
								type="button"
								class="hover:text-ink"
								@click="toggleExpanded(item.key)"
							>
								{{ expanded.has(item.key) ? "Less" : "More" }}
							</button>
							<button
								v-if="canEmail"
								type="button"
								class="hover:text-ink"
								@click="reply(item)"
							>
								{{ __("Reply") }}
							</button>
							<button
								v-if="canEmail && item.cc"
								type="button"
								class="hover:text-ink"
								@click="reply(item, true)"
							>
								{{ __("Reply all") }}
							</button>
						</template>
					</div>
				</div>
			</li>
		</ol>
	</section>

	<EmailComposer v-model="emailOpen" :form="form" :initial="emailInitial" />
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import dayjs from "dayjs";
import Icon from "@/components/Icon.vue";
import Avatar from "@/components/Avatar.vue";
import LinkInput from "@/components/fields/LinkInput.vue";
import CommentBox from "@/components/doc/CommentBox.vue";
import EmailComposer from "@/components/doc/EmailComposer.vue";
import { call } from "frappe-ui";
import { useSession } from "@/composables/session";
import { messageOf } from "@/engine/form";

const props = defineProps({ form: { type: Object, required: true } });

const inputCls =
	"w-full rounded-lg border border-line bg-surf px-2.5 py-1.5 text-[13px] focus:border-acc focus:ring-1 focus:ring-acc";
const adding = reactive({ assign: false, share: false });
const { user } = useSession();
const editing = ref(null);
const expanded = ref(new Set());
const emailOpen = ref(false);
const emailInitial = ref(null);
const canEmail = computed(() => !!props.form.perms?.email);
const newTag = ref("");
const connections = ref([]);

const info = computed(() => props.form.docinfo || {});
const assignments = computed(() => info.value.assignments || []);
const attachments = computed(() => info.value.attachments || []);
const shared = computed(() => info.value.shared || []);
const tags = computed(() =>
	String(info.value.tags || props.form.doc?._user_tags || "")
		.split(",")
		.map((t) => t.trim())
		.filter(Boolean),
);

const strip = (html) =>
	new DOMParser().parseFromString(String(html || ""), "text/html").body.textContent;
const ago = (d) => (d ? dayjs(d).format("D MMM YYYY, HH:mm") : "");

// One feed like the desk timeline: comments, emails, field changes, creation.
const who = (u) => info.value.user_info?.[u]?.fullname || u;

const timeline = computed(() => {
	const out = [];
	// Assignments, attachments, likes, workflow and other logged events, as the desk shows them.
	for (const key of [
		"assignment_logs",
		"attachment_logs",
		"info_logs",
		"like_logs",
		"workflow_logs",
	])
		for (const l of info.value[key] || []) {
			const by = who(l.owner);
			let what = strip(l.content).trim();
			if (what.startsWith(by)) what = what.slice(by.length).trim();
			if (key === "like_logs" && !what) what = "liked this";
			out.push({ key: `${key}${l.name}`, by, what, when: l.creation });
		}
	for (const c of info.value.comments || [])
		out.push({
			key: `c${c.name}`,
			kind: "comment",
			name: c.name,
			mine: c.owner === user || c.comment_email === user,
			by: c.comment_by || who(c.owner),
			what: "commented",
			html: c.content,
			body: strip(String(c.content || "").replace(/<br\s*\/?>/gi, "\n")),
			when: c.creation,
		});
	for (const c of info.value.communications || [])
		out.push({
			key: `m${c.name}`,
			kind: "email",
			by: c.sender_full_name || c.sender,
			what: `${c.sent_or_received === "Received" ? "wrote" : "emailed"} · ${
				c.subject || ""
			}`,
			body: strip(
				String(c.content || "")
					.replace(/<br\s*\/?>/gi, "\n")
					.replace(/<\/p>/gi, "\n"),
			).trim(),
			subject: c.subject || "",
			sender: c.sender,
			recipients: c.recipients,
			cc: c.cc,
			received: c.sent_or_received === "Received",
			when: c.creation,
		});
	for (const v of info.value.versions || []) {
		let data = {};
		try {
			data = JSON.parse(v.data);
		} catch {
			/* ignore malformed version rows */
		}
		const changed = (data.changed || []).map(([f]) => props.form.df(f)?.label || f);
		if (changed.length)
			out.push({
				key: `v${v.name}`,
				by: who(v.owner),
				what: `changed ${changed.slice(0, 4).join(", ")}${changed.length > 4 ? "…" : ""}`,
				when: v.creation,
			});
	}
	const d = props.form.doc;
	if (d?.creation)
		out.push({ key: "created", by: who(d.owner), what: "created this", when: d.creation });
	return out.sort((a, b) => (a.when < b.when ? 1 : -1));
});

async function postComment(html, clear) {
	if (await props.form.addComment(html)) clear();
}
async function saveComment(item, html) {
	try {
		await call("frappe.desk.form.utils.update_comment", { name: item.name, content: html });
		editing.value = null;
		await props.form.reloadDoc();
	} catch (e) {
		props.form.error = messageOf(e, "Couldn't save the comment.");
	}
}
async function deleteComment(item) {
	if (!window.confirm("Delete this comment?")) return;
	try {
		await call("frappe.client.delete", { doctype: "Comment", name: item.name });
		await props.form.reloadDoc();
	} catch (e) {
		props.form.error = messageOf(e, "Couldn't delete the comment.");
	}
}
function toggleExpanded(key) {
	const next = new Set(expanded.value);
	next.has(key) ? next.delete(key) : next.add(key);
	expanded.value = next;
}
function compose(initial = null) {
	emailInitial.value = initial;
	emailOpen.value = true;
}
function reply(item, all = false) {
	const quoted = item.body
		.split("\n")
		.map((l) => `> ${l}`)
		.join("\n");
	const to = item.received ? item.sender : item.recipients;
	const cc = all
		? [item.received ? item.recipients : "", item.cc]
				.filter(Boolean)
				.join(", ")
				.split(",")
				.map((x) => x.trim())
				.filter((x) => x && x !== user && x !== to)
				.join(", ")
		: "";
	compose({
		to: to || "",
		cc,
		subject: item.subject.startsWith("Re:") ? item.subject : `Re: ${item.subject}`,
		message: `\n\nOn ${ago(item.when)}, ${item.by} wrote:\n${quoted}`,
	});
}
async function addTag() {
	const t = newTag.value.trim();
	if (!t) return;
	if (await props.form.addTag(t)) newTag.value = "";
}
async function upload(e) {
	const file = e.target.files?.[0];
	if (file) await props.form.upload(file);
	e.target.value = "";
}

async function loadConnections() {
	connections.value = await props.form.loadConnections();
}
onMounted(loadConnections);
watch(() => props.form.doc?.name, loadConnections);
</script>
