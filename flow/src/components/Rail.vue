<template>
	<nav
		aria-label="Areas"
		class="flex w-[68px] shrink-0 flex-col items-center gap-0.5 bg-ink px-0 pb-3.5 pt-3"
	>
		<router-link
			to="/"
			:aria-label="`${brand.name} home`"
			class="mb-3 flex h-[38px] w-[38px] items-center justify-center rounded-[11px] bg-lime pb-[3px] font-display text-[22px] font-extrabold text-ink"
		>
			{{ brand.mark }}
		</router-link>

		<router-link
			v-for="area in areas"
			:key="area.key"
			:to="entryFor(area)"
			:aria-current="area.key === active ? 'page' : undefined"
			class="relative flex w-14 flex-col items-center gap-[3px] rounded-[10px] pb-1.5 pt-[7px] text-[10.5px] transition-colors"
			:class="
				area.key === active
					? 'bg-ink-nav font-bold text-surf'
					: 'font-medium text-ink-navtext hover:bg-ink-nav/60'
			"
		>
			<Icon :name="area.icon" :size="20" :class="area.key === active ? 'text-lime' : ''" />
			{{ area.label }}
			<span
				v-if="area.key === 'inbox' && inboxCount"
				class="absolute right-2 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-lime px-1 text-[10px] font-extrabold text-ink"
			>
				{{ inboxCount > 99 ? "99+" : inboxCount }}
			</span>
		</router-link>

		<div class="mt-auto flex flex-col items-center gap-2.5">
			<a
				href="/app/hr-settings"
				class="flex w-14 flex-col items-center gap-[3px] rounded-[10px] pb-1.5 pt-[7px] text-[10.5px] font-medium text-ink-navtext hover:bg-ink-nav/60"
			>
				<Icon name="gear" :size="20" />
				Setup
			</a>
			<div class="relative" @keydown.esc="menuOpen = false">
				<button
					ref="avatarBtn"
					type="button"
					aria-label="Your account"
					aria-haspopup="menu"
					:aria-expanded="menuOpen"
					class="inline-flex rounded-full ring-2 ring-lime"
					@click="menuOpen = !menuOpen"
				>
					<Avatar :label="fullName" :size="32" />
				</button>
				<div v-if="menuOpen" class="fixed inset-0 z-40" @click="menuOpen = false" />
				<div
					v-if="menuOpen"
					role="menu"
					aria-label="Your account"
					class="absolute bottom-0 left-full z-50 ml-3 w-60 overflow-hidden rounded-xl border border-line bg-surf py-1.5 text-[13.5px] text-ink shadow-xl"
				>
					<div class="border-b border-line-2 px-3.5 pb-2.5 pt-1.5">
						<div class="truncate font-bold">{{ fullName }}</div>
						<div class="truncate text-[12px] text-mut">{{ user }}</div>
					</div>
					<router-link
						to="/about"
						role="menuitem"
						class="block px-3.5 py-2 hover:bg-side"
						@click="menuOpen = false"
						>About and licences</router-link
					>
					<a href="/app" role="menuitem" class="block px-3.5 py-2 hover:bg-side"
						>Classic desk</a
					>
					<button
						type="button"
						role="menuitem"
						class="block w-full border-t border-line-2 px-3.5 py-2 text-left font-semibold text-neg hover:bg-neg-tint"
						:disabled="loggingOut"
						@click="logout"
					>
						{{ loggingOut ? "Logging out…" : "Log out" }}
					</button>
				</div>
			</div>
		</div>
	</nav>
</template>

<script setup>
import Icon from "./Icon.vue";
import Avatar from "./Avatar.vue";
import { areas } from "@/nav";
import { brand } from "@/brand";
import { useSession } from "@/composables/session";
import { inboxCount, fetchInbox } from "@/composables/inbox";
import { onMounted, ref } from "vue";

defineProps({ active: { type: String, default: null } });

const { fullName, user } = useSession();
const menuOpen = ref(false);
const loggingOut = ref(false);

async function logout() {
	loggingOut.value = true;
	try {
		await fetch("/api/method/logout", {
			method: "POST",
			headers: { "X-Frappe-CSRF-Token": window.csrf_token || "" },
		});
	} finally {
		window.location.href = "/login";
	}
}

onMounted(() => fetchInbox().catch(() => {}));

function entryFor(area) {
	if (area.to) return area.to;
	const first = area.sections.flatMap((s) => s.items).find((i) => i.doctype);
	return first ? { name: "List", params: { doctype: first.doctype } } : "/";
}
</script>
