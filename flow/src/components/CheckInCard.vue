<template>
	<section
		v-if="state?.employee"
		:aria-label="__('Check in')"
		class="checkin relative overflow-hidden rounded-[28px] bg-gradient-to-br from-sky-top via-sky-mid to-sky-end p-2"
	>
		<div
			aria-hidden="true"
			class="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-white/45 blur-3xl"
		/>
		<div class="checkin-grid relative grid gap-2">
			<div class="relative isolate flex min-w-0 flex-col px-4 pb-5 pt-4 md:px-6 md:py-6">
				<svg
					aria-hidden="true"
					class="absolute inset-y-0 right-0 -z-10 h-full w-full max-w-[620px] [mask-image:linear-gradient(100deg,transparent_5%,black_60%)]"
					:viewBox="map.box"
					preserveAspectRatio="xMidYMid slice"
				>
					<path
						:d="WORLD.path"
						fill="none"
						stroke="currentColor"
						stroke-width="1.15"
						stroke-linecap="round"
						class="text-ink/[0.13]"
					/>
					<g v-if="map.pin">
						<circle
							:cx="map.pin.x"
							:cy="map.pin.y"
							r="3"
							class="origin-center animate-ping fill-acc/40 [transform-box:fill-box] motion-reduce:animate-none"
						/>
						<circle
							:cx="map.pin.x"
							:cy="map.pin.y"
							r="1.9"
							class="fill-acc stroke-surf"
							stroke-width="0.7"
						/>
					</g>
				</svg>
				<div class="flex flex-wrap items-center gap-2">
					<span class="frost inline-flex items-center gap-2 text-ink">
						<span class="relative flex h-2 w-2">
							<span
								v-if="phase === 'in'"
								class="absolute inline-flex h-full w-full animate-ping rounded-full bg-pos opacity-60 motion-reduce:animate-none"
							/>
							<span
								class="relative inline-flex h-2 w-2 rounded-full"
								:class="dotClass"
							/>
						</span>
						{{ statusLabel }}
					</span>
					<span
						v-if="state.attendance"
						class="frost"
						:class="state.attendance.status === 'Present' ? 'text-pos' : 'text-ink-2'"
						>{{ __(state.attendance.status) }}</span
					>
					<span
						v-if="state.short && liveHours >= state.absent_below"
						class="frost text-warn"
						>{{ __("Short day") }}</span
					>
				</div>

				<span
					:role="phase === 'in' ? 'timer' : undefined"
					:aria-label="phase === 'in' ? __('Time since you checked in') : undefined"
					class="mt-6 font-display text-[52px] font-semibold leading-none tracking-tight text-ink tabular-nums md:text-[72px]"
					>{{ hero }}</span
				>
				<span class="mt-2 text-[14.5px] text-ink-2">{{ heroCaption }}</span>

				<div v-if="state.logs.length" class="mt-auto pt-7">
					<div class="flex items-baseline justify-between text-[13px]">
						<span class="font-semibold text-ink">{{ barLabel }}</span>
						<span class="text-ink-2">{{ __("of") }} {{ state.target_hours }}h</span>
					</div>
					<div
						role="progressbar"
						:aria-label="__('Hours worked today')"
						:aria-valuenow="Math.round(liveHours * 10) / 10"
						aria-valuemin="0"
						:aria-valuemax="state.target_hours"
						class="relative mt-2 h-3 rounded-full border border-white/70 bg-white/50"
					>
						<div
							class="h-full rounded-full transition-[width] duration-700 ease-out"
							:class="fillClass"
							:style="{ width: `${progress}%` }"
						/>
						<span
							class="absolute -top-1.5 h-5 w-0.5 rounded-full bg-ink/40"
							:style="{ left: `${absentMark}%` }"
							aria-hidden="true"
						/>
					</div>
					<div class="relative mt-1.5 h-4 text-[11.5px] text-ink-2" aria-hidden="true">
						<span class="absolute -translate-x-1/2" :style="{ left: `${absentMark}%` }"
							>{{ state.absent_below }}h · {{ __("present") }}</span
						>
						<span class="absolute right-0"
							>{{ state.target_hours }}h · {{ __("full day") }}</span
						>
					</div>
					<p v-if="hint" class="mt-2 text-[13px] text-ink-2">{{ hint }}</p>
				</div>
			</div>

			<div
				class="flex flex-col gap-4 rounded-[22px] bg-surf p-5 shadow-[0_12px_32px_-14px_rgba(14,20,51,0.35)] md:p-6"
			>
				<div class="flex items-center gap-3">
					<span
						class="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line-2 bg-paper text-ink"
						aria-hidden="true"
					>
						<Icon name="clock" :size="19" />
					</span>
					<div class="min-w-0">
						<div class="text-[13px] text-mut">{{ panelKicker }}</div>
						<div class="text-[17px] font-semibold text-ink">{{ panelTitle }}</div>
					</div>
				</div>

				<div v-if="rows.length" class="border-t border-line-2 pt-4">
					<h3 class="text-[14px] font-semibold text-ink">{{ __("Today's time") }}</h3>
					<dl class="mt-2.5 flex flex-col gap-2.5">
						<div
							v-for="row in rows"
							:key="row.label + row.value"
							class="flex items-baseline gap-2 text-[13.5px]"
						>
							<dt class="text-ink-2">{{ row.label }}</dt>
							<span
								aria-hidden="true"
								class="min-w-[24px] flex-1 -translate-y-1 border-b border-dashed border-line"
							/>
							<dd class="font-medium text-ink tabular-nums">{{ row.value }}</dd>
						</div>
					</dl>
				</div>

				<div
					v-if="phase === 'in' && state.working_on"
					class="rounded-2xl bg-paper px-4 py-3"
				>
					<div class="kicker">{{ __("Working on") }}</div>
					<p class="mt-1 break-words text-[14px] text-ink">{{ state.working_on }}</p>
				</div>

				<div v-if="state.next === 'IN'">
					<label for="checkin-note" class="text-[13px] font-semibold text-ink">{{
						__("What are you working on?")
					}}</label>
					<span class="text-[13px] text-mut"> · {{ __("optional") }}</span>
					<textarea
						id="checkin-note"
						v-model="note"
						rows="2"
						:maxlength="NOTE_MAX_LENGTH"
						:disabled="busy"
						class="mt-1.5 block w-full resize-none rounded-2xl border border-line bg-paper px-4 py-3 text-[14px] text-ink placeholder:text-mut focus:border-acc focus:bg-surf focus:outline-none focus:ring-2 focus:ring-acc-tint"
						:placeholder="__('For example: reviewing the Q3 filing')"
					/>
				</div>

				<button
					type="button"
					class="mt-auto inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-[15px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acc disabled:opacity-70"
					:class="
						state.next === 'IN'
							? 'bg-acc text-surf hover:bg-acc-hover'
							: 'bg-ink text-surf hover:bg-ink-nav'
					"
					:disabled="busy"
					@click="checkInOrOut"
				>
					<Icon
						:name="state.next === 'IN' ? 'clock-in' : 'clock-out'"
						:size="17"
						:stroke="2"
					/>
					{{ buttonLabel }}
				</button>
				<p v-if="error" role="alert" class="text-[13px] text-neg">{{ error }}</p>
			</div>
		</div>
	</section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { call } from "frappe-ui";
import Icon from "@/components/Icon.vue";
import { messageOf } from "@/engine/form";
import { __ } from "@/composables/i18n";
import { WORLD } from "@/components/worldDots";

const M = "hrms.briskrew.attendance";
const NOTE_MAX_LENGTH = 500;

const state = ref(null);
const note = ref("");
const busy = ref(false);
const locating = ref(false);
const error = ref("");

// The server says how long the open check-in has been running; the screen counts on from the
// moment that answer arrived, so it doesn't depend on this device's clock or time zone.
const now = ref(Date.now());
let receivedAt = Date.now();
let ticker = null;
watch(state, () => (receivedAt = Date.now()), { flush: "sync" });
const elapsed = computed(() => Math.max(0, Math.floor((now.value - receivedAt) / 1000)));

const phase = computed(() => {
	const s = state.value;
	if (s.next === "OUT") return "in";
	return s.logs.length ? "done" : "fresh";
});

const liveHours = computed(() => {
	const s = state.value;
	return (s.hours || 0) + (phase.value === "in" ? elapsed.value / 3600 : 0);
});

const pad = (n) => String(n).padStart(2, "0");
const clock = computed(() => {
	const total = (state.value.since_seconds || 0) + elapsed.value;
	return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
});

const firstIn = computed(() => state.value.logs.find((l) => l.log_type === "IN"));
const lastLog = computed(() => state.value.logs[state.value.logs.length - 1]);
const openIn = computed(() => (phase.value === "in" ? lastLog.value : null));

const statusLabel = computed(
	() =>
		({
			fresh: __("Not checked in"),
			in: __("On the clock"),
			done: __("Checked out"),
		})[phase.value],
);
const dotClass = computed(
	() => ({ fresh: "bg-mut", in: "bg-pos", done: "bg-ink-2" })[phase.value],
);

const hero = computed(() => {
	if (phase.value === "in") return clock.value;
	if (phase.value === "done") return duration(liveHours.value);
	return new Date(now.value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
});

const heroCaption = computed(() => {
	const s = state.value;
	if (phase.value === "in") return __("since you checked in");
	if (phase.value === "done") return __("worked today");
	if (!s.shift) return __("No shift set for you today");
	return `${__("Check in any time. A full day is")} ${s.target_hours} ${__("hours")}.`;
});

// Projected from the server's clock (check-in time plus the server-counted seconds), so the
// answer is in the same zone as the logged times even when this device's clock is not.
const at = (hoursFromNow) => {
	const serverNow =
		new Date(String(openIn.value.time).replace(" ", "T")).getTime() +
		((state.value.since_seconds || 0) + elapsed.value) * 1000;
	return new Date(serverNow + hoursFromNow * 3600 * 1000).toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
	});
};

// A window on the dotted map, wide enough to show the region, with the latest check-in
// location pinned right of centre so the timer text doesn't sit on it.
const MAP_VIEW = { w: 120, h: 90, pinX: 0.72, pinY: 0.45, fallback: { lon: 20, lat: 25 } };
const map = computed(() => {
	const located = [...state.value.logs].reverse().find((l) => l.latitude || l.longitude);
	const spot = located ? { lon: located.longitude, lat: located.latitude } : MAP_VIEW.fallback;
	const x = spot.lon + 180;
	const y = WORLD.north - spot.lat;
	const height = WORLD.north - WORLD.south;
	const clamp = (v, max) => Math.min(Math.max(v, 0), max);
	const x0 = clamp(x - MAP_VIEW.w * MAP_VIEW.pinX, 360 - MAP_VIEW.w);
	const y0 = clamp(y - MAP_VIEW.h * MAP_VIEW.pinY, height - MAP_VIEW.h);
	return { box: `${x0} ${y0} ${MAP_VIEW.w} ${MAP_VIEW.h}`, pin: located ? { x, y } : null };
});

const rows = computed(() => {
	const s = state.value;
	const h = liveHours.value;
	if (!s.logs.length) return [];
	const out = [{ label: __("Checked in"), value: time(firstIn.value.time) }];
	s.logs.forEach((log, i) => {
		const next = s.logs[i + 1];
		if (log.log_type === "OUT" && next?.log_type === "IN")
			out.push({ label: __("Break"), value: `${time(log.time)} – ${time(next.time)}` });
	});
	if (phase.value === "done")
		out.push({ label: __("Checked out"), value: time(lastLog.value.time) });
	if (phase.value === "in" && h < s.absent_below)
		out.push({ label: __("Counts as present at"), value: at(s.absent_below - h) });
	if (phase.value === "in" && h < s.target_hours)
		out.push({ label: __("Full day at"), value: at(s.target_hours - h) });
	return out;
});

const panelKicker = computed(
	() =>
		({
			fresh: __("Ready when you are"),
			in: `${__("Worked")}: ${duration(liveHours.value)}`,
			done: __("Done for now"),
		})[phase.value],
);
const panelTitle = computed(() => {
	if (phase.value === "in") return `${__("Checked in at")} ${time(openIn.value.time)}`;
	if (phase.value === "done") return `${__("Checked out at")} ${time(lastLog.value.time)}`;
	return __("Not checked in yet");
});

const progress = computed(() => Math.min(100, (liveHours.value / state.value.target_hours) * 100));
const absentMark = computed(() => (state.value.absent_below / state.value.target_hours) * 100);

const fillClass = computed(() => {
	if (phase.value === "in") return "bg-acc";
	const h = liveHours.value;
	if (h >= state.value.target_hours) return "bg-pos";
	return h >= state.value.absent_below ? "bg-warn-bar" : "bg-neg";
});

const barLabel = computed(() => {
	const s = state.value;
	const h = liveHours.value;
	if (phase.value === "in") return `${duration(h)} ${__("today")}`;
	if (h >= s.target_hours) return __("Full day");
	if (h >= s.absent_below) return `${duration(s.target_hours - h)} ${__("short of a full day")}`;
	return `${__("Under")} ${s.absent_below}h ${__("counts as absent")}`;
});

const hint = computed(() => {
	const s = state.value;
	const h = liveHours.value;
	if (phase.value !== "in") return "";
	if (h < s.absent_below)
		return `${duration(s.absent_below - h)} ${__("more until today counts as present")}`;
	if (h < s.target_hours) return `${duration(s.target_hours - h)} ${__("to a full day")}`;
	return __("Full day done.");
});

const buttonLabel = computed(() => {
	if (busy.value) return locating.value ? __("Finding your location…") : __("Saving…");
	if (state.value.next === "OUT") return __("Check out");
	return phase.value === "done" ? __("Check in again") : __("Check in");
});

const time = (t) =>
	t
		? new Date(String(t).replace(" ", "T")).toLocaleTimeString([], {
				hour: "2-digit",
				minute: "2-digit",
			})
		: "";
const duration = (h) => {
	const m = Math.max(0, Math.round(h * 60));
	return `${Math.floor(m / 60)}h ${pad(m % 60)}m`;
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
	ticker = setInterval(() => (now.value = Date.now()), 1000);
	try {
		state.value = await call(`${M}.my_checkin`);
	} catch {
		state.value = null; // the card simply doesn't show
	}
});

onBeforeUnmount(() => clearInterval(ticker));
</script>

<style scoped>
/* Laid out by the card's own width, not the screen's: the sidebars leave a 1024px screen
   with about as much room as a phone held sideways. */
.checkin {
	container-type: inline-size;
}
@container (min-width: 760px) {
	.checkin-grid {
		grid-template-columns: minmax(0, 1fr) 380px;
	}
}
</style>
