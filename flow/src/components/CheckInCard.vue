<template>
	<section
		v-if="state?.employee"
		:aria-label="__('Check in')"
		class="flex flex-wrap items-center gap-x-6 gap-y-4 rounded-2xl border border-line bg-surf px-5 py-4"
	>
		<div class="min-w-0 flex-grow">
			<div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
				<h2 class="text-[22px]">{{ headline }}</h2>
				<span v-if="state.short" class="chip bg-warn-tint text-warn">{{
					__("Short day")
				}}</span>
				<span
					v-if="state.attendance"
					class="chip"
					:class="
						state.attendance.status === 'Present'
							? 'bg-pos-tint text-pos'
							: 'bg-line-2 text-ink-2'
					"
					>{{ __(state.attendance.status) }}</span
				>
			</div>
			<p class="mt-1 text-[13.5px] text-ink-2">
				<template v-if="state.shift">
					{{ __("Check in any time. A full day is") }} {{ state.target_hours }}
					{{ __("hours") }}
				</template>
				<template v-else>{{ __("No shift set for you today") }}</template>
				<template v-if="state.hours">
					· {{ duration(state.hours) }} {{ __("today") }}</template
				>
			</p>
			<ol
				v-if="state.logs.length"
				:aria-label="__('Today\'s check-ins')"
				class="mt-2 flex flex-wrap gap-1.5"
			>
				<li
					v-for="log in state.logs"
					:key="log.name"
					class="chip"
					:class="
						log.log_type === 'IN' ? 'bg-pos-tint text-pos' : 'bg-line-2 text-ink-2'
					"
				>
					{{ log.log_type === "IN" ? __("In") : __("Out") }} {{ time(log.time) }}
				</li>
			</ol>
			<p v-if="state.working_on && state.next === 'OUT'" class="mt-2 text-[13.5px] text-ink-2">
				<span class="font-medium text-ink">{{ __("Working on") }}:</span>
				{{ state.working_on }}
			</p>
			<div v-if="state.next === 'IN'" class="mt-3">
				<label for="checkin-note" class="text-[12.5px] font-medium text-ink-2">{{
					__("What are you working on? (optional)")
				}}</label>
				<textarea
					id="checkin-note"
					v-model="note"
					rows="2"
					:maxlength="NOTE_MAX_LENGTH"
					:disabled="busy"
					class="mt-1 block w-full resize-none rounded-lg border border-line bg-surf px-3 py-2 text-[14px] text-ink placeholder:text-mut focus:border-ink focus:outline-none"
					:placeholder="__('For example: reviewing the Q3 filing')"
				/>
			</div>
			<p v-if="error" role="alert" class="mt-2 text-[13px] text-neg">{{ error }}</p>
		</div>
		<button
			type="button"
			class="btn-ink h-11 px-5 text-[15px]"
			:disabled="busy"
			@click="checkInOrOut"
		>
			<Icon :name="state.next === 'IN' ? 'door' : 'x'" :size="16" />
			{{
				busy
					? locating
						? __("Finding your location…")
						: __("Saving…")
					: state.next === "IN"
					  ? __("Check in")
					  : __("Check out")
			}}
		</button>
	</section>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { call } from "frappe-ui";
import Icon from "@/components/Icon.vue";
import { messageOf } from "@/engine/form";
import { __ } from "@/composables/i18n";

const M = "hrms.briskrew.attendance";
const NOTE_MAX_LENGTH = 500;

const state = ref(null);
const note = ref("");
const busy = ref(false);
const locating = ref(false);
const error = ref("");

const headline = computed(() => {
	const s = state.value;
	if (!s.logs.length) return __("You haven't checked in today");
	const last = s.logs[s.logs.length - 1];
	return last.log_type === "IN"
		? `${__("You're in since")} ${time(s.logs.find((l) => l.log_type === "IN").time)}`
		: `${__("Checked out at")} ${time(last.time)}`;
});

const time = (t) =>
	t
		? new Date(String(t).replace(" ", "T")).toLocaleTimeString([], {
				hour: "2-digit",
				minute: "2-digit",
		  })
		: "";
const duration = (h) => {
	const m = Math.round(h * 60);
	return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
};

// The browser's position, when check-ins record where people are.
function position() {
	return new Promise((resolve, reject) => {
		if (!window.isSecureContext) {
			reject(
				new Error(
					__(
						"Browsers only share your location with sites served over HTTPS. Ask your administrator to serve this site over HTTPS.",
					),
				),
			);
			return;
		}
		if (!navigator.geolocation) {
			reject(
				new Error(
					__("This browser can't share your location, which is needed to check in."),
				),
			);
			return;
		}
		navigator.geolocation.getCurrentPosition(
			(p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
			(e) =>
				reject(
					new Error(
						e.code === e.PERMISSION_DENIED
							? __(
									"Location is needed to check in. Allow location for this site in your browser, then try again.",
							  )
							: __("Couldn't find your location. Try again in a moment."),
					),
				),
			{ enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 },
		);
	});
}

async function checkInOrOut() {
	busy.value = true;
	error.value = "";
	try {
		let where = {};
		if (state.value.needs_location) {
			locating.value = true;
			where = await position();
			locating.value = false;
		}
		const checkingIn = state.value.next === "IN";
		state.value = await call(`${M}.check`, {
			log_type: state.value.next,
			...where,
			...(checkingIn && note.value.trim() ? { note: note.value.trim() } : {}),
		});
		note.value = "";
	} catch (e) {
		error.value = messageOf(e);
	} finally {
		busy.value = false;
		locating.value = false;
	}
}

onMounted(async () => {
	try {
		state.value = await call(`${M}.my_checkin`);
	} catch {
		state.value = null; // the card simply doesn't show
	}
});
</script>
