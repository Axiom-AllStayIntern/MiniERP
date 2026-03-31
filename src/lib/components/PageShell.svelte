<script lang="ts">
	let {
		eyebrow = 'Module',
		title,
		description = 'This section is being built in the current milestone.',
		actions,
		children
	}: {
		eyebrow?: string;
		title: string;
		description?: string;
		actions?: import('svelte').Snippet;
		children?: import('svelte').Snippet;
	} = $props();
</script>

<section class="space-y-6">
	<header class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
		<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">{eyebrow}</p>
		<h1 class="mt-2 text-2xl font-semibold text-slate-900">{title}</h1>
		<p class="mt-2 text-sm text-slate-600">{description}</p>
		{#if actions}
			<div class="mt-4">
				{@render actions()}
			</div>
		{/if}
	</header>
	{#if children}
		{@render children()}
	{/if}
</section>
