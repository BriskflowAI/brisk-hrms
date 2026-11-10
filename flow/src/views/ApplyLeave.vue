<template>
	<div class="flex h-full min-h-0 flex-col">
		<header class="flex items-center gap-3 border-b border-line px-4 py-4 md:px-7">
			<router-link
				:to="back"
				class="rounded-md p-1 text-ink-2 hover:bg-side hover:text-ink"
				:aria-label="__('Back to my leave')"
			>
				<Icon name="chevl" :size="18" />
			</router-link>
			<h1 class="text-[22px] leading-none md:text-[26px]">{{ __("Apply leave") }}</h1>
		</header>

		<form class="flex min-h-0 flex-grow flex-col" novalidate @submit.prevent="submit">
			<div class="min-h-0 flex-grow overflow-y-auto bg-paper px-4 pb-8 pt-5 md:px-7">
				<div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
					<section
						:aria-label="__('Leave')"
						class="rounded-xl border border-line bg-surf p-4 md:p-6"
					>
						<h2 class="border-b border-line-2 pb-2.5 text-[14px] font-semibold">
							{{ __("Leave") }}
						</h2>

						<div
							class="mt-4 grid gap-4 md:grid-cols-[150px_minmax(0,1fr)] md:items-start"
						>
							<label for="leave-type" class="pt-2 text-[13.5px] text-ink-2"
								>{{ __("Leave type") }} <span class="text-neg">*</span></label
							>
							<select id="leave-type" v-model="leaveType" :class="inputCls" required>
								<option v-if="!types.length" value="" disabled>
									{{ __("No leave types are available to you") }}
								</option>
								<option v-for="t in types" :key="t" :value="t">{{ t }}</option>
							</select>

							<span class="pt-2 text-[13.5px] text-ink-2"
								>{{ __("Date") }} <span class="text-neg">*</span></span
							>
							<div class="grid grid-cols-2 gap-3">
								<label class="flex flex-col gap-1 text-[12px] text-mut"
									>{{ __("From") }}
									<input v-model="from" type="date" :class="inputCls" required />
								</label>
								<label class="flex flex-col gap-1 text-[12px] text-mut"
									>{{ __("To") }}
									<input
										v-model="to"
										type="date"
										:min="from"
										:class="inputCls"
										required
									/>
								</label>
							</div>

							<template v-if="preview">
								<span class="hidden md:block" />
								<div class="overflow-hidden rounded-lg border border-line-2">
									<ul class="max-h-[280px] overflow-y-auto">
										<li
											v-for="d in preview.day_rows"
											:key="d.date"
											class="flex items-center justify-between gap-3 border-b border-line-2 px-3 py-2 text-[13px]"
										>
											<span
												class="tabular-nums"
												:class="d.off && 'text-mut'"
												>{{ dayLabel(d.date) }}</span
											>
											<span
												v-if="d.off"
												class="h-8 w-[140px] rounded-md bg-line-2 px-2.5 py-1.5 text-[12.5px] text-mut"
												>{{
													d.off === "weekly_off" ? __("Weekend") : d.off
												}}</span
											>
											<select
												v-else
												class="h-8 w-[140px] rounded-md border border-line bg-surf px-2 py-0 text-[12.5px]"
												:value="halfDayDate === d.date ? 'half' : 'full'"
												:aria-label="`${dayLabel(d.date)}: ${__(
													'Duration',
												)}`"
												@change="
													setHalf(d.date, $event.target.value === 'half')
												"
											>
												<option value="full">{{ __("Full day") }}</option>
												<option value="half">{{ __("Half day") }}</option>
											</select>
										</li>
									</ul>
									<div
										class="flex justify-between bg-side px-3 py-2 text-[13px] font-semibold"
									>
										<span>{{ __("Total") }}</span>
										<span class="tabular-nums">{{ days(preview.days) }}</span>
									</div>
								</div>
								<span class="hidden md:block" />
								<p class="-mt-2 text-[12px] text-mut">
									{{ __("You can mark one half day per request.") }}
								</p>
							</template>

							<label for="leave-reason" class="pt-2 text-[13.5px] text-ink-2">{{
								__("Reason for leave")
							}}</label>
							<textarea
								id="leave-reason"
								v-model="reason"
								rows="3"
								class="w-full rounded-lg border border-line bg-surf px-3 py-2 text-[13.5px] text-ink focus:border-acc focus:ring-1 focus:ring-acc"
							/>
						</div>
					</section>

					<aside :aria-label="__('Balance')" class="flex flex-col gap-3">
						<div class="rounded-xl border border-line bg-surf p-4 text-[13px]">
							<template v-if="preview?.balance">
								<div
									class="flex justify-between border-b border-line-2 pb-2 font-semibold"
								>
									<span
										>{{ __("As on") }}
										{{ periodDate(preview.balance.as_on) }}</span
									>
									<span class="text-ink-2">{{ __("Day(s)") }}</span>
								</div>
								<dl class="mt-2 grid grid-cols-[1fr_auto] gap-y-1.5">
									<dt class="text-ink-2">{{ __("Available balance") }}</dt>
									<dd class="font-semibold tabular-nums text-pos">
										{{ qty(preview.balance.available) }}
									</dd>
									<dt class="text-ink-2">{{ __("Current booking") }}</dt>
									<dd class="font-semibold tabular-nums">
										{{ qty(preview.days) }}
									</dd>
									<dt class="text-acc">
										{{ __("Balance after current booking") }}
									</dt>
									<dd
										class="font-semibold tabular-nums"
										:class="
											preview.balance.after < 0 ? 'text-neg' : 'text-ink'
										"
									>
										{{ qty(preview.balance.after) }}
									</dd>
								</dl>
								<p
									v-if="preview.balance.after < 0"
									class="mt-2 text-[12.5px] text-neg"
								>
									{{ __("This is more than your balance.") }}
								</p>
							</template>
							<p v-else-if="preview && !preview.paid" class="text-ink-2">
								{{
									__(
										"Unpaid leave doesn't use a balance; it's deducted from your pay.",
									)
								}}
							</p>
							<p v-else class="text-mut">
								{{ __("Pick a leave type and dates to see your balance.") }}
							</p>
						</div>
						<div
							v-if="preview?.approver"
							class="rounded-xl border border-line bg-surf p-4 text-[13px]"
						>
							{{ __("Goes to") }}
							<b>{{ preview.approver.name }}</b>
							{{ __("for approval") }}
						</div>
						<router-link
							:to="{ name: 'MyLeave', query: { tab: 'requests' } }"
							class="text-[12.5px] font-semibold text-acc hover:underline"
							>{{ __("View my leave requests") }}</router-link
						>
					</aside>
				</div>

				<p
					v-if="error"
					role="alert"
					class="mt-4 rounded-lg bg-neg-tint px-4 py-3 text-[13.5px] text-neg"
				>
					{{ error }}
				</p>
			</div>

			<footer class="flex gap-2 border-t border-line bg-surf px-4 py-3 md:px-7">
				<button type="submit" class="btn-ink" :disabled="!canSubmit">
					{{ sending ? __("Sending…") : __("Submit") }}
				</button>
				<router-link :to="back" class="btn-ghost">{{ __("Cancel") }}</router-link>
			</footer>
		</form>
	</div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { call } from "frappe-ui";
import Icon from "@/components/Icon.vue";
import { messageOf } from "@/engine/form";
import { qty } from "@/composables/format";
import { __ } from "@/composables/i18n";
import { M, dayLabel, days, iso, periodDate } from "@/composables/leave";

const route = useRoute();
const router = useRouter();

const inputCls =
	"h-9 w-full rounded-lg border border-line bg-surf px-3 text-[13.5px] text-ink focus:border-acc focus:ring-1 focus:ring-acc";

const today = iso(new Date());
const types = ref([]);
const leaveType = ref("");
const from = ref(route.query.from || today);
const to = ref(route.query.to || route.query.from || today);
const halfDayDate = ref(null);
const reason = ref("");
const preview = ref(null);
const error = ref("");
const sending = ref(false);

const back = { name: "MyLeave" };
const canSubmit = computed(
	() => !sending.value && leaveType.value && from.value && to.value && preview.value?.days > 0,
);

onMounted(async () => {
	try {
		types.value = await call(`${M}.leave_types`);
		const wanted = route.query.type;
		leaveType.value = types.value.includes(wanted) ? wanted : types.value[0] || "";
	} catch (e) {
		error.value = messageOf(e, "Couldn't load your leave types.");
	}
});

watch(from, (f) => {
	if (to.value < f) to.value = f;
});
watch([from, to], () => {
	if (halfDayDate.value && (halfDayDate.value < from.value || halfDayDate.value > to.value))
		halfDayDate.value = null;
});

let seq = 0;
watch(
	[leaveType, from, to, halfDayDate],
	async () => {
		if (!leaveType.value || !from.value || !to.value || to.value < from.value) {
			preview.value = null;
			return;
		}
		const mine = ++seq;
		try {
			const res = await call(`${M}.preview`, payload());
			if (mine === seq) {
				preview.value = res;
				error.value = "";
			}
		} catch (e) {
			if (mine === seq) {
				preview.value = null;
				error.value = messageOf(e, "Couldn't work out the days for these dates.");
			}
		}
	},
	{ immediate: true },
);

function payload() {
	return {
		leave_type: leaveType.value,
		from_date: from.value,
		to_date: to.value,
		half_day: halfDayDate.value ? 1 : 0,
		half_day_date: halfDayDate.value,
	};
}

function setHalf(date, half) {
	if (half) halfDayDate.value = date;
	else if (halfDayDate.value === date) halfDayDate.value = null;
}

async function submit() {
	if (!canSubmit.value) return;
	sending.value = true;
	error.value = "";
	try {
		await call(`${M}.apply`, { ...payload(), reason: reason.value || null });
		router.push({ name: "MyLeave", query: { tab: "requests", sent: 1 } });
	} catch (e) {
		error.value = messageOf(e, "Couldn't send your leave request.");
	} finally {
		sending.value = false;
	}
}
</script>
