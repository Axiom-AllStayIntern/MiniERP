<script lang="ts">
	import { setAgentPageContext } from '$app-layer/ai-panel/state/context';

	let { data } = $props();
	$effect(() => {
		setAgentPageContext({
			project_id: data.project.id,
			project_name: data.project.name
		});

		return () => {
			setAgentPageContext({});
		};
	});

	const projBase = $derived(`/projects/${data.project.id}`);

	const money = (value: number) =>
		new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD' }).format(value ?? 0);

	const fyLabel = $derived.by(() => {
		const y = data.project.startDate
			? new Date(data.project.startDate).getFullYear()
			: new Date().getFullYear();
		return Number.isNaN(y) ? '' : `FY${y}`;
	});

	const profitMarginPct = $derived.by(() => {
		const r = data.breakdown.revenue;
		if (!r || r <= 0) return 0;
		return (data.profit / r) * 100;
	});

	const totalCost = $derived.by(
		() =>
			data.breakdown.purchaseCost + data.breakdown.staffCost + data.breakdown.expenseCost
	);

	const costShare = $derived.by(() => {
		const t = totalCost;
		if (!t || t <= 0) {
			return { purchase: 0, staff: 0, expense: 0 };
		}
		return {
			purchase: (data.breakdown.purchaseCost / t) * 100,
			staff: (data.breakdown.staffCost / t) * 100,
			expense: (data.breakdown.expenseCost / t) * 100
		};
	});

	type DetailItem = {
		id: string;
		label: string | null;
		date: string | null;
		status: string | null;
		amount: number;
	};

	let selectedDetailId = $state<string | null>(null);

	const detailGroups = $derived.by(
		(): Array<{
			id: string;
			title: string;
			description: string;
			total: number;
			items: DetailItem[];
			fallback: string;
		}> => [
			{
				id: 'revenue-details',
				title: 'Revenue Breakdown',
				description: 'Composed from customer invoices (invoices_out.total).',
				total: data.breakdown.revenue,
				items: data.details.revenueItems,
				fallback: 'No revenue invoice records yet.'
			},
			{
				id: 'purchase-details',
				title: 'Purchase Cost Breakdown',
				description: 'Composed from supplier invoices (invoices_in.amount).',
				total: data.breakdown.purchaseCost,
				items: data.details.purchaseItems,
				fallback: 'No supplier invoice records yet.'
			},
			{
				id: 'staff-details',
				title: 'Staff Cost Breakdown',
				description: 'Staff cost from payout_records (confirmed / paid, excluding dividend).',
				total: data.breakdown.staffCost,
				items: data.details.staffItems,
				fallback: 'No staff compensation records yet.'
			},
			{
				id: 'expense-details',
				title: 'Expense Cost Breakdown',
				description:
					'Project expenses. Sales Cost vs OpEx; totals feed gross vs net profit.',
				total: data.breakdown.expenseCost,
				items: data.details.expenseItems,
				fallback: 'No expense records yet.'
			}
		]
	);

	const selectedDetailGroup = $derived.by(
		() => detailGroups.find((group) => group.id === selectedDetailId) ?? null
	);

	const openDetail = (id: string) => {
		selectedDetailId = id;
	};

	const closeDetail = () => {
		selectedDetailId = null;
	};
</script>

<div class="space-y-6">
	<!-- Page heading -->
	<div>
		<h1 class="text-xl font-semibold text-slate-900">Project Dashboard</h1>
		<p class="mt-1 text-sm text-slate-500">Financial overview and P&L summary for this project.</p>
	</div>

	<!-- Financial overview -->
	<section class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
		<div
			class="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4"
		>
			<div>
				<h2 class="text-[13px] font-medium text-slate-900">Financial Overview</h2>
				<p class="mt-0.5 text-xs text-slate-500">Click any metric to view detail breakdown.</p>
			</div>
			{#if fyLabel}
				<span class="rounded-full px-2 py-0.5 text-[11px] font-medium" style="background: #e6f1fb; color: #185fa5;">
					{fyLabel}
				</span>
			{/if}
		</div>
		<div class="grid grid-cols-2 gap-px bg-slate-200 xl:grid-cols-4">
			<button
				type="button"
				class="bg-white px-5 py-4 text-left transition hover:bg-slate-50"
				onclick={() => openDetail('revenue-details')}
			>
				<p class="text-[11px] font-medium uppercase tracking-wide text-slate-400">Revenue</p>
				<p class="mt-1.5 text-[22px] font-medium text-slate-900">{money(data.breakdown.revenue)}</p>
				<p class="mt-1 text-[11px] text-slate-500">
					{data.metricDocCounts.revenue} invoice{data.metricDocCounts.revenue === 1 ? '' : 's'}
				</p>
			</button>
			<button
				type="button"
				class="bg-white px-5 py-4 text-left transition hover:bg-slate-50"
				onclick={() => openDetail('purchase-details')}
			>
				<p class="text-[11px] font-medium uppercase tracking-wide text-slate-400">Purchase Cost</p>
				<p class="mt-1.5 text-[22px] font-medium text-slate-900">
					{money(data.breakdown.purchaseCost)}
				</p>
				<p class="mt-1 text-[11px] text-slate-500">
					{data.metricDocCounts.purchase} supplier invoice{data.metricDocCounts.purchase === 1 ? '' : 's'}
				</p>
			</button>
			<button
				type="button"
				class="bg-white px-5 py-4 text-left transition hover:bg-slate-50"
				onclick={() => openDetail('staff-details')}
			>
				<p class="text-[11px] font-medium uppercase tracking-wide text-slate-400">Staff Cost</p>
				<p class="mt-1.5 text-[22px] font-medium text-slate-900">{money(data.breakdown.staffCost)}</p>
				<p class="mt-1 text-[11px] text-slate-500">
					{data.metricDocCounts.staff} compensation{data.metricDocCounts.staff === 1 ? '' : 's'}
				</p>
			</button>
			<button
				type="button"
				class="bg-white px-5 py-4 text-left transition hover:bg-slate-50"
				onclick={() => openDetail('expense-details')}
			>
				<p class="text-[11px] font-medium uppercase tracking-wide text-slate-400">Expense Cost</p>
				<p class="mt-1.5 text-[22px] font-medium text-slate-900">
					{money(data.breakdown.expenseCost)}
				</p>
				<p class="mt-1 text-[11px] text-slate-500">
					{data.metricDocCounts.expense} record{data.metricDocCounts.expense === 1 ? '' : 's'} · Sales Cost{' '}
					{money(data.breakdown.expenseSalesCost)} · OpEx {money(data.breakdown.expenseOpexCost)}
				</p>
			</button>
		</div>
		<div class="grid grid-cols-1 gap-px bg-slate-200 border-t border-slate-200 md:grid-cols-3">
			<div class="px-5 py-3.5" style="background: var(--sf-green-soft);">
				<p class="text-[11px] font-medium uppercase tracking-wide text-[var(--sf-green)] opacity-80">
					Gross / Net Profit
				</p>
				<p class="mt-1 text-sm font-medium text-emerald-950">
					Gross {money(data.grossProfit)}
				</p>
				<p
					class="mt-0.5 text-xl font-medium {data.profit >= 0 ? 'text-emerald-900' : 'text-rose-700'}"
				>
					Net {money(data.profit)}
				</p>
				<p class="mt-0.5 text-xs text-[var(--sf-green)]">Net = Gross - OpEx expenses</p>
			</div>
			<div class="px-5 py-3.5" style="background: var(--sf-green-soft);">
				<p class="text-[11px] font-medium uppercase tracking-wide text-[var(--sf-green)] opacity-80">
					Profit Margin
				</p>
				<p class="mt-1 text-xl font-medium text-emerald-900">
					{profitMarginPct.toFixed(1)}%
				</p>
				<p class="mt-0.5 text-xs text-[var(--sf-green)]">Net Profit / Revenue</p>
			</div>
			<div class="bg-slate-50 px-5 py-3.5">
				<p class="text-[11px] font-medium uppercase tracking-wide text-slate-400">Cost Breakdown</p>
				<div class="mt-2 space-y-1">
					<div class="flex items-center gap-2">
						<span class="w-20 shrink-0 text-[11px] text-slate-600">Purchase</span>
						<div class="h-1 flex-1 overflow-hidden rounded-full bg-slate-200">
							<div
								class="h-full rounded-full bg-sky-600"
								style={`width:${costShare.purchase}%`}
							></div>
						</div>
						<span class="w-9 shrink-0 text-right text-[11px] text-slate-600">
							{costShare.purchase.toFixed(0)}%
						</span>
					</div>
					<div class="flex items-center gap-2">
						<span class="w-20 shrink-0 text-[11px] text-slate-600">Staff</span>
						<div class="h-1 flex-1 overflow-hidden rounded-full bg-slate-200">
							<div
								class="h-full rounded-full bg-amber-500"
								style={`width:${costShare.staff}%`}
							></div>
						</div>
						<span class="w-9 shrink-0 text-right text-[11px] text-slate-600">
							{costShare.staff.toFixed(0)}%
						</span>
					</div>
					<div class="flex items-center gap-2">
						<span class="w-20 shrink-0 text-[11px] text-slate-600">Expense</span>
						<div class="h-1 flex-1 overflow-hidden rounded-full bg-slate-200">
							<div
								class="h-full rounded-full bg-pink-700"
								style={`width:${costShare.expense}%`}
							></div>
						</div>
						<span class="w-9 shrink-0 text-right text-[11px] text-slate-600">
							{costShare.expense.toFixed(0)}%
						</span>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- Quick Access Cards -->
	<section>
		<h2 class="mb-4 text-sm font-medium text-slate-700">Quick Access</h2>
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<a
				href="{projBase}/documents"
				class="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[var(--sf-green)] hover:shadow-md"
			>
				<div class="flex items-center justify-between">
					<span class="text-2xl opacity-60">-</span>
					<span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 group-hover:bg-[var(--sf-green-soft)] group-hover:text-[var(--sf-green)]">
						{data.submoduleCounts.contracts + data.submoduleCounts.quotations + data.submoduleCounts.purchaseOrders}
					</span>
				</div>
				<h3 class="mt-3 font-medium text-slate-900 group-hover:text-[var(--sf-green)]">Documents</h3>
				<p class="mt-1 text-xs text-slate-500">Contracts, quotations, purchase orders</p>
			</a>

			<a
				href="{projBase}/expenses"
				class="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[var(--sf-green)] hover:shadow-md"
			>
				<div class="flex items-center justify-between">
					<span class="text-2xl opacity-60">-</span>
					<span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 group-hover:bg-[var(--sf-green-soft)] group-hover:text-[var(--sf-green)]">
						{data.submoduleCounts.expenses}
					</span>
				</div>
				<h3 class="mt-3 font-medium text-slate-900 group-hover:text-[var(--sf-green)]">Expenses</h3>
				<p class="mt-1 text-xs text-slate-500">Project expense claims & receipts</p>
			</a>

			<a
				href="{projBase}/revenue"
				class="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[var(--sf-green)] hover:shadow-md"
			>
				<div class="flex items-center justify-between">
					<span class="text-2xl opacity-60">¥</span>
					<span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 group-hover:bg-[var(--sf-green-soft)] group-hover:text-[var(--sf-green)]">
						{data.metricDocCounts.revenue}
					</span>
				</div>
				<h3 class="mt-3 font-medium text-slate-900 group-hover:text-[var(--sf-green)]">Revenue</h3>
				<p class="mt-1 text-xs text-slate-500">Customer invoices & billing</p>
			</a>

			<a
				href="{projBase}/employees"
				class="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[var(--sf-green)] hover:shadow-md"
			>
				<div class="flex items-center justify-between">
					<span class="text-2xl opacity-60">-</span>
					<span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 group-hover:bg-[var(--sf-green-soft)] group-hover:text-[var(--sf-green)]">
						{data.metricDocCounts.staff}
					</span>
				</div>
				<h3 class="mt-3 font-medium text-slate-900 group-hover:text-[var(--sf-green)]">Team & Cost</h3>
				<p class="mt-1 text-xs text-slate-500">Team members & compensation</p>
			</a>
		</div>
	</section>
</div>

{#if selectedDetailGroup}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<button
			type="button"
			class="absolute inset-0 bg-[var(--sf-green)]/40"
			aria-label="Close detail dialog"
			onclick={closeDetail}
		></button>
		<div
			class="relative max-h-[85vh] w-full max-w-5xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
			role="dialog"
			aria-modal="true"
			aria-labelledby="detail-dialog-title"
		>
			<div class="border-b border-slate-200 bg-slate-50 px-4 py-3">
				<div class="flex items-start justify-between gap-4">
					<div>
						<h3 id="detail-dialog-title" class="text-base font-semibold text-slate-900">
							{selectedDetailGroup.title}
						</h3>
						<p class="text-xs text-slate-500">{selectedDetailGroup.description}</p>
					</div>
					<div class="flex shrink-0 items-start gap-3">
						<div class="text-right">
							<p class="text-xs text-slate-500">Subtotal</p>
							<p class="text-sm font-semibold text-slate-900">{money(selectedDetailGroup.total)}</p>
						</div>
						<button
							type="button"
							class="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
							onclick={closeDetail}
						>
							Close
						</button>
					</div>
				</div>
			</div>
			<div class="max-h-[60vh] overflow-auto">
				<table class="min-w-full divide-y divide-slate-200 text-sm">
					<thead class="bg-white text-left text-slate-600">
						<tr>
							<th class="px-4 py-3">Ref</th>
							<th class="px-4 py-3">Date</th>
							<th class="px-4 py-3">Status / Note</th>
							<th class="px-4 py-3 text-right">Amount</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-100">
						{#if selectedDetailGroup.items.length === 0}
							<tr>
								<td class="px-4 py-8 text-center text-slate-500" colspan="4">
									{selectedDetailGroup.fallback}
								</td>
							</tr>
						{:else}
							{#each selectedDetailGroup.items as item}
								<tr class="hover:bg-slate-50">
									<td class="px-4 py-3 font-medium text-slate-800">{item.label || item.id}</td>
									<td class="px-4 py-3 text-slate-600">{item.date || '-'}</td>
									<td class="px-4 py-3 text-slate-600">{item.status || '-'}</td>
									<td class="px-4 py-3 text-right text-slate-800">{money(item.amount)}</td>
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			</div>
		</div>
	</div>
{/if}

