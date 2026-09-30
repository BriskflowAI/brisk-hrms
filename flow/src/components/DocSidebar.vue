<template>
	<!-- Assigned to -->
	<section>
		<div class="kicker mb-2 flex items-center">
			<span class="flex-grow">Assigned to</span>
			<button
				v-if="!adding.assign"
				type="button"
				class="text-acc"
				aria-label="Assign"
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
				Nobody
			</li>
		</ul>
		<LinkInput
			v-if="adding.assign"
			class="mt-2"
			doctype="User"
			:get-query="() => ({ filters: { enabled: 1, user_type: 'System User' } })"
			label="Assign to"
			placeholder="Find a person…"
			:input-class="inputCls"
			@update:model-value="(u) => u && form.assign([u]).then(() => (adding.assign = false))"
		/>
	</section>

	<!-- Attachments -->
	<section>
		<div class="kicker mb-2 flex items-center">
			<span class="flex-grow">Attachments</span>
			<label class="cursor-pointer text-acc" aria-label="Attach a file">
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
				<span v-if="a.is_private" class="text-[11px] text-mut">private</span>
				<button
					type="button"
					class="text-mut hover:text-neg"
					:aria-label="`Remove ${a.file_name}`"
					@click="form.removeAttachment(a.name)"
				>
					✕
				</button>
			</li>
			<li v-if="!attachments.length" class="text-[13px] text-mut">None</li>
		</ul>
	</section>

	<!-- Tags -->
	<section>
		<div class="kicker mb-2">Tags</div>
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
				aria-label="Add a tag"
				placeholder="Add tag"
				class="w-24 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-[12.5px] focus:border-line focus:ring-0"
				@keydown.enter.prevent="addTag"
			/>
		</div>
	</section>

	<!-- Shared with -->
	<section>
		<div class="kicker mb-2 flex items-center">
			<span class="flex-grow">Shared with</span>
			<button
				v-if="!adding.share"
				type="button"
				class="text-acc"
				aria-label="Share"
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
				Only people with access
			</li>
		</ul>
		<LinkInput
			v-if="adding.share"
			class="mt-2"
			doctype="User"
			:get-query="() => ({ filters: { enabled: 1 } })"
			label="Share with"
			placeholder="Share with…"
			:input-class="inputCls"
			@update:model-value="(u) => u && form.share(u).then(() => (adding.share = false))"
		/>
	</section>

	<!-- Connections -->
	<section v-if="connections.length">
		<div class="kicker mb-2">Connections</div>
		<div class="flex flex-col gap-3">
			<div v-for="g in connections" :key="g.label">
				<div class="mb-1 text-[12px] font-semibold text-ink-2">{{ g.label }}</div>
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
							{{ i.doctype }}
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
		<div class="kicker">Activity</div>
		<label class="flex flex-col gap-1.5">
			<span class="sr-only">Add a comment</span>
			<textarea v-model="comment" rows="2" placeholder="Add a comment" :class="inputCls" />
		</label>
		<button
			v-if="comment.trim()"
			type="button"
			class="btn-ghost self-start"
			@click="postComment"
		>
			Comment
		</button>
		<ol class="flex flex-col gap-3">
			<li v-for="item in timeline" :key="item.key" class="flex gap-2.5 text-[13px]">
				<Avatar :label="item.by" :size="22" />
				<div class="min-w-0 flex-grow">
					<div>
						<span class="font-semibold">{{ item.by }}</span>
						<span class="text-mut">{{ item.what }}</span>
					</div>
					<div
						v-if="item.body"
						class="mt-1 whitespace-pre-line break-words rounded-lg bg-paper px-2.5 py-1.5 text-ink-2"
					>
						{{ item.body }}
					</div>
					<div class="mt-0.5 text-[11.5px] text-mut">{{ ago(item.when) }}</div>
				</div>
			</li>
		</ol>
	</section>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import dayjs from "dayjs";
import Icon from "@/components/Icon.vue";
import Avatar from "@/components/Avatar.vue";
import LinkInput from "@/components/fields/LinkInput.vue";

const props = defineProps({ form: { type: Object, required: true } });

const inputCls =
	"w-full rounded-lg border border-line bg-surf px-2.5 py-1.5 text-[13px] focus:border-acc focus:ring-1 focus:ring-acc";
const adding = reactive({ assign: false, share: false });
const comment = ref("");
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
const timeline = computed(() => {
	const out = [];
	for (const c of info.value.comments || [])
		out.push({
			key: `c${c.name}`,
			by: c.comment_by || c.owner,
			what: "commented",
			body: strip(c.content),
			when: c.creation,
		});
	for (const c of info.value.communications || [])
		out.push({
			key: `m${c.name}`,
			by: c.sender_full_name || c.sender,
			what: `emailed · ${c.subject || ""}`,
			body: strip(c.content).slice(0, 400),
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
				by: v.owner,
				what: `changed ${changed.slice(0, 4).join(", ")}${changed.length > 4 ? "…" : ""}`,
				when: v.creation,
			});
	}
	const d = props.form.doc;
	if (d?.creation)
		out.push({ key: "created", by: d.owner, what: "created this", when: d.creation });
	return out.sort((a, b) => (a.when < b.when ? 1 : -1));
});

async function postComment() {
	const text = comment.value.trim();
	if (!text) return;
	if (await props.form.addComment(text)) comment.value = "";
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
