<script lang="ts">
	import PageShell from '$app-layer/components/PageShell.svelte';

	let { data } = $props();

	const money = (value: number) =>
		new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD' }).format(value ?? 0);
</script>

<PageShell
	eyebrow="Tax / Corporate"
	title="Corporate Tax"
	description={`Corporate tax estimation for ${data.corporate.year}.`}
>
	<form method="GET" class="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-3">
		<label class="text-sm text-slate-600">
			Year
			<input
				type="number"
				name="year"
				value={data.year}
				class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
			/>
		</label>
		<div class="flex items-end">
			<button class="rounded-lg bg-[var(--sf-green)] px-4 py-2 text-sm font-medium text-white" type="submit">
				Load Year
			</button>
		</div>
		<p class="flex items-end text-sm text-slate-500">
			Range: {data.corporate.range.start} to {data.corporate.range.end}
		</p>
	</form>

	<section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
		<article class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
			<p class="text-xs text-slate-500">Revenue</p>
			<p class="mt-2 text-xl font-semibold text-slate-900">{money(data.corporate.revenue)}</p>
		</article>
		<article class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
			<p class="text-xs text-slate-500">Taxable Income</p>
			<p class="mt-2 text-xl font-semibold text-slate-900">{money(data.corporate.taxableIncome)}</p>
		</article>
		<article class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
			<p class="text-xs text-slate-500">Tax Payable</p>
			<p class="mt-2 text-xl font-semibold text-slate-900">{money(data.corporate.taxPayable)}</p>
		</article>
		<article class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
			<p class="text-xs text-slate-500">Effective Rate</p>
			<p class="mt-2 text-xl font-semibold text-slate-900">{(data.corporate.effectiveRate * 100).toFixed(2)}%</p>
		</article>
	</section>

	<div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
		<table class="min-w-full divide-y divide-slate-200 text-sm">
			<thead class="bg-slate-50 text-left text-slate-600">
				<tr>
					<th class="px-4 py-3">Component</th>
					<th class="px-4 py-3">Amount</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				<tr
					><td class="px-4 py-3">Revenue (customer invoices, year)</td><td class="px-4 py-3 font-medium text-slate-900"
						>{money(data.corporate.revenue)}</td
					></tr
				>
				<tr
					><td class="px-4 py-3">Purchase (supplier invoices)</td><td class="px-4 py-3"
						>{money(data.corporate.costBreakdown.purchase)}</td
					></tr
				>
				<tr
					><td class="px-4 py-3">Staff (payouts: confirmed/paid, excl. dividend)</td><td class="px-4 py-3"
						>{money(data.corporate.costBreakdown.staff)}</td
					></tr
				>
				<tr
					><td class="px-4 py-3">Expenses (company expenses table)</td><td class="px-4 py-3"
						>{money(data.corporate.costBreakdown.expense)}</td
					></tr
				>
				<tr class="border-t border-slate-200 bg-slate-50/80"
					><td class="px-4 py-3 font-medium">Taxable income (Revenue âˆ?above costs)</td><td class="px-4 py-3 font-semibold"
						>{money(data.corporate.taxableIncome)}</td
					></tr
				>
			</tbody>
		</table>
	</div>

	<section class="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
		<p class="font-medium text-slate-700">Tax Band Configuration</p>
		<ul class="mt-2 list-disc space-y-1 pl-5">
			<li>First 10,000 at {(data.corporate.bands.first10k * 100).toFixed(2)}%</li>
			<li>Next 190,000 at {(data.corporate.bands.next190k * 100).toFixed(2)}%</li>
			<li>Above 200,000 at {(data.corporate.bands.above200k * 100).toFixed(2)}%</li>
		</ul>
		<a class="mt-3 inline-block text-[var(--sf-green)] hover:text-[#2f5e2c]" href={`/tax?year=${data.year}&quarter=1`}>
			Back to GST Summary
		</a>
	</section>
</PageShell>


