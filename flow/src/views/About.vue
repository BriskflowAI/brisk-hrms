<template>
	<div class="flex max-w-[760px] flex-col gap-6 px-4 md:px-9 py-8">
		<h1 class="text-[40px] leading-none">{{ __("About") }} {{ brand.name }}</h1>
		<p class="text-[15px] leading-relaxed text-ink-2">
			{{ brand.name }}
			{{
				__(
					"is a new interface built on open-source software. It keeps every rule, calculation and permission of the software underneath, which remains licensed under its original terms.",
				)
			}}{{ " " }}
		</p>
		<ul class="flex flex-col divide-y divide-line-2 rounded-xl border border-line bg-surf">
			<li v-for="c in credits" :key="c.name" class="flex flex-col gap-1 px-5 py-4">
				<span class="font-semibold">{{ c.name }}</span>
				<span class="text-[13px] text-mut">{{ c.note }}</span>
				<a
					:href="c.source"
					class="text-[13px] font-semibold text-acc hover:text-acc-hover"
					>{{ __("Source code and licence") }}</a
				>
			</li>
		</ul>
		<p class="text-[13px] text-mut">
			{{
				__(
					"This program comes with ABSOLUTELY NO WARRANTY. It is free software, and you are welcome to redistribute it under the conditions of the GNU General Public License, version 3.",
				)
			}}
		</p>
	</div>
</template>

<script setup>
import { brand } from "@/brand";

const credits = [
	{
		name: "Frappe HR",
		note: "© Frappe Technologies Pvt. Ltd. and contributors · GNU GPL v3",
		source: "https://github.com/frappe/hrms",
	},
	{
		name: "ERPNext",
		note: "© Frappe Technologies Pvt. Ltd. and contributors · GNU GPL v3",
		source: "https://github.com/frappe/erpnext",
	},
	{
		name: "Frappe Framework",
		note: "© Frappe Technologies Pvt. Ltd. and contributors · MIT",
		source: "https://github.com/frappe/frappe",
	},
	{
		name: "frappe-ui",
		note: "© Frappe Technologies Pvt. Ltd. and contributors · MIT",
		source: "https://github.com/frappe/frappe-ui",
	},
];
</script>
