<template>
	<!-- The other apps on this site (ERPNext, the classic Frappe HR desk, Framework tools), like
	     the desk's app screen. briskrew covers HR; the rest open in the classic desk. -->
	<div class="relative" @keydown.esc="open = false">
		<button
			type="button"
			aria-label="Apps"
			aria-haspopup="dialog"
			:aria-expanded="open"
			class="flex h-8 w-8 items-center justify-center rounded-lg text-ink-2 hover:bg-side"
			@click="toggle"
		>
			<Icon name="apps" :size="18" />
		</button>
		<div v-if="open" class="fixed inset-0 z-40" @click="open = false" />
		<div
			v-if="open"
			role="dialog"
			aria-label="Apps"
			class="fixed inset-x-2 top-14 z-50 flex max-h-[calc(100dvh-72px)] flex-col overflow-hidden rounded-xl border border-line bg-surf text-ink shadow-xl md:absolute md:inset-x-auto md:right-0 md:top-full md:mt-2 md:max-h-[min(640px,80vh)] md:w-[520px]"
		>
			<div class="flex items-center gap-2 border-b border-line-2 px-4 py-3">
				<span class="flex-grow text-[14px] font-bold">{{ __("Apps") }}</span>
				<a
					:href="data?.home || '/apps'"
					class="text-[12.5px] font-semibold text-acc hover:underline"
					>{{ __("Open the app screen") }}</a
				>
			</div>
			<div class="min-h-0 flex-grow overflow-y-auto px-3 pb-3">
				<div v-if="loading && !data" class="px-2 py-8 text-center text-[13px] text-mut">
					{{ __("Loading…") }}
				</div>
				<p v-else-if="error" class="px-2 py-6 text-[13px] text-neg">{{ error }}</p>
				<template v-else-if="data">
					<section class="pt-3">
						<div class="kicker px-1 pb-2">{{ __("You're in") }}</div>
						<router-link
							to="/"
							class="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-side"
							@click="open = false"
						>
							<span
								class="flex h-10 w-10 items-center justify-center rounded-[11px] bg-lime pb-[2px] font-display text-[20px] font-extrabold text-ink"
								>{{ brand.mark }}</span
							>
							<span class="min-w-0">
								<span class="block text-[13.5px] font-bold">{{ brand.name }}</span>
								<span class="block text-[12px] text-mut"
									>People, time, pay, expenses, hiring and growth</span
								>
							</span>
						</router-link>
					</section>
					<section v-for="g in data.groups" :key="g.app" class="pt-4">
						<div class="flex items-baseline gap-2 px-1 pb-2">
							<span class="kicker">{{ g.title }}</span>
							<span v-if="g.app === 'hrms'" class="text-[11.5px] text-mut"
								>classic desk · briskrew covers these</span
							>
						</div>
						<ul class="grid grid-cols-3 gap-1 sm:grid-cols-4">
							<li v-for="i in g.items" :key="i.route">
								<a
									:href="href(i.route)"
									class="flex flex-col items-center gap-1.5 rounded-lg px-1 py-2.5 text-center hover:bg-side"
								>
									<img
										v-if="i.icon && !broken.has(i.icon)"
										:src="i.icon"
										alt=""
										class="h-10 w-10 rounded-[11px]"
										@error="broken.add(i.icon)"
									/>
									<span
										v-else
										class="flex h-10 w-10 items-center justify-center rounded-[11px] text-[16px] font-bold text-white"
										:style="{ background: tint(g.app) }"
										>{{ i.label.slice(0, 1) }}</span
									>
									<span
										class="line-clamp-2 text-[12px] font-medium leading-tight"
										>{{ i.label }}</span
									>
								</a>
							</li>
						</ul>
					</section>
				</template>
			</div>
		</div>
	</div>
</template>

<script setup>
import { call } from "frappe-ui";
import { reactive, ref } from "vue";
import Icon from "./Icon.vue";
import { brand } from "@/brand";
import { messageOf } from "@/engine/form";

const open = ref(false);
const loading = ref(false);
const data = ref(null);
const error = ref("");
const broken = reactive(new Set());

async function toggle() {
	open.value = !open.value;
	if (!open.value || data.value) return;
	loading.value = true;
	try {
		data.value = await call("hrms.briskrew.api.apps");
	} catch (e) {
		error.value = messageOf(e, "Couldn't load the apps.");
	} finally {
		loading.value = false;
	}
}

// Workspace names can carry "&" and spaces; each path segment is encoded on its own.
const href = (route) => route.split("/").map(encodeURIComponent).join("/");
const tint = (app) =>
	({ erpnext: "#0089FF", hrms: "#1BAF7A", frappe: "#6B7083" })[app] || "#2B3FE0";
</script>
