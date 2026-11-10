<template>
	<div class="flex flex-col items-start gap-3 px-4 md:px-9 py-10">
		<h1 class="text-[28px] leading-none md:text-[36px]">{{ __("Nothing here") }}</h1>
		<p class="text-[14.5px] text-ink-2">
			{{ __("This page doesn't exist.") }}
		</p>
		<div class="flex gap-2">
			<router-link to="/" class="btn-ink">{{ __("Go home") }}</router-link>
		</div>
	</div>
</template>
