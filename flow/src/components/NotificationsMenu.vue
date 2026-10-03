<template>
	<div class="relative" @keydown.esc="open = false">
		<button
			type="button"
			:aria-label="unread ? `Notifications, ${unread} unread` : 'Notifications'"
			aria-haspopup="dialog"
			:aria-expanded="open"
			class="relative flex h-8 w-8 items-center justify-center rounded-lg text-ink-2 hover:bg-side"
			@click="toggle"
		>
			<Icon name="bell" :size="18" />
			<span
				v-if="unread"
				class="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-acc px-1 text-[10px] font-extrabold text-white"
			>
				{{ unread > 99 ? "99+" : unread }}
			</span>
		</button>
		<div v-if="open" class="fixed inset-0 z-40" @click="open = false" />
		<div
			v-if="open"
			role="dialog"
			aria-label="Notifications"
			class="absolute right-0 top-full z-50 mt-2 flex max-h-[min(560px,80vh)] w-[min(380px,calc(100vw-16px))] flex-col overflow-hidden rounded-xl border border-line bg-surf text-ink shadow-xl"
		>
			<div class="flex items-center gap-2 border-b border-line-2 px-4 py-3">
				<span class="flex-grow text-[14px] font-bold">Notifications</span>
				<button
					v-if="unread"
					type="button"
					class="text-[12.5px] font-semibold text-acc hover:underline"
					@click="markAll"
				>
					Mark all as read
				</button>
			</div>
			<div class="min-h-0 flex-grow overflow-y-auto">
				<div
					v-if="loading && !items.length"
					class="px-4 py-8 text-center text-[13px] text-mut"
				>
					Loading…
				</div>
				<div v-else-if="!items.length" class="px-4 py-10 text-center text-[13px] text-mut">
					You're all caught up.
				</div>
				<button
					v-for="n in items"
					:key="n.name"
					type="button"
					class="flex w-full items-start gap-3 border-b border-line-2 px-4 py-3 text-left last:border-b-0 hover:bg-side"
					@click="openItem(n)"
				>
					<Avatar :label="names[n.from_user] || n.from_user || 'System'" :size="28" />
					<span class="min-w-0 flex-grow">
						<span
							class="line-clamp-3 block text-[13px] leading-snug"
							:class="n.read ? 'text-ink-2' : 'font-semibold text-ink'"
							>{{ plainText(n.subject) || n.document_name }}</span
						>
						<span class="mt-0.5 block text-[11.5px] text-mut">
							{{ ago(n.creation) }}
							<template v-if="n.document_type"> · {{ n.document_type }}</template>
						</span>
					</span>
					<span
						v-if="!n.read"
						aria-label="Unread"
						class="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-acc"
					/>
				</button>
			</div>
			<div class="flex border-t border-line-2 text-[12.5px]">
				<router-link
					:to="{ name: 'List', params: { doctype: 'Notification Log' } }"
					class="flex-1 px-4 py-2.5 font-semibold text-ink-2 hover:bg-side"
					@click="open = false"
					>See all</router-link
				>
				<router-link
					:to="{
						name: 'Form',
						params: { doctype: 'Notification Settings', name: user },
					}"
					class="flex-1 border-l border-line-2 px-4 py-2.5 text-right font-semibold text-ink-2 hover:bg-side"
					@click="open = false"
					>Settings</router-link
				>
			</div>
		</div>
	</div>
</template>

<script setup>
import { call } from "frappe-ui";
import { onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import Icon from "./Icon.vue";
import Avatar from "./Avatar.vue";
import { ago, plainText } from "@/composables/format";
import { useSession } from "@/composables/session";

const router = useRouter();
const { user } = useSession();
const open = ref(false);
const loading = ref(false);
const unread = ref(0);
const items = ref([]);
const names = ref({});

async function refreshCount() {
	unread.value = (await call("hrms.briskrew.api.unread_notifications").catch(() => 0)) || 0;
}

async function load() {
	loading.value = true;
	try {
		const res = await call(
			"frappe.desk.doctype.notification_log.notification_log.get_notification_logs",
			{
				limit: 30,
			},
		);
		items.value = res?.notification_logs || [];
		names.value = Object.fromEntries(
			Object.entries(res?.user_info || {}).map(([k, v]) => [k, v.fullname || k]),
		);
	} catch {
		items.value = [];
	} finally {
		loading.value = false;
	}
}

function toggle() {
	open.value = !open.value;
	if (open.value) load();
}

async function markAll() {
	await call("frappe.desk.doctype.notification_log.notification_log.mark_all_as_read").catch(
		() => {},
	);
	items.value = items.value.map((n) => ({ ...n, read: 1 }));
	unread.value = 0;
}

async function openItem(n) {
	open.value = false;
	if (!n.read) {
		n.read = 1;
		unread.value = Math.max(0, unread.value - 1);
		call("frappe.desk.doctype.notification_log.notification_log.mark_as_read", {
			docname: n.name,
		}).catch(() => {});
	}
	if (n.document_type && n.document_name)
		router.push({ name: "Form", params: { doctype: n.document_type, name: n.document_name } });
	else if (n.link) window.location.href = n.link;
}

// New notifications show up within a minute, and as soon as the tab is looked at again.
let timer;
const onFocus = () => document.visibilityState === "visible" && refreshCount();
onMounted(() => {
	refreshCount();
	timer = setInterval(() => document.visibilityState === "visible" && refreshCount(), 60_000);
	document.addEventListener("visibilitychange", onFocus);
});
onBeforeUnmount(() => {
	clearInterval(timer);
	document.removeEventListener("visibilitychange", onFocus);
});
</script>
