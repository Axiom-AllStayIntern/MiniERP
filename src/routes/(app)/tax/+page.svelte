<script lang="ts">
	import PageShell from '$lib/components/PageShell.svelte';
	let { data } = $props();

	const money = (value: number) =>
		new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD' }).format(value ?? 0);

	const boxRows = [
		{ code: 1, key: 'box1', label: 'Standard-rated supplies' },
		{ code: 2, key: 'box2', label: 'Zero-rated supplies' },
		{ code: 3, key: 'box3', label: 'Exempt supplies' },
		{ code: 4, key: 'box4', label: 'Total supplies' },
		{ code: 5, key: 'box5', label: 'Taxable purchases' },
		{ code: 6, key: 'box6', label: 'Output tax due' },
		{ code: 7, key: 'box7', label: 'Input tax and refunds' },
		{ code: 8, key: 'box8', label: 'GST payable / claimable' },
		{ code: 9, key: 'box9', label: 'Manual adjustment (import/suspension)' },
		{ code: 10, key: 'box10', label: 'Manual declaration field #10' },
		{ code: 11, key: 'box11', label: 'Manual declaration field #11' },
		{ code: 12, key: 'box12', label: 'Manual declaration field #12' },
		{ code: 13, key: 'box13', label: 'Revenue for period' }
	] as const;
</script>

<PageShell
	eyebrow="Tax"
	title="Tax Management"
	description="Quarterly GST box summary with drill-down to invoice-level details."
>
	<div class="flex justify-end">
		<a class="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" href="/tax/settings">
			Edit GST Box 9-12 Manual Values
		</a>
	</div>

	<form method="GET" class="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-4">
		<label class="text-sm text-slate-600">
			Year
			<input
				type="number"
				name="year"
				value={data.year}
				class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
			/>
		</label>
		<label class="text-sm text-slate-600">
			Quarter
			<select
				name="quarter"
				value={`${data.quarter}`}
				class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
			>
				<option value="1">Q1</option>
				<option value="2">Q2</option>
				<option value="3">Q3</option>
				<option value="4">Q4</option>
			</select>
		</label>
		<div class="flex items-end">
			<button class="rounded-lg bg-[var(--sf-green)] px-4 py-2 text-sm font-medium text-white" type="submit">
				Load Period
			</button>
		</div>
		<p class="flex items-end text-sm text-slate-500">
			Range: {data.gst.range.start || '--'} to {data.gst.range.end || '--'}
		</p>
	</form>

	<section class="grid gap-4 md:grid-cols-3">
		<article class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
			<p class="text-xs text-slate-500">Corporate Taxable Income ({data.corporatePreview.year})</p>
			<p class="mt-2 text-xl font-semibold text-slate-900">{money(data.corporatePreview.taxableIncome)}</p>
		</article>
		<article class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
			<p class="text-xs text-slate-500">Corporate Tax Payable</p>
			<p class="mt-2 text-xl font-semibold text-slate-900">{money(data.corporatePreview.taxPayable)}</p>
		</article>
		<article class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
			<p class="text-xs text-slate-500">Effective Tax Rate</p>
			<p class="mt-2 text-xl font-semibold text-slate-900">
				{(data.corporatePreview.effectiveRate * 100).toFixed(2)}%
			</p>
			<a class="mt-2 inline-block text-sm text-[var(--sf-green)] hover:text-[#2f5e2c]" href={`/tax/corporate?year=${data.year}`}>
				Open Corporate Tax Detail
			</a>
		</article>
	</section>

	<div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
		<table class="min-w-full divide-y divide-slate-200 text-sm">
			<thead class="bg-slate-50 text-left text-slate-600">
				<tr>
					<th class="px-4 py-3">Box</th>
					<th class="px-4 py-3">Description</th>
					<th class="px-4 py-3">Amount</th>
					<th class="px-4 py-3">Details</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#each boxRows as box}
					<tr class="hover:bg-slate-50">
						<td class="px-4 py-3 font-semibold text-slate-700">Box {box.code}</td>
						<td class="px-4 py-3">{box.label}</td>
						<td class="px-4 py-3">{money(data.gst.boxes[box.key])}</td>
						<td class="px-4 py-3">
							<a
								class="text-[var(--sf-green)] hover:text-[#2f5e2c]"
								href={`/tax/gst/${data.year}/${data.quarter}/box/${box.code}`}
							>
								View
							</a>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	{#if data.gst.meta?.notes && data.gst.meta.notes.length > 0}
		<section class="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
			<p class="font-medium text-slate-700">Calculation Notes</p>
			<ul class="mt-2 list-disc space-y-1 pl-5">
				{#each data.gst.meta.notes as note}
					<li>{note}</li>
				{/each}
			</ul>
		</section>
	{/if}
</PageShell>
