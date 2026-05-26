<script lang="ts">
	import PageShell from '$app-layer/components/PageShell.svelte';

	let { data } = $props();

	const money = (value: number) =>
		new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD' }).format(value ?? 0);
</script>

<PageShell
	eyebrow="Tax"
	title={`GST Box ${data.box} Details`}
	description={`Detailed data for ${data.year} Q${data.quarter}.`}
>
	<a class="inline-flex text-sm text-[var(--sf-green)] hover:text-[#2f5e2c]" href={`/finance/tax?year=${data.year}&quarter=${data.quarter}`}>
		Back to GST summary
	</a>

	{#if data.detailNote}
		<p class="mt-3 rounded-lg border border-sky-100 bg-sky-50/80 px-3 py-2 text-sm text-sky-900">{data.detailNote}</p>
	{/if}

	{#if data.breakdown}
		<p class="mt-3 text-xs text-slate-500">
			Box 8 = Box 6 − Box 7 + Box 9 − Box 10 + Box 11 − Box 12 (IRAS GST F5 net payable).
		</p>
		<div class="mt-2 grid gap-3 md:grid-cols-3 lg:grid-cols-4">
			<article class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
				<p class="text-sm text-slate-500">Box 6 — Output Tax</p>
				<p class="mt-2 text-xl font-semibold text-slate-900">{money(data.breakdown.box6)}</p>
			</article>
			<article class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
				<p class="text-sm text-slate-500">Box 7 — Input Tax</p>
				<p class="mt-2 text-xl font-semibold text-slate-900">{money(data.breakdown.box7)}</p>
			</article>
			{#if data.breakdown.box9 || data.breakdown.box10 || data.breakdown.box11 || data.breakdown.box12}
				<article class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
					<p class="text-sm text-slate-500">Box 9 — Exempt Imports</p>
					<p class="mt-2 text-lg font-semibold text-slate-700">{money(data.breakdown.box9 ?? 0)}</p>
				</article>
				<article class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
					<p class="text-sm text-slate-500">Box 10 — Reverse Charge Output</p>
					<p class="mt-2 text-lg font-semibold text-slate-700">{money(data.breakdown.box10 ?? 0)}</p>
				</article>
				<article class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
					<p class="text-sm text-slate-500">Box 11 — Reverse Charge Purchases</p>
					<p class="mt-2 text-lg font-semibold text-slate-700">{money(data.breakdown.box11 ?? 0)}</p>
				</article>
				<article class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
					<p class="text-sm text-slate-500">Box 12 — Imported Services</p>
					<p class="mt-2 text-lg font-semibold text-slate-700">{money(data.breakdown.box12 ?? 0)}</p>
				</article>
			{/if}
			<article class="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
				<p class="text-sm font-medium text-emerald-700">Net GST Payable (Box 8)</p>
				<p class="mt-2 text-xl font-bold text-emerald-900">{money(data.breakdown.net)}</p>
			</article>
		</div>
	{:else if data.manualValue !== null}
		<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
			<p class="text-sm text-slate-500">Manual Source</p>
			<p class="mt-1 text-sm text-slate-700">{data.manualSource ?? '--'} ({data.manualKey ?? '--'})</p>
			<p class="mt-3 text-sm text-slate-500">Configured Value</p>
			<p class="mt-1 text-xl font-semibold text-slate-900">{money(data.manualValue)}</p>
		</div>
	{:else}
		<div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
			<table class="min-w-full divide-y divide-slate-200 text-sm">
				<thead class="bg-slate-50 text-left text-slate-600">
					<tr>
						<th class="px-4 py-3">ID</th>
						<th class="px-4 py-3">Reference</th>
						<th class="px-4 py-3">Date</th>
						<th class="px-4 py-3">Amount</th>
						<th class="px-4 py-3">GST</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100">
					{#if data.invoices.length === 0 && data.records.length === 0}
						<tr>
							<td class="px-4 py-8 text-center text-slate-500" colspan="5">No records for this box.</td>
						</tr>
					{:else}
						{#each [...data.invoices, ...data.records] as row}
							<tr class="hover:bg-slate-50">
								<td class="px-4 py-3">{String(row.id ?? '--')}</td>
								<td class="px-4 py-3">
									{String(row.invoiceNo ?? row.supplierName ?? row.type ?? '--')}
								</td>
								<td class="px-4 py-3">
									{String(row.date ?? row.invoiceDate ?? '--')}
								</td>
								<td class="px-4 py-3">
									{money(Number(row.amount ?? 0))}
								</td>
								<td class="px-4 py-3">
									{money(Number(row.gstAmount ?? 0))}
								</td>
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>
	{/if}
</PageShell>


