<template>
	<div class="relative flex h-full min-h-0 flex-col px-4 md:px-7 pt-6">
		<header class="flex flex-wrap items-end gap-3">
			<div class="mr-auto">
				<h1 class="text-[40px] leading-none">People</h1>
				<p class="mt-1.5 text-[14px] text-mut">
					{{
						loading
							? "Loading…"
							: view === "everyone"
								? peopleSummary
								: `${rows.length} ${viewLabel.toLowerCase()}`
					}}
				</p>
			</div>
			<router-link :to="{ name: 'List', params: { doctype: 'Employee' } }" class="btn-ghost"
				>Table view</router-link
			>
			<router-link
				:to="{ name: 'Form', params: { doctype: 'Employee', name: 'new' } }"
				class="btn-ink"
				><Icon name="plus" :size="15" /> Add person</router-link
			>
		</header>

		<div class="mt-4 flex flex-wrap items-center gap-1" role="tablist" aria-label="Views">
			<button
				v-for="v in views"
				:key="v.key"
				type="button"
				role="tab"
				:aria-selected="view === v.key"
				class="h-[30px] rounded-[7px] px-3 text-[13.5px]"
				:class="
					view === v.key
						? 'bg-surf font-bold text-ink shadow-[inset_0_0_0_1px] shadow-line'
						: 'font-medium text-ink-2 hover:bg-surf/60'
				"
				@click="setView(v.key)"
			>
				{{ v.label }}
			</button>
			<label
				class="ml-auto flex h-9 w-[260px] items-center gap-2 rounded-lg border border-line bg-surf px-2.5"
			>
				<Icon name="search" :size="15" class="text-mut" />
				<input
					v-model="search"
					type="text"
					aria-label="Search people"
					placeholder="Name, ID or role…"
					class="h-full flex-grow border-0 bg-transparent p-0 text-[13.5px] focus:ring-0"
				/>
			</label>
		</div>

		<p
			v-if="error"
			role="alert"
			class="mt-4 rounded-lg bg-neg-tint px-4 py-3 text-[13.5px] text-neg"
		>
			{{ error }}
		</p>

		<div class="mt-3 min-h-0 flex-grow overflow-y-auto pb-8" :class="peek && 'mr-[430px]'">
			<table class="w-full border-collapse">
				<thead class="sticky top-0 z-10 bg-paper">
					<tr>
						<th :class="th">Person</th>
						<th :class="th">Role</th>
						<th :class="th">Manager</th>
						<th :class="th">Today</th>
						<th :class="th">Tenure</th>
						<th :class="th">Coming up</th>
					</tr>
				</thead>
				<tbody>
					<template v-for="g in groups" :key="g.department">
						<tr>
							<td colspan="6" class="border-b border-line-2 px-3 pb-1.5 pt-4">
								<span class="chip bg-acc-tint text-acc">{{
									dept(g.department) || "No department"
								}}</span>
								<span class="ml-2 text-[12.5px] text-mut">{{
									g.rows.length
								}}</span>
							</td>
						</tr>
						<tr
							v-for="p in g.rows"
							:key="p.name"
							tabindex="0"
							class="cursor-pointer border-b border-line-2 hover:bg-surf focus:bg-acc-tint focus:outline-none"
							:class="peek === p.name && 'bg-surf'"
							@click="openPeek(p.name)"
							@keydown.enter="openPeek(p.name)"
						>
							<td :class="td">
								<span class="flex items-center gap-2.5 font-semibold">
									<img
										v-if="p.image"
										:src="p.image"
										alt=""
										class="h-7 w-7 rounded-full object-cover"
									/>
									<Avatar v-else :label="p.employee_name" :size="28" />
									{{ p.employee_name }}
								</span>
							</td>
							<td :class="[td, 'text-ink-2']">{{ p.designation || "—" }}</td>
							<td :class="[td, 'text-ink-2']">
								<span v-if="p.manager_name" class="flex items-center gap-2"
									><Avatar :label="p.manager_name" :size="20" />{{
										first(p.manager_name)
									}}</span
								>
								<span v-else class="text-mut">—</span>
							</td>
							<td :class="td">
								<span v-if="p.today" class="chip" :class="todayTone(p.today)">
									{{ todayLabel(p.today) }}
								</span>
								<span
									v-else
									class="inline-flex items-center gap-1.5 text-[12.5px] text-ink-2"
									><span class="h-1.5 w-1.5 rounded-full bg-pos" />In</span
								>
							</td>
							<td :class="[td, 'tabular-nums text-ink-2']">
								{{ tenure(p.tenure_days) }}
							</td>
							<td :class="td">
								<span
									v-if="p.next"
									:class="
										p.next.kind === 'probation' || p.next.kind === 'leaving'
											? 'font-semibold text-warn'
											: 'text-ink-2'
									"
								>
									{{ p.next.label }} · {{ when(p.next) }}
								</span>
							</td>
						</tr>
					</template>
				</tbody>
			</table>
			<div v-if="!loading && !rows.length && !error" class="px-6 py-14 text-center">
				<p class="font-display text-[20px] font-bold">{{ emptyTitle }}</p>
				<p class="mt-2 text-[13.5px] text-mut">
					{{
						search
							? "Try a shorter search."
							: "People show up here as their records change."
					}}
				</p>
			</div>
		</div>

		<!-- Profile peek -->
		<aside
			v-if="peek"
			:aria-label="profile?.employee.employee_name || 'Profile'"
			class="absolute bottom-3.5 right-3.5 top-3.5 flex w-[415px] flex-col overflow-hidden rounded-2xl border border-line bg-surf shadow-[-24px_0_48px_-24px_rgba(14,20,51,0.2)]"
		>
			<div class="flex items-center gap-1.5 border-b border-line-2 px-3.5 py-3">
				<span class="flex-grow text-[12.5px] text-mut"
					>People / {{ dept(profile?.employee.department) || "…" }}</span
				>
				<router-link
					:to="{ name: 'Form', params: { doctype: 'Employee', name: peek } }"
					aria-label="Open full profile"
					class="flex h-8 w-8 items-center justify-center rounded-md text-ink-2 hover:bg-side"
					><Icon name="expand" :size="16"
				/></router-link>
				<button
					type="button"
					aria-label="Close"
					class="flex h-8 w-8 items-center justify-center rounded-md text-ink-2 hover:bg-side"
					@click="peek = null"
				>
					✕
				</button>
			</div>
			<div v-if="!profile" class="p-6 text-[13.5px] text-mut">Loading…</div>
			<div v-else class="flex flex-col gap-5 overflow-y-auto px-6 py-5">
				<div class="flex items-end gap-4">
					<img
						v-if="profile.employee.image"
						:src="profile.employee.image"
						alt=""
						class="h-16 w-16 rounded-full object-cover"
					/>
					<Avatar v-else :label="profile.employee.employee_name" :size="64" />
					<div class="min-w-0">
						<h2 class="truncate text-[28px] leading-none">
							{{ profile.employee.employee_name }}
						</h2>
						<div class="mt-1.5 text-[13.5px] text-ink-2">
							{{ profile.employee.designation || "—" }}
						</div>
					</div>
				</div>
				<div class="flex flex-wrap gap-1.5">
					<span v-if="profile.employee.department" class="chip bg-acc-tint text-acc">{{
						dept(profile.employee.department)
					}}</span>
					<span v-if="profile.today" class="chip" :class="todayTone(profile.today)">{{
						todayLabel(profile.today)
					}}</span>
					<span
						v-if="profile.employee.employment_type"
						class="chip bg-line-2 text-ink-2"
						>{{ profile.employee.employment_type }}</span
					>
					<span
						v-if="profile.employee.status !== 'Active'"
						class="chip bg-warn-tint text-warn"
						>{{ profile.employee.status }}</span
					>
				</div>

				<dl class="text-[13.5px]">
					<div
						v-for="row in facts"
						:key="row[0]"
						class="grid grid-cols-[120px_minmax(0,1fr)] gap-2 border-b border-line-2 py-2"
					>
						<dt class="text-mut">{{ row[0] }}</dt>
						<dd class="min-w-0 break-words font-medium">
							<router-link v-if="row[2]" :to="row[2]" class="text-acc">{{
								row[1]
							}}</router-link>
							<a v-else-if="row[3]" :href="row[3]" class="text-acc">{{ row[1] }}</a>
							<template v-else>{{ row[1] }}</template>
						</dd>
					</div>
				</dl>

				<section v-if="profile.balances.length">
					<div class="kicker mb-2">Time off left</div>
					<div
						class="flex flex-wrap overflow-hidden rounded-xl border-[1.5px] border-dashed border-line"
					>
						<div
							v-for="b in profile.balances"
							:key="b.leave_type"
							class="min-w-[110px] flex-1 border-r-[1.5px] border-dashed border-line px-3 py-2.5 last:border-r-0"
						>
							<div
								class="font-display text-[26px] font-bold leading-none tabular-nums"
							>
								{{ num(b.remaining) }}
							</div>
							<div class="mt-1 text-[12px] text-ink-2">
								{{ b.leave_type }}
								<span class="text-mut">of {{ num(b.total) }}</span>
							</div>
							<div v-if="b.pending" class="mt-0.5 text-[11.5px] text-warn">
								{{ num(b.pending) }} pending
							</div>
						</div>
					</div>
				</section>

				<section v-if="profile.reports.length">
					<div class="kicker mb-2">Team ({{ profile.reports.length }})</div>
					<ul class="flex flex-col gap-1.5">
						<li v-for="r in profile.reports" :key="r.name">
							<button
								type="button"
								class="flex w-full items-center gap-2 text-left text-[13.5px] hover:text-acc"
								@click="openPeek(r.name)"
							>
								<Avatar :label="r.employee_name" :size="22" />
								<span class="font-medium">{{ r.employee_name }}</span>
								<span class="truncate text-[12px] text-mut">{{
									r.designation
								}}</span>
							</button>
						</li>
					</ul>
				</section>

				<section class="flex flex-wrap gap-2">
					<router-link
						:to="{
							name: 'Form',
							params: { doctype: 'Leave Application', name: 'new' },
							query: { employee: peek },
						}"
						class="btn-ghost h-8 text-[13px]"
						>Request leave</router-link
					>
					<router-link
						:to="{
							name: 'List',
							params: { doctype: 'Leave Application' },
							query: { employee: peek },
						}"
						class="btn-ghost h-8 text-[13px]"
						>Leave history</router-link
					>
					<router-link
						:to="{
							name: 'List',
							params: { doctype: 'Salary Slip' },
							query: { employee: peek },
						}"
						class="btn-ghost h-8 text-[13px]"
						>Payslips</router-link
					>
					<router-link
						:to="{
							name: 'List',
							params: { doctype: 'Attendance' },
							query: { employee: peek },
						}"
						class="btn-ghost h-8 text-[13px]"
						>Attendance</router-link
					>
				</section>
			</div>
		</aside>
	</div>
</template>

<script setup>
import { dept } from "@/composables/format";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { call } from "frappe-ui";
import dayjs from "dayjs";
import Icon from "@/components/Icon.vue";
import Avatar from "@/components/Avatar.vue";
import { messageOf } from "@/engine/form";

const route = useRoute();
const router = useRouter();

const views = [
	{ key: "everyone", label: "Everyone" },
	{ key: "away", label: "Away today" },
	{ key: "joining", label: "Joining" },
	{ key: "probation", label: "On probation" },
	{ key: "leaving", label: "Leaving" },
];
const th =
	"px-3 py-2.5 text-left text-[11.5px] font-semibold uppercase tracking-[0.08em] text-mut border-b border-line";
const td = "px-3 h-11 text-[13.5px] whitespace-nowrap";

const view = ref(route.query.view || "everyone");
const search = ref("");
const rows = ref([]);
const departments = ref({});
const peopleSummary = computed(() => {
	const n = rows.value.length;
	const teams = Object.keys(departments.value).length;
	return `${n} ${n === 1 ? "person" : "people"} in ${teams} ${teams === 1 ? "team" : "teams"}`;
});
const loading = ref(true);
const error = ref("");
const peek = ref(route.query.peek || null);
const profile = ref(null);

const viewLabel = computed(() => views.find((v) => v.key === view.value)?.label || "");
const groups = computed(() => {
	const map = new Map();
	for (const r of rows.value) {
		const k = r.department || "";
		if (!map.has(k)) map.set(k, []);
		map.get(k).push(r);
	}
	return [...map.entries()].map(([department, list]) => ({ department, rows: list }));
});
const emptyTitle = computed(
	() =>
		({
			away: "Everyone's in today",
			joining: "Nobody joining soon",
			probation: "Nobody on probation",
			leaving: "Nobody leaving",
		})[view.value] || (search.value ? "No one matches" : "No people yet"),
);

const first = (n) => String(n || "").split(" ")[0];
const num = (n) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 1 });
function tenure(days) {
	if (days === null || days === undefined || days < 0) return days < 0 ? "Not started" : "—";
	const y = Math.floor(days / 365);
	const m = Math.floor((days % 365) / 30);
	return y ? `${y}y ${m}m` : `${m}m`;
}
function when(n) {
	if (n.in_days === 0) return "today";
	if (n.in_days === 1) return "tomorrow";
	return n.in_days < 7 ? dayjs(n.date).format("ddd") : dayjs(n.date).format("D MMM");
}
function todayLabel(t) {
	if (t.kind === "remote") return "Remote";
	if (t.kind === "half") return "Half day";
	const until =
		t.until && !dayjs(t.until).isSame(dayjs(), "day")
			? ` · back ${dayjs(t.until).add(1, "day").format("ddd D")}`
			: "";
	return `${t.pending ? "Away (pending)" : "Away"}${until}`;
}
const todayTone = (t) =>
	t.kind === "remote"
		? "bg-line-2 text-ink-2"
		: t.kind === "half"
			? "bg-warn-tint text-warn"
			: "bg-neg-tint text-neg";

const facts = computed(() => {
	const e = profile.value?.employee || {};
	const d = (x) => (x ? dayjs(x).format("D MMM YYYY") : null);
	const out = [
		[
			"Reports to",
			profile.value?.manager?.employee_name,
			profile.value?.manager
				? {
						name: "Form",
						params: { doctype: "Employee", name: profile.value.manager.name },
					}
				: null,
		],
		["Joined", d(e.date_of_joining)],
		["Probation ends", d(e.final_confirmation_date)],
		["Last day", d(e.relieving_date)],
		["Branch", e.branch],
		[
			"Email",
			e.company_email || e.personal_email,
			null,
			e.company_email || e.personal_email
				? `mailto:${e.company_email || e.personal_email}`
				: null,
		],
		["Phone", e.cell_number, null, e.cell_number ? `tel:${e.cell_number}` : null],
		["Shift", e.default_shift],
		["Leave approver", e.leave_approver],
		["Salary structure", profile.value?.salary_structure?.salary_structure],
		["Employee ID", e.name],
	];
	return out.filter((r) => r[1]);
});

let seq = 0;
async function load() {
	const mine = ++seq;
	loading.value = true;
	error.value = "";
	try {
		const res = await call("hrms.briskrew.people.get_directory", {
			view: view.value,
			search: search.value || null,
		});
		if (mine !== seq) return;
		rows.value = res.employees;
		departments.value = res.departments;
	} catch (e) {
		if (mine === seq) error.value = messageOf(e, "Couldn't load people.");
	} finally {
		if (mine === seq) loading.value = false;
	}
}

async function openPeek(name) {
	peek.value = name;
	profile.value = null;
	router.replace({ query: { ...route.query, peek: name } });
	try {
		const res = await call("hrms.briskrew.people.get_profile", { employee: name });
		if (peek.value === name) profile.value = res;
	} catch (e) {
		error.value = messageOf(e, "Couldn't load this profile.");
		peek.value = null;
	}
}

function setView(v) {
	view.value = v;
	router.replace({ query: { ...route.query, view: v } });
	load();
}

let timer;
watch(search, () => {
	clearTimeout(timer);
	timer = setTimeout(load, 250);
});
watch(peek, (v) => {
	if (!v) router.replace({ query: { ...route.query, peek: undefined } });
});

function onKey(e) {
	if (e.key === "Escape" && peek.value) peek.value = null;
}
onMounted(() => {
	load();
	if (peek.value) openPeek(peek.value);
	window.addEventListener("keydown", onKey);
});
onBeforeUnmount(() => window.removeEventListener("keydown", onKey));
</script>
