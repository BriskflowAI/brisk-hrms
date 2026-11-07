<template>
	<div class="mx-auto flex w-full max-w-[1760px] flex-col gap-6 px-4 py-7 md:px-9">
		<p
			v-if="error"
			role="alert"
			class="rounded-lg bg-neg-tint px-4 py-3 text-[13.5px] text-neg"
		>
			{{ error }}
		</p>

		<header>
			<div class="flex items-center justify-between gap-3">
				<div class="kicker">{{ dateLine }}</div>
				<button
					v-if="!editing"
					type="button"
					class="btn-ghost h-8 rounded-full px-3 text-[12.5px]"
					@click="startEdit"
				>
					<Icon name="sliders" :size="15" />
					{{ __("Customise") }}
				</button>
			</div>
			<h1 class="mt-2 text-[38px] leading-none md:text-[52px]">
				{{ " " }}{{ __("Good") }} {{ partOfDay }}<span class="text-acc">.</span>
			</h1>
			<ul
				v-if="data"
				:aria-label="__('Today at a glance')"
				class="mt-5 flex flex-wrap gap-2"
			>
				<li v-if="data.headcount">
					<router-link :to="{ name: 'People', query: { view: 'away' } }" class="glance">
						<Icon name="users" :size="16" class="text-acc" />
						<strong>{{ awayToday.length || __("No one") }}</strong>
						{{
							awayToday.length === 0
								? __("away today")
								: awayToday.length === 1
									? __("person away today")
									: __("people away today")
						}}
					</router-link>
				</li>
				<li>
					<router-link to="/inbox" class="glance">
						<Icon name="inbox" :size="16" class="text-acc" />
						<strong>{{ data.inbox.items.length || __("No") }}</strong>
						{{
							data.inbox.items.length === 1
								? __("request waiting on you")
								: __("requests waiting on you")
						}}
					</router-link>
				</li>
				<li v-if="data.payroll">
					<router-link :to="payrollLink" class="glance">
						<Icon name="coins" :size="16" class="text-acc" />
						<strong>{{ monthName }} {{ __("payroll") }}</strong>
						<span class="whitespace-nowrap"
							><span class="text-mut">·</span> {{ payrollStatus }}</span
						>
					</router-link>
				</li>
			</ul>
		</header>

		<!-- The cards, in each person's own order (Customise). -->
		<template v-if="!editing">
			<div
				v-for="row in rows"
				:key="row.key"
				class="empty:hidden"
				:class="row.small ? ['grid grid-cols-1 gap-6', SMALL_COLS[row.cards.length]] : ''"
			>
				<template v-for="id in row.cards" :key="id">
					<CheckInCard v-if="id === 'checkin'" />
					<section
						v-else-if="id === 'week' && data"
						:aria-label="__('This week')"
						class="week rounded-[24px] border border-line-2 bg-surf px-4 pb-5 pt-5 md:px-6"
					>
						<div
							class="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"
						>
							<div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
								<h2 class="text-[22px]">{{ __("The week") }}</h2>
								<span class="text-[13px] text-mut">{{
									__("Who's away, what's due, what to celebrate")
								}}</span>
							</div>
							<span class="text-[13px] text-ink-2"
								>{{ weekAway }}
								{{ weekAway === 1 ? __("person away") : __("people away") }} ·
								{{ data.moments?.length || 0 }}
								{{
									data.moments?.length === 1 ? __("moment") : __("moments")
								}}</span
							>
						</div>

						<!-- Wide: the whole week as columns, like a calendar's week view. -->
						<div class="week-board grid-cols-7 gap-2">
							<div
								v-for="d in days"
								:key="d.iso"
								class="flex min-h-[148px] min-w-0 flex-col gap-2 rounded-2xl p-2.5"
								:class="
									d.today
										? 'bg-acc-tint/70 ring-1 ring-inset ring-acc/30'
										: 'bg-paper'
								"
							>
								<div class="flex items-baseline justify-between gap-1 px-1">
									<span class="flex items-baseline gap-1.5">
										<span
											class="text-[11px] font-semibold uppercase tracking-wider"
											:class="d.today ? 'text-acc' : 'text-mut'"
											>{{ d.dow }}</span
										>
										<span
											class="font-display text-[22px] font-bold leading-none"
											:class="d.today ? 'text-acc' : 'text-ink'"
											>{{ d.dom }}</span
										>
									</span>
									<span
										v-if="d.today"
										class="rounded-full bg-acc px-2 py-0.5 text-[10.5px] font-semibold text-surf"
										>{{ __("Today") }}</span
									>
								</div>
								<span
									v-if="d.holiday"
									class="truncate rounded-lg bg-surf px-2 py-1 text-[11.5px] font-semibold text-acc"
									:title="d.holiday"
									>{{ d.holiday }}</span
								>
								<template v-for="g in momentGroups(d.moments)" :key="g.kind">
									<router-link
										v-if="g.people.length === 1"
										:to="{
											name: 'People',
											query: { peek: g.people[0].employee },
										}"
										class="truncate rounded-lg px-2 py-1 text-[11.5px] font-semibold"
										:class="momentTone(g.kind)"
										:title="`${g.people[0].employee_name} · ${g.people[0].label}`"
										>{{ firstName(g.people[0].employee_name) }} ·
										{{ g.people[0].label }}</router-link
									>
									<div v-else class="rounded-lg" :class="momentTone(g.kind)">
										<button
											type="button"
											:aria-expanded="!!openGroups[d.iso + g.kind]"
											class="flex w-full min-w-0 items-center justify-between gap-2 px-2 py-1 text-[11.5px] font-semibold"
											@click="
												openGroups[d.iso + g.kind] =
													!openGroups[d.iso + g.kind]
											"
										>
											<span class="truncate"
												>{{ g.people.length }} {{ g.noun }}</span
											>
											<span
												class="flex shrink-0 -space-x-1.5"
												aria-hidden="true"
											>
												<Avatar
													v-for="m in g.people.slice(0, 3)"
													:key="m.employee"
													:label="m.employee_name"
													:size="18"
													class="rounded-full ring-1 ring-surf"
												/>
											</span>
										</button>
										<ul
											v-if="openGroups[d.iso + g.kind]"
											class="flex flex-col pb-1"
										>
											<li v-for="m in g.people" :key="m.employee">
												<router-link
													:to="{
														name: 'People',
														query: { peek: m.employee },
													}"
													class="block truncate px-2 py-0.5 text-[11.5px] hover:underline"
													>{{ m.employee_name }}
													<span class="opacity-75"
														>· {{ m.label }}</span
													></router-link
												>
											</li>
										</ul>
									</div>
								</template>
								<router-link
									v-for="a in expandedDays[d.iso]
										? d.away
										: d.away.slice(0, BOARD_PREVIEW)"
									:key="a.name"
									:to="{
										name: 'Form',
										params: { doctype: 'Leave Application', name: a.name },
									}"
									class="flex min-w-0 items-center gap-2 rounded-xl border bg-surf px-2 py-1.5 transition-colors hover:border-acc"
									:class="
										a.status === 'Open'
											? 'border-dashed border-acc'
											: 'border-line-2'
									"
									:title="`${a.employee_name} · ${a.half_day ? __('Half day') : a.leave_type}${
										a.status === 'Open' ? ` · ${__('Pending')}` : ''
									}`"
								>
									<Avatar :label="a.employee_name" :size="24" class="shrink-0" />
									<span class="min-w-0">
										<span
											class="block truncate text-[12.5px] font-semibold text-ink"
											>{{ firstName(a.employee_name) }}</span
										>
										<span class="block truncate text-[11px] text-mut">{{
											a.half_day ? __("Half day") : a.leave_type
										}}</span>
									</span>
								</router-link>
								<button
									v-if="d.away.length > BOARD_PREVIEW"
									type="button"
									class="rounded-lg px-2 py-1 text-left text-[12px] font-semibold text-acc hover:bg-surf"
									@click="expandedDays[d.iso] = !expandedDays[d.iso]"
								>
									{{
										expandedDays[d.iso]
											? __("Show fewer")
											: `+${d.away.length - BOARD_PREVIEW} ${__("more")}`
									}}
								</button>
								<span
									v-if="!d.away.length && !d.moments.length && !d.holiday"
									class="mt-auto px-1 text-[12px] text-mut"
									>{{ __("Everyone's in") }}</span
								>
							</div>
						</div>

						<!-- Narrow: pick a day, read its list. -->
						<div class="week-narrow">
							<div class="grid grid-cols-7 gap-1.5">
								<button
									v-for="d in days"
									:key="d.iso"
									type="button"
									:aria-pressed="d.iso === picked?.iso"
									:aria-label="`${d.long}: ${d.away.length} away, ${d.moments.length} moments`"
									class="flex min-h-[86px] min-w-0 flex-col items-center gap-1.5 rounded-2xl px-1 py-2.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acc"
									:class="[
										d.iso === picked?.iso
											? 'bg-acc text-surf shadow-[0_8px_20px_-10px_rgba(43,63,224,0.7)]'
											: 'bg-paper hover:bg-line-2',
										d.today && d.iso !== picked?.iso
											? 'ring-1 ring-inset ring-acc/40'
											: '',
									]"
									@click="pickedDay = d.iso"
								>
									<span
										class="text-[10.5px] font-semibold uppercase tracking-wider md:text-[11px]"
										:class="
											d.iso === picked?.iso
												? 'text-surf/80'
												: d.today
													? 'text-acc'
													: 'text-mut'
										"
										>{{ d.dow }}</span
									>
									<span
										class="font-display text-[19px] font-bold leading-none md:text-[22px]"
										:class="
											d.iso === picked?.iso
												? 'text-surf'
												: d.today
													? 'text-acc'
													: 'text-ink'
										"
										>{{ d.dom }}</span
									>
									<span
										v-if="d.away.length"
										class="mt-1 grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-semibold"
										:class="
											d.iso === picked?.iso
												? 'bg-surf text-acc'
												: 'bg-acc text-surf'
										"
										>{{ d.away.length }}</span
									>
									<span class="mt-auto flex gap-1" aria-hidden="true">
										<span
											v-for="m in d.moments.slice(0, 3)"
											:key="m.kind + m.employee"
											class="h-1.5 w-1.5 rounded-full"
											:class="
												d.iso === picked?.iso
													? 'bg-surf'
													: momentDot(m.kind)
											"
										/>
									</span>
								</button>
							</div>

							<div v-if="picked" class="mt-5">
								<p class="text-[14px] font-semibold text-ink">
									{{ picked.long }}
									<span v-if="picked.holiday" class="font-medium text-acc"
										>· {{ picked.holiday }}</span
									>
								</p>
								<p
									v-if="!picked.away.length && !picked.moments.length"
									class="mt-1 text-[13.5px] text-ink-2"
								>
									{{ __("Everyone's in, and nothing to celebrate.") }}
								</p>
								<div
									v-else
									class="mt-2 grid gap-x-8 gap-y-4"
									:class="
										picked.away.length && picked.moments.length
											? 'week-lists-2'
											: ''
									"
								>
									<div v-if="picked.away.length">
										<div class="kicker">
											{{ __("Away") }} · {{ picked.away.length }}
										</div>
										<ul class="mt-1 flex flex-col">
											<li v-for="a in shownAway" :key="a.name">
												<router-link
													:to="{
														name: 'Form',
														params: {
															doctype: 'Leave Application',
															name: a.name,
														},
													}"
													class="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-paper"
												>
													<Avatar :label="a.employee_name" :size="32" />
													<span class="min-w-0 flex-1">
														<span
															class="block truncate text-[14px] font-semibold text-ink"
															>{{ a.employee_name }}</span
														>
														<span
															class="block truncate text-[12.5px] text-ink-2"
															>{{
																a.half_day
																	? __("Half day")
																	: a.leave_type
															}}
															· {{ leaveRange(a) }}</span
														>
													</span>
													<span
														v-if="a.status === 'Open'"
														class="chip shrink-0 border border-dashed border-acc bg-surf text-acc"
														>{{ __("Pending") }}</span
													>
												</router-link>
											</li>
										</ul>
										<button
											v-if="picked.away.length > AWAY_PREVIEW"
											type="button"
											class="mt-1 text-[13px] font-semibold text-acc hover:underline"
											@click="showAllAway = !showAllAway"
										>
											{{
												showAllAway
													? __("Show fewer")
													: `${__("Show all")} ${picked.away.length}`
											}}
										</button>
									</div>
									<div v-if="picked.moments.length">
										<div class="kicker">
											{{ __("Moments") }} · {{ picked.moments.length }}
										</div>
										<ul class="mt-1 flex flex-col">
											<li
												v-for="m in shownMoments"
												:key="m.kind + m.employee"
											>
												<router-link
													:to="{
														name: 'People',
														query: { peek: m.employee },
													}"
													class="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-paper"
												>
													<Avatar :label="m.employee_name" :size="32" />
													<span
														class="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink"
														>{{ m.employee_name }}</span
													>
													<span
														class="chip shrink-0"
														:class="momentTone(m.kind)"
														>{{ m.label }}</span
													>
												</router-link>
											</li>
										</ul>
										<button
											v-if="picked.moments.length > AWAY_PREVIEW"
											type="button"
											class="mt-1 text-[13px] font-semibold text-acc hover:underline"
											@click="showAllMoments = !showAllMoments"
										>
											{{
												showAllMoments
													? __("Show fewer")
													: `${__("Show all")} ${picked.moments.length}`
											}}
										</button>
									</div>
								</div>
							</div>
						</div>
					</section>
					<section
						v-else-if="id === 'waiting' && data"
						:aria-label="__('Waiting on you')"
						class="home-card"
					>
						<div class="mb-1.5 flex items-baseline gap-2.5">
							<h2 class="text-[22px]">{{ __("Waiting on you") }}</h2>
							<span class="text-[13px] text-mut">{{
								data.inbox.items.length
									? `${Math.min(4, data.inbox.items.length)} of ${
											data.inbox.items.length
										}`
									: ""
							}}</span>
							<router-link
								to="/inbox"
								class="ml-auto text-[13px] font-semibold text-acc"
								>{{ __("Open inbox →") }}</router-link
							>
						</div>
						<p
							v-if="!data.inbox.items.length"
							class="border-t border-line-2 py-3 text-[13.5px] text-mut"
						>
							{{ __("All clear.") }}
						</p>
						<div
							v-for="item in data.inbox.items.slice(0, 4)"
							:key="item.doctype + item.name"
							class="flex items-center gap-3 border-t border-line-2 py-2.5"
						>
							<Avatar :label="item.employee_name" :size="32" />
							<div class="min-w-0 flex-grow">
								<div class="text-[14px] font-semibold">
									{{ item.employee_name }}
									<span class="font-medium text-mut">· {{ item.kind }}</span>
								</div>
								<div class="truncate text-[13px] text-ink-2">
									{{ summary(item) }}
								</div>
							</div>
							<router-link
								to="/inbox"
								:aria-label="`Review ${item.employee_name}'s request`"
								class="flex h-8 items-center rounded-lg border border-line px-2.5 text-[12.5px] font-semibold hover:bg-side"
								>{{ __("Review") }}</router-link
							>
							<button
								type="button"
								:aria-label="`Approve ${item.employee_name}'s request`"
								class="flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-surf disabled:opacity-40"
								:disabled="busy === item.name"
								@click="approve(item)"
							>
								<Icon name="check" :size="15" :stroke="2" />
							</button>
						</div>
					</section>
					<section
						v-else-if="id === 'payroll' && data?.payroll"
						:aria-label="__('Payroll')"
						class="home-card"
					>
						<div class="flex items-baseline gap-2.5">
							<h2 class="text-[22px]">{{ monthName }} {{ __("payroll") }}</h2>
							<span
								class="chip ml-auto"
								:class="
									data.payroll.stage === 'Slips submitted'
										? 'bg-pos-tint text-pos'
										: 'bg-warn-tint text-warn'
								"
								>{{ data.payroll.stage }}</span
							>
						</div>
						<div class="mt-3 flex gap-1.5">
							<div
								v-for="(s, i) in stages"
								:key="s"
								class="flex flex-grow flex-col gap-1.5"
							>
								<div
									class="h-1 rounded-sm"
									:class="
										i < stageIndex
											? 'bg-ink'
											: i === stageIndex
												? 'bg-acc'
												: 'bg-line'
									"
								/>
								<span
									class="text-[11.5px]"
									:class="
										i <= stageIndex ? 'font-semibold text-ink' : 'text-mut'
									"
									>{{ s }}</span
								>
							</div>
						</div>
						<div
							v-if="data.payroll.totals.slips"
							class="mt-3.5 flex items-baseline gap-2"
						>
							<span class="font-display text-[30px] font-bold tabular-nums">{{
								money(data.payroll.totals.net)
							}}</span>
							<span class="text-[13px] text-mut"
								>{{ __("net ·") }} {{ data.payroll.totals.slips }}
								{{ __("slips") }}</span
							>
						</div>
						<router-link
							:to="payrollLink"
							class="mt-2 inline-flex text-[13.5px] font-semibold text-acc"
							>{{
								data.payroll.entry
									? "Open payroll run →"
									: "Start this month's run →"
							}}</router-link
						>
					</section>
					<section
						v-else-if="id === 'headcount' && data?.headcount"
						:aria-label="__('Headcount')"
						class="home-card"
					>
						<div class="mb-2.5 flex flex-col">
							<span class="font-display text-[22px] font-bold"
								>{{ totalPeople }} {{ __("people") }}</span
							>
							<span class="text-[13px] text-mut">{{
								data.joining_soon
									? `${data.joining_soon} joining soon`
									: "Active employees"
							}}</span>
						</div>
						<div class="flex h-2.5 gap-0.5 overflow-hidden rounded">
							<div
								v-for="(h, i) in data.headcount"
								:key="h.department"
								:style="{
									flexGrow: h.count,
									background: palette[i % palette.length],
								}"
								:title="`${h.department}: ${h.count}`"
							/>
						</div>
						<ul class="mt-2.5 flex flex-col gap-1">
							<li
								v-for="(h, i) in data.headcount.slice(0, 6)"
								:key="h.department"
								class="flex items-center gap-2 text-[12.5px] text-ink-2"
							>
								<span
									class="h-2 w-2 rounded-sm"
									:style="{ background: palette[i % palette.length] }"
								/>
								<span class="flex-grow truncate">{{ dept(h.department) }}</span>
								<span class="tabular-nums text-mut">{{ h.count }}</span>
							</li>
						</ul>
					</section>
				</template>
			</div>
		</template>

		<section v-else :aria-label="__('Arrange Home')" class="flex flex-col gap-4">
			<div
				class="flex flex-wrap items-center justify-between gap-3 rounded-[20px] bg-ink px-5 py-4 text-surf"
			>
				<div class="min-w-0">
					<p class="text-[15px] font-semibold">{{ __("Arrange your Home") }}</p>
					<p class="text-[13px] text-ink-navtext">
						{{
							__(
								"Drag a card by its handle or use the arrows. Hide what you don't need.",
							)
						}}
					</p>
				</div>
				<div class="flex flex-wrap gap-2">
					<button
						type="button"
						class="btn border-transparent bg-transparent text-ink-navtext hover:text-surf"
						@click="resetLayout"
					>
						{{ __("Reset") }}
					</button>
					<button
						type="button"
						class="btn border-ink-nav bg-ink-nav text-surf hover:border-ink-navtext"
						@click="cancelEdit"
					>
						{{ __("Cancel") }}
					</button>
					<button
						type="button"
						class="btn border-lime bg-lime text-ink hover:brightness-95"
						:disabled="savingLayout"
						@click="saveLayout"
					>
						{{ savingLayout ? __("Saving…") : __("Done") }}
					</button>
				</div>
			</div>
			<div
				v-for="row in editRows"
				:key="row.key"
				:class="row.small ? ['grid grid-cols-1 gap-4', SMALL_COLS[row.cards.length]] : ''"
			>
				<div
					v-for="id in row.cards"
					:key="id"
					:data-card="id"
					class="flex items-center gap-3 rounded-[20px] border bg-surf px-3 py-3 transition-[box-shadow,opacity,border-color]"
					:class="[
						dragging === id
							? 'border-acc shadow-[0_18px_40px_-18px_rgba(43,63,224,0.65)] ring-2 ring-acc'
							: 'border-line',
						isHidden(id) ? 'opacity-55' : '',
						row.small ? 'min-h-[84px]' : 'min-h-[104px]',
					]"
				>
					<button
						type="button"
						class="grid h-11 w-9 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-mut hover:bg-paper active:cursor-grabbing"
						:aria-label="`${__('Drag')} ${cardInfo[id].title}`"
						@pointerdown="startDrag($event, id)"
					>
						<Icon name="grip" :size="18" />
					</button>
					<span
						class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-acc-tint text-acc"
						aria-hidden="true"
					>
						<Icon :name="cardInfo[id].icon" :size="19" />
					</span>
					<span class="min-w-0 flex-1">
						<span
							class="block text-[15px] font-semibold leading-snug text-ink sm:truncate"
							>{{ cardInfo[id].title }}</span
						>
						<span class="hidden truncate text-[12.5px] text-mut sm:block">{{
							isHidden(id) ? __("Hidden from your Home") : cardInfo[id].hint
						}}</span>
					</span>
					<span class="flex shrink-0 items-center">
						<button
							type="button"
							class="grid h-9 w-9 place-items-center rounded-lg text-ink-2 hover:bg-paper disabled:opacity-30"
							:aria-label="`${__('Move up')}: ${cardInfo[id].title}`"
							:disabled="layout.order.indexOf(id) === 0"
							@click="move(id, -1)"
						>
							<Icon name="arrow-up" :size="16" />
						</button>
						<button
							type="button"
							class="grid h-9 w-9 place-items-center rounded-lg text-ink-2 hover:bg-paper disabled:opacity-30"
							:aria-label="`${__('Move down')}: ${cardInfo[id].title}`"
							:disabled="layout.order.indexOf(id) === layout.order.length - 1"
							@click="move(id, 1)"
						>
							<Icon name="arrow-down" :size="16" />
						</button>
						<button
							type="button"
							class="grid h-9 w-9 place-items-center rounded-lg hover:bg-paper"
							:class="isHidden(id) ? 'text-acc' : 'text-ink-2'"
							:aria-label="`${isHidden(id) ? __('Show') : __('Hide')}: ${cardInfo[id].title}`"
							:aria-pressed="isHidden(id)"
							@click="toggleHidden(id)"
						>
							<Icon :name="isHidden(id) ? 'eye-off' : 'eye'" :size="16" />
						</button>
					</span>
				</div>
			</div>
		</section>

		<div v-if="!data && !error" class="text-[13.5px] text-mut">{{ __("Loading…") }}</div>
	</div>
</template>

<script setup>
import CheckInCard from "@/components/CheckInCard.vue";
import { dept } from "@/composables/format";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { call } from "frappe-ui";
import dayjs from "dayjs";
import Icon from "@/components/Icon.vue";
import { __ } from "@/composables/i18n";
import Avatar from "@/components/Avatar.vue";
import { decide, inboxCount } from "@/composables/inbox";
import { messageOf } from "@/engine/form";

const data = ref(null);
const error = ref("");
const busy = ref("");
const palette = ["#1864C8", "#B8286E", "#1E7F3C", "#6A3BD0", "#B24F06", "#394264"];
const stages = ["Period", "Employees", "Slips", "Submitted"];

const hour = new Date().getHours();
const partOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
const dateLine = computed(() => `${dayjs().format("dddd · D MMMM")} · Week ${weekOfYear()}`);
const monthName = computed(() => dayjs(data.value?.payroll?.month).format("MMMM"));

function weekOfYear() {
	const d = dayjs();
	const start = d.startOf("year");
	return Math.ceil((d.diff(start, "day") + start.day() + 1) / 7);
}

const days = computed(() => {
	if (!data.value) return [];
	const start = dayjs(data.value.week.start);
	const holidays = Object.fromEntries(
		(data.value.holidays || []).map((h) => [
			h.holiday_date,
			strip(h.description) || (h.weekly_off ? "Weekly off" : "Holiday"),
		]),
	);
	return Array.from({ length: 7 }, (_, i) => {
		const d = start.add(i, "day");
		const iso = d.format("YYYY-MM-DD");
		return {
			iso,
			dow: d.format("ddd"),
			long: d.format("dddd D MMMM"),
			away: (data.value.away || []).filter((a) => a.from_date <= iso && a.to_date >= iso),
			dom: d.format("D"),
			today: iso === data.value.today,
			holiday:
				holidays[iso] && !/weekly off|sunday|saturday/i.test(holidays[iso])
					? holidays[iso]
					: null,
			moments: (data.value.moments || []).filter((m) => m.date === iso),
		};
	});
});

const AWAY_PREVIEW = 5;
const BOARD_PREVIEW = 4;
const expandedDays = ref({});
const firstName = (n) => String(n || "").split(" ")[0];
const pickedDay = ref(null);
const showAllAway = ref(false);
const showAllMoments = ref(false);
watch(pickedDay, () => {
	showAllAway.value = false;
	showAllMoments.value = false;
});
const picked = computed(() => {
	const iso = pickedDay.value || data.value?.today;
	return days.value.find((d) => d.iso === iso) || days.value[0];
});
const shownAway = computed(() =>
	showAllAway.value ? picked.value.away : picked.value.away.slice(0, AWAY_PREVIEW),
);
const shownMoments = computed(() =>
	showAllMoments.value ? picked.value.moments : picked.value.moments.slice(0, AWAY_PREVIEW),
);
// A busy day folds its moments by kind ("3 birthdays") so the column stays short.
const openGroups = ref({});
const MOMENT_NOUNS = {
	birthday: "birthdays",
	anniversary: "anniversaries",
	joining: "joining",
	probation: "probation reviews",
	leaving: "leaving",
};
const momentGroups = (moments) =>
	Object.values(
		moments.reduce((groups, m) => {
			(groups[m.kind] ||= {
				kind: m.kind,
				noun: __(MOMENT_NOUNS[m.kind] || m.kind),
				people: [],
			}).people.push(m);
			return groups;
		}, {}),
	);
const weekAway = computed(() => new Set((data.value?.away || []).map((a) => a.employee)).size);
const leaveRange = (a) =>
	a.from_date === a.to_date
		? dayjs(a.from_date).format("D MMM")
		: `${dayjs(a.from_date).format("D MMM")} – ${dayjs(a.to_date).format("D MMM")}`;
const awayToday = computed(() =>
	(data.value?.away || []).filter(
		(a) => a.from_date <= data.value.today && a.to_date >= data.value.today,
	),
);
const totalPeople = computed(() => (data.value?.headcount || []).reduce((a, h) => a + h.count, 0));

const payrollLink = computed(() =>
	data.value?.payroll?.entry
		? {
				name: "Form",
				params: { doctype: "Payroll Entry", name: data.value.payroll.entry.name },
			}
		: { name: "Form", params: { doctype: "Payroll Entry", name: "new" } },
);
const stageIndex = computed(
	() =>
		({ "Not started": 0, Draft: 1, Submitted: 2, "Slips created": 2, "Slips submitted": 3 })[
			data.value?.payroll?.stage
		] ?? 0,
);
const payrollStatus = computed(() => {
	const p = data.value.payroll;
	const left = dayjs(p.pay_date).diff(dayjs(), "day");
	if (p.stage === "Slips submitted") return __("done");
	const stage = p.stage === "Not started" ? __("not started") : p.stage.toLowerCase();
	return left >= 0 ? `${stage} · ${left} ${__("days left")}` : stage;
});

const strip = (html) =>
	new DOMParser().parseFromString(String(html || ""), "text/html").body.textContent;
const money = (n) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
const momentDot = (k) =>
	({
		birthday: "bg-[#B8286E]",
		anniversary: "bg-[#6A3BD0]",
		joining: "bg-pos",
		probation: "bg-warn",
		leaving: "bg-neg",
	})[k] || "bg-mut";
const momentTone = (k) =>
	({
		birthday: "bg-[#FCE1EF] text-[#B8286E]",
		anniversary: "bg-[#EBE2FE] text-[#6A3BD0]",
		joining: "bg-pos-tint text-pos",
		probation: "bg-warn-tint text-warn",
		leaving: "bg-neg-tint text-neg",
	})[k] || "bg-line-2 text-ink-2";

function summary(i) {
	const range = (a, b) =>
		a === b || !b
			? dayjs(a).format("D MMM")
			: `${dayjs(a).format("D MMM")} – ${dayjs(b).format("D MMM")}`;
	if (i.doctype === "Leave Application")
		return `${i.leave_type} · ${range(i.from_date, i.to_date)}`;
	if (i.doctype === "Expense Claim")
		return `${Number(i.total_claimed_amount || 0).toLocaleString()} claimed`;
	if (i.doctype === "Shift Request") return `${i.shift_type} · ${range(i.from_date, i.to_date)}`;
	if (i.doctype === "Attendance Request")
		return `${i.reason || "Attendance"} · ${range(i.from_date, i.to_date)}`;
	return i.name;
}

async function approve(item) {
	busy.value = item.name;
	try {
		await decide(item.doctype, item.name, "Approve");
		data.value.inbox.items = data.value.inbox.items.filter(
			(x) => !(x.doctype === item.doctype && x.name === item.name),
		);
		inboxCount.value = data.value.inbox.items.length;
	} catch (e) {
		error.value = messageOf(e, "Couldn't approve that request.");
	} finally {
		busy.value = "";
	}
}

// ---- Arranging Home ----
const HOME_CARDS = [
	{
		id: "checkin",
		title: __("Check in"),
		hint: __("Your timer and today's hours"),
		icon: "clock",
		full: true,
	},
	{
		id: "week",
		title: __("The week"),
		hint: __("Who's away and what to celebrate"),
		icon: "cal",
		full: true,
	},
	{ id: "waiting", title: __("Waiting on you"), hint: __("Requests to approve"), icon: "inbox" },
	{ id: "payroll", title: __("Payroll"), hint: __("This month's run"), icon: "coins" },
	{ id: "headcount", title: __("People"), hint: __("Headcount by department"), icon: "users" },
];
const cardInfo = Object.fromEntries(HOME_CARDS.map((c) => [c.id, c]));
const defaultLayout = () => ({ order: HOME_CARDS.map((c) => c.id), hidden: [] });
const SMALL_COLS = {
	1: "",
	2: "lg:grid-cols-2",
	3: "lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.9fr)]",
};
const layout = ref(defaultLayout());
const editing = ref(false);
const savingLayout = ref(false);
const dragging = ref(null);
let layoutBeforeEdit = null;

// Small cards that follow one another share a row; a full-width card always gets its own.
function toRows(ids) {
	const rows = [];
	for (const id of ids.filter((i) => cardInfo[i])) {
		const small = !cardInfo[id].full;
		const last = rows[rows.length - 1];
		if (small && last?.small && last.cards.length < 3) last.cards.push(id);
		else rows.push({ key: id, small, cards: [id] });
	}
	return rows;
}
const rows = computed(() =>
	toRows(layout.value.order.filter((id) => !layout.value.hidden.includes(id))),
);
const editRows = computed(() => toRows(layout.value.order));
const isHidden = (id) => layout.value.hidden.includes(id);

function startEdit() {
	layoutBeforeEdit = JSON.parse(JSON.stringify(layout.value));
	editing.value = true;
}
function cancelEdit() {
	layout.value = layoutBeforeEdit;
	editing.value = false;
}
function resetLayout() {
	layout.value = defaultLayout();
}
function placeCard(id, target, after) {
	const order = layout.value.order.filter((c) => c !== id);
	order.splice(order.indexOf(target) + (after ? 1 : 0), 0, id);
	layout.value = { ...layout.value, order };
}
function move(id, step) {
	const order = layout.value.order;
	const target = order[order.indexOf(id) + step];
	if (target) placeCard(id, target, step > 0);
}
function toggleHidden(id) {
	const hidden = isHidden(id)
		? layout.value.hidden.filter((c) => c !== id)
		: [...layout.value.hidden, id];
	layout.value = { ...layout.value, hidden };
}

// Pointer events rather than HTML drag and drop, which phones don't support.
function startDrag(event, id) {
	event.preventDefault();
	dragging.value = id;
	window.addEventListener("pointermove", onDrag);
	window.addEventListener("pointerup", endDrag, { once: true });
	window.addEventListener("pointercancel", endDrag, { once: true });
}
function onDrag(event) {
	const over = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-card]");
	const target = over?.dataset.card;
	if (!target || target === dragging.value) return;
	const box = over.getBoundingClientRect();
	const sideBySide = !cardInfo[target].full && !cardInfo[dragging.value].full;
	const after = sideBySide
		? event.clientX > box.left + box.width / 2
		: event.clientY > box.top + box.height / 2;
	placeCard(dragging.value, target, after);
}
function endDrag() {
	window.removeEventListener("pointermove", onDrag);
	window.removeEventListener("pointercancel", endDrag);
	window.removeEventListener("pointerup", endDrag);
	dragging.value = null;
}
onBeforeUnmount(endDrag);

async function saveLayout() {
	savingLayout.value = true;
	try {
		layout.value = await call("hrms.briskrew.home_layout.save_home_layout", {
			order: JSON.stringify(layout.value.order),
			hidden: JSON.stringify(layout.value.hidden),
		});
		editing.value = false;
	} catch (e) {
		error.value = messageOf(e, "Couldn't save your Home layout.");
	} finally {
		savingLayout.value = false;
	}
}

onMounted(async () => {
	call("hrms.briskrew.home_layout.get_home_layout")
		.then((saved) => (layout.value = saved))
		.catch(() => {}); // the default order still shows everything
	try {
		data.value = await call("hrms.briskrew.today.get_today");
		inboxCount.value = data.value.inbox.items.length;
	} catch (e) {
		error.value = messageOf(e, "Couldn't load today.");
	}
});
</script>

<style scoped>
.glance {
	@apply inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-2xl sm:rounded-full border border-line bg-surf px-3.5 py-2 text-[14px] text-ink-2 transition-colors hover:border-acc hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acc;
}
.home-card {
	@apply h-full rounded-[24px] border border-line-2 bg-surf p-5 md:p-6;
}
/* The week, laid out by its own width (see the check-in card). */
.week {
	container-type: inline-size;
}
.week-board {
	display: none;
}
@container (min-width: 760px) {
	.week-board {
		display: grid;
	}
	.week-narrow {
		display: none;
	}
}
@container (min-width: 560px) {
	.week-lists-2 {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
}
.glance strong {
	@apply whitespace-nowrap font-semibold text-ink;
}
</style>
