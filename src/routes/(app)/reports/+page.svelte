<script lang="ts">
	import PageShell from '$lib/components/PageShell.svelte';
	let { data } = $props();

	const money = (value: number) =>
		new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD' }).format(value ?? 0);

	const totals = $derived.by(() => {
		const revenue = data.projectsProfit.reduce((sum, item) => sum + item.revenue, 0);
		const cost = data.projectsProfit.reduce((sum, item) => sum + item.cost, 0);
		const profit = data.projectsProfit.reduce((sum, item) => sum + item.profit, 0);
		const margin = revenue > 0 ? profit / revenue : 0;
		return { revenue, cost, profit, margin };
	});

	const marginBand = (margin: number) => {
		if (margin >= 0.2) return { label: 'High', className: 'bg-emerald-100 text-emerald-700' };
		if (margin >= 0.1) return { label: 'Medium', className: 'bg-amber-100 text-amber-700' };
		return { label: 'Low', className: 'bg-rose-100 text-rose-700' };
	};

	const reportMetricHelp = {
		revenue:
			'Total sales recognized in the selected report scope from all customer invoices (including tax amount).',
		cost:
			'Total cost in the selected report scope, including supplier invoices, staff costs, and operating expenses.',
		profit: 'Total Profit = Total Revenue - Total Cost.',
		margin:
			'Average Margin = Total Profit divided by Total Revenue for the current filtered report set.'
	};
</script>

<PageShell
	eyebrow="Reports"
	title="Reporting Center"
	description="Project-level profitability report generated from current project financial data."
>
	<form method="GET" class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
		<div class="flex flex-wrap items-end gap-3">
			<label class="text-sm text-slate-600">
				Project
				<select
					name="projectId"
					value={data.filters.projectId}
					class="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
				>
					<option value="">All</option>
					{#each data.projectOptions as project}
						<option value={project.id}>{project.name}</option>
					{/each}
				</select>
			</label>
			<label class="text-sm text-slate-600">
				Status
				<select
					name="status"
					value={data.filters.status}
					class="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
				>
					<option value="">All</option>
					<option value="active">active</option>
					<option value="on_hold">on_hold</option>
					<option value="completed">completed</option>
					<option value="archived">archived</option>
				</select>
			</label>
			<label class="text-sm text-slate-600">
				From
				<input
					type="date"
					lang="en-GB"
					name="from"
					value={data.filters.from}
					class="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
				/>
			</label>
			<label class="text-sm text-slate-600">
				To
				<input
					type="date"
					lang="en-GB"
					name="to"
					value={data.filters.to}
					class="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
				/>
			</label>
			<button class="rounded-md bg-[var(--sf-green)] px-3 py-2 text-sm text-white hover:bg-[#2f5e2c]" type="submit">
				Apply
			</button>
			<a
				class="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
				href={`/api/reports/projects-profit/export?projectId=${encodeURIComponent(data.filters.projectId)}&projectStatus=${encodeURIComponent(data.filters.status)}&from=${encodeURIComponent(data.filters.from)}&to=${encodeURIComponent(data.filters.to)}`}
				target="_blank"
				rel="noreferrer"
			>
				Export CSV
			</a>
		</div>
	</form>

	<section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
		<article class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
			<p class="flex items-center gap-2 text-xs text-slate-500">
				<span>Total Revenue</span>
				<button
					type="button"
					class="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] text-slate-500"
					aria-label="Show Total Revenue calculation logic"
					title={reportMetricHelp.revenue}
				>
					i
				</button>
			</p>
			<p class="mt-2 text-xl font-semibold text-slate-900">{money(totals.revenue)}</p>
		</article>
		<article class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
			<p class="flex items-center gap-2 text-xs text-slate-500">
				<span>Total Cost</span>
				<button
					type="button"
					class="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] text-slate-500"
					aria-label="Show Total Cost calculation logic"
					title={reportMetricHelp.cost}
				>
					i
				</button>
			</p>
			<p class="mt-2 text-xl font-semibold text-slate-900">{money(totals.cost)}</p>
		</article>
		<article class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
			<p class="flex items-center gap-2 text-xs text-slate-500">
				<span>Total Profit</span>
				<button
					type="button"
					class="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] text-slate-500"
					aria-label="Show Total Profit calculation logic"
					title={reportMetricHelp.profit}
				>
					i
				</button>
			</p>
			<p class="mt-2 text-xl font-semibold text-slate-900">{money(totals.profit)}</p>
		</article>
		<article class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
			<p class="flex items-center gap-2 text-xs text-slate-500">
				<span>Average Margin</span>
				<button
					type="button"
					class="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] text-slate-500"
					aria-label="Show Average Margin calculation logic"
					title={reportMetricHelp.margin}
				>
					i
				</button>
			</p>
			<p class="mt-2 text-xl font-semibold text-slate-900">{(totals.margin * 100).toFixed(2)}%</p>
		</article>
	</section>

	<div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
		<table class="min-w-full divide-y divide-slate-200 text-sm">
			<thead class="bg-slate-50 text-left text-slate-600">
				<tr>
					<th class="px-4 py-3">Project</th>
					<th class="px-4 py-3">Status</th>
					<th class="px-4 py-3">Revenue</th>
					<th class="px-4 py-3">Cost</th>
					<th class="px-4 py-3">Profit</th>
					<th class="px-4 py-3">Margin</th>
					<th class="px-4 py-3">Band</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#if data.projectsProfit.length === 0}
					<tr>
						<td class="px-4 py-8 text-center text-slate-500" colspan="7">No report data yet.</td>
					</tr>
				{:else}
					{#each data.projectsProfit as item}
						<tr class="hover:bg-slate-50">
							<td class="px-4 py-3 font-medium text-slate-800">{item.projectName}</td>
							<td class="px-4 py-3">{item.projectStatus}</td>
							<td class="px-4 py-3">{money(item.revenue)}</td>
							<td class="px-4 py-3">{money(item.cost)}</td>
							<td class="px-4 py-3">{money(item.profit)}</td>
							<td class="px-4 py-3">{(item.profitMargin * 100).toFixed(2)}%</td>
							<td class="px-4 py-3">
								<span class={`rounded-full px-2 py-1 text-xs font-medium ${marginBand(item.profitMargin).className}`}>
									{marginBand(item.profitMargin).label}
								</span>
							</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>
</PageShell>
