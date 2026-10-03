<template>
	<!-- Dialogs opened by form scripts (frappe.ui.Dialog, prompt, confirm) -->
	<div
		v-for="d in ui.dialogs"
		:key="d.id"
		class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/30 px-4 pt-[10vh]"
		@mousedown.self="d.hide()"
	>
		<div
			role="dialog"
			aria-modal="true"
			:aria-label="d.title"
			class="mb-10 w-full rounded-2xl border border-line bg-surf shadow-2xl"
			:class="
				{
					small: 'max-w-[480px]',
					large: 'max-w-[800px]',
					'extra-large': 'max-w-[1100px]',
				}[d.size] || 'max-w-[560px]'
			"
		>
			<div class="flex items-center gap-3 border-b border-line-2 px-6 py-4">
				<h2 class="flex-grow text-[20px]">{{ d.title }}</h2>
				<button
					type="button"
					:aria-label="__('Close')"
					class="text-mut hover:text-ink"
					@click="d.hide()"
				>
					✕
				</button>
			</div>
			<div class="flex flex-col gap-2.5 px-6 py-4">
				<template v-for="df in d.state.fields" :key="df.fieldname || df.label">
					<hr
						v-if="
							df.fieldtype === 'Section Break' &&
							d.form.visible(d.df(df.fieldname) || df)
						"
						class="my-1 border-line-2"
					/>
					<div v-if="df.fieldtype === 'Section Break' && df.label" class="kicker">
						{{ df.label }}
					</div>
					<Field
						v-else-if="
							!['Section Break', 'Column Break'].includes(df.fieldtype) &&
							d.form.visible(d.df(df.fieldname) || df)
						"
						:form="d.form"
						:df="d.df(df.fieldname) || df"
					/>
				</template>
				<p
					v-if="d.state.error"
					role="alert"
					class="rounded-lg bg-neg-tint px-3 py-2 text-[13px] text-neg"
				>
					{{ d.state.error }}
				</p>
			</div>
			<div
				v-if="d.primary_action_label || d.secondary_action_label"
				class="flex justify-end gap-2 border-t border-line-2 px-6 py-3.5"
			>
				<button
					v-if="d.secondary_action_label"
					type="button"
					class="btn-ghost"
					@click="d.secondary_action ? d.secondary_action() : d.hide()"
				>
					{{ d.secondary_action_label }}
				</button>
				<button
					v-if="d.primary_action_label"
					type="button"
					class="btn-ink"
					:disabled="d.state.disabled"
					@click="d.runPrimary()"
				>
					{{ d.primary_action_label }}
				</button>
			</div>
		</div>
	</div>

	<!-- msgprint / throw -->
	<div
		v-for="m in ui.messages"
		:key="m.id"
		class="fixed inset-0 z-[60] flex items-start justify-center bg-ink/30 px-4 pt-[14vh]"
		@mousedown.self="close(m)"
	>
		<div
			role="alertdialog"
			aria-modal="true"
			class="w-full rounded-2xl border bg-surf shadow-2xl"
			:class="[
				m.wide ? 'max-w-[760px]' : 'max-w-[480px]',
				m.indicator === 'red' ? 'border-neg/40' : 'border-line',
			]"
		>
			<div class="flex items-center gap-3 px-6 pt-5">
				<h2 class="flex-grow text-[19px]" :class="m.indicator === 'red' ? 'text-neg' : ''">
					{{ m.title || (m.indicator === "red" ? "Can't do that" : "Message") }}
				</h2>
				<button
					type="button"
					:aria-label="__('Close')"
					class="text-mut hover:text-ink"
					@click="close(m)"
				>
					✕
				</button>
			</div>
			<div
				class="max-h-[60vh] overflow-y-auto px-6 pb-5 pt-3 text-[14px] leading-relaxed text-ink-2"
				v-html="m.html"
			/>
			<div v-if="m.primary" class="flex justify-end border-t border-line-2 px-6 py-3">
				<button type="button" class="btn-ink" @click="runPrimary(m)">
					{{ m.primary.label || "OK" }}
				</button>
			</div>
		</div>
	</div>

	<!-- show_alert -->
	<div class="fixed bottom-6 right-6 z-[70] flex flex-col gap-2">
		<div
			v-for="a in ui.alerts"
			:key="a.id"
			role="status"
			class="max-w-[360px] rounded-xl px-4 py-3 text-[13.5px] shadow-xl"
			:class="a.indicator === 'red' ? 'bg-neg text-surf' : 'bg-ink text-surf'"
			v-html="a.html"
		/>
	</div>

	<!-- freeze / progress -->
	<div
		v-if="ui.frozen || ui.progress"
		class="fixed inset-0 z-[80] flex items-center justify-center bg-ink/20"
	>
		<div class="rounded-xl bg-surf px-6 py-4 text-[14px] shadow-2xl">
			<template v-if="ui.progress">
				<div class="font-semibold">{{ ui.progress.title }}</div>
				<div class="mt-2 h-2 w-64 rounded-full bg-line-2">
					<div
						class="h-2 rounded-full bg-acc"
						:style="{
							width: `${(100 * ui.progress.count) / (ui.progress.total || 1)}%`,
						}"
					/>
				</div>
				<div class="mt-1.5 text-[12.5px] text-mut">{{ ui.progress.description }}</div>
			</template>
			<template v-else>{{ ui.frozen }}</template>
		</div>
	</div>
</template>

<script setup>
import { ui } from "@/engine/compat";
import Field from "@/components/fields/Field.vue";

function close(m) {
	ui.messages = ui.messages.filter((x) => x.id !== m.id);
}
function runPrimary(m) {
	close(m);
	const p = m.primary;
	if (p?.action) p.action();
	else if (p?.server_action || p?.client_action)
		window.frappe?.call({ method: p.server_action || p.client_action, args: p.args });
}
</script>
