<script lang="ts">
	import PageShell from '$lib/components/PageShell.svelte';

	let { data, form } = $props();

	const fieldRows = [
		{ key: 'gst_box9_manual', label: 'Box 9', description: 'Manual adjustment (import/suspension)' },
		{ key: 'gst_box10_manual', label: 'Box 10', description: 'Manual declaration field #10' },
		{ key: 'gst_box11_manual', label: 'Box 11', description: 'Manual declaration field #11' },
		{ key: 'gst_box12_manual', label: 'Box 12', description: 'Manual declaration field #12' }
	] as const;
</script>

<PageShell
	eyebrow="Tax / Settings"
	title="GST Manual Box Settings"
	description="Configure manual values used for GST Box 9-12."
>
	{#if form?.message}
		<p class="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{form.message}</p>
	{/if}

	<form method="POST" class="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
		{#each fieldRows as field}
			<label class="grid gap-2 md:grid-cols-3 md:items-center">
				<div>
					<p class="text-sm font-medium text-slate-700">{field.label}</p>
					<p class="text-xs text-slate-500">{field.description}</p>
				</div>
				<input
					class="rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-2"
					type="number"
					step="0.01"
					name={field.key}
					value={data.values[field.key]}
				/>
			</label>
		{/each}

		<div class="flex flex-wrap gap-3">
			<button class="rounded-md bg-[var(--sf-green)] px-4 py-2 text-sm font-medium text-white hover:bg-[#2f5e2c]" type="submit">
				Save Manual Values
			</button>
			<a class="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50" href="/tax">
				Back to Tax
			</a>
		</div>
	</form>
</PageShell>
