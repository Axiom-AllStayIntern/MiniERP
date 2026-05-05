<script lang="ts">
	import PageShell from '$app-layer/components/PageShell.svelte';

	let { data, form } = $props();

	const manualFieldRows = [
		{
			key: 'gst_box9_manual',
			label: 'Box 9',
			description: 'Total value of exempt imports under approved import schemes (e.g. MES / ISE).'
		},
		{ key: 'gst_box10_manual', label: 'Box 10', description: 'Output tax due under reverse charge.' },
		{
			key: 'gst_box11_manual',
			label: 'Box 11',
			description: 'Value of taxable purchases under reverse charge.'
		},
		{
			key: 'gst_box12_manual',
			label: 'Box 12',
			description: 'Value of imported services subject to reverse charge.'
		}
	] as const;

</script>

<PageShell
	eyebrow="Tax / Settings"
	title="GST Manual Box Settings"
	description="Configure manual source values for Box 9-12."
>
	{#if form?.message}
		<p class="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{form.message}</p>
	{/if}

	<form method="POST" class="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
		<div class="grid gap-3 md:grid-cols-4">
			<label class="grid gap-2 md:grid-cols-3 md:items-center">
				<div class="text-sm font-medium text-slate-700">Year</div>
				<input
					class="rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-2"
					name="year"
					type="number"
					value={data.year}
				/>
			</label>
			<label class="grid gap-2 md:grid-cols-3 md:items-center">
				<div class="text-sm font-medium text-slate-700">Quarter</div>
				<select class="rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-2" name="quarter">
					<option value="1" selected={data.quarter === 1}>Q1</option>
					<option value="2" selected={data.quarter === 2}>Q2</option>
					<option value="3" selected={data.quarter === 3}>Q3</option>
					<option value="4" selected={data.quarter === 4}>Q4</option>
				</select>
			</label>
			<div class="md:col-span-2 flex items-end">
				<a
					class="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
					href={`/tax?year=${data.year}&quarter=${data.quarter}`}
				>
					Back to Tax
				</a>
			</div>
		</div>

		<section class="space-y-3 rounded-lg border border-slate-200 p-4">
			<p class="text-sm font-semibold text-slate-800">Manual Source Fields (Box 9â€?2)</p>
			<p class="text-xs text-slate-500">
				Keep these in sync when reverse-charge values are needed as traceable source data.
			</p>
			{#each manualFieldRows as field}
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
		</section>

		<div class="flex flex-wrap gap-3">
			<button class="rounded-md bg-[var(--sf-green)] px-4 py-2 text-sm font-medium text-white hover:bg-[#2f5e2c]" type="submit">
				Save Manual Values
			</button>
			<a class="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50" href={`/tax/settings?year=${data.year}&quarter=${data.quarter}`}>
				Reload
			</a>
		</div>
	</form>
</PageShell>


