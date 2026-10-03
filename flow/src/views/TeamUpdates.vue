<template>
	<div class="flex max-w-[860px] flex-col gap-5 px-4 md:px-7 py-6">
		<header class="flex flex-wrap items-end gap-3">
			<div class="mr-auto">
				<div class="kicker">{{ __("People") }}</div>
				<h1 class="mt-1.5 text-[28px] leading-none md:text-[34px]">
					{{ __("Team updates") }}
				</h1>
				<p class="mt-2 text-[13.5px] text-mut">
					{{ __("Replies to the daily work summary emails, newest first.") }}
				</p>
			</div>
			<router-link
				:to="{ name: 'List', params: { doctype: 'Daily Work Summary Group' } }"
				class="btn-ghost"
				>{{ __("Summary groups") }}</router-link
			>
		</header>

		<p
			v-if="error"
			role="alert"
			class="rounded-lg bg-neg-tint px-4 py-3 text-[13.5px] text-neg"
		>
			{{ error }}
		</p>

		<section
			v-for="day in days"
			:key="day.label"
			:aria-label="day.label"
			class="flex flex-col gap-2.5"
		>
			<h2 class="kicker">{{ day.label }}</h2>
			<article
				v-for="(u, i) in day.items"
				:key="i"
				class="flex gap-3 rounded-xl border border-line bg-surf px-4 py-3.5"
			>
				<Avatar :label="u.sender_name" :size="32" />
				<div class="min-w-0 flex-grow">
					<div class="flex items-baseline gap-2">
						<span class="font-semibold">{{ u.sender_name }}</span>
						<span class="text-[12px] text-mut">{{ time(u.creation) }}</span>
					</div>
					<div
						class="desk-html mt-1 break-words text-[13.5px] text-ink-2"
						v-html="clean(u.content)"
					/>
				</div>
			</article>
		</section>

		<p v-if="!loading && !items.length && !error" class="text-[13.5px] text-mut">
			{{
				__(
					"No updates yet. Set up a Daily Work Summary Group to ask your team what they worked on.",
				)
			}}
		</p>
		<div v-if="loading" class="text-[13.5px] text-mut">{{ __("Loading…") }}</div>
		<button v-else-if="more" type="button" class="btn-ghost self-start" @click="load">
			{{ __("Load more") }}
		</button>
	</div>
</template>

<script setup>
import { call } from "frappe-ui";
import dayjs from "dayjs";
import { computed, onMounted, ref } from "vue";
import Avatar from "@/components/Avatar.vue";
import { messageOf } from "@/engine/form";

const items = ref([]);
const loading = ref(false);
const more = ref(true);
const error = ref("");

const time = (d) => dayjs(d).format("HH:mm");
const dayLabel = (d) => {
	const diff = dayjs().startOf("day").diff(dayjs(d).startOf("day"), "day");
	if (diff < 1) return "Today";
	if (diff < 2) return "Yesterday";
	return dayjs(d).format("dddd, D MMMM YYYY");
};
const days = computed(() => {
	const out = [];
	for (const u of items.value) {
		const label = dayLabel(u.creation);
		if (out[out.length - 1]?.label !== label) out.push({ label, items: [] });
		out[out.length - 1].items.push(u);
	}
	return out;
});

// Email bodies: keep the text and simple formatting, drop scripts, styles and handlers.
function clean(html) {
	const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
	doc.querySelectorAll("script,style,iframe,object,embed,link,meta").forEach((n) => n.remove());
	doc.querySelectorAll("*").forEach((n) => {
		for (const a of [...n.attributes])
			if (a.name.startsWith("on") || (a.name === "href" && /^\s*javascript:/i.test(a.value)))
				n.removeAttribute(a.name);
	});
	return doc.body.innerHTML;
}

async function load() {
	loading.value = true;
	try {
		const page =
			(await call("hrms.hr.page.team_updates.team_updates.get_data", {
				start: items.value.length,
			})) || [];
		items.value = [...items.value, ...page];
		more.value = page.length === 40;
	} catch (e) {
		error.value = messageOf(e, "Couldn't load team updates.");
		more.value = false;
	} finally {
		loading.value = false;
	}
}

onMounted(load);
</script>
