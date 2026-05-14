<script lang="ts">
	import { goto } from '$app/navigation';
	import PageShell from '$app-layer/components/PageShell.svelte';

	let { data } = $props();

	let showManualEntry = $state(false);
	let filterType = $state<'all' | 'standard' | 'zero_rate' | 'tax_invoice'>('all');

	const money = (value: number | null | undefined, currency = 'SGD') =>
		new Intl.NumberFormat('en-SG', { style: 'currency', currency }).format(value ?? 0);

	const formatDate = (date: string | null) => {
		if (!date) return '-';
		return new Date(date).toLocaleDateString('en-SG', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	};

	const invoiceTypeLabel = (type: string | null) => {
		switch (type) {
			case 'zero_rate':
				return 'Zero Rate';
			case 'tax_invoice':
				return 'Tax Invoice';
			case 'standard':
				return 'Standard';
			default:
				return type ?? '-';
		}
	};

	const filteredRevenue = $derived.by(() =>
		data.revenueRecords.filter((row) => filterType === 'all' || row.invoiceType === filterType)
	);

	const rowClass =
		'transition hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sf-green)] focus-visible:ring-offset-2';

	const revenueDetailHref = (row: (typeof data.revenueRecords)[number]) =>
		row.projectId ? `/projects/${row.projectId}/documents/revenue/${row.id}` : null;

	function rowNavigate(row: (typeof data.revenueRecords)[number]) {
		const href = revenueDetailHref(row);
		if (href) void goto(href);
	}

	function rowKeyDown(e: KeyboardEvent, row: (typeof data.revenueRecords)[number]) {
		if (e.key === 'Enter' || e.key === ' ') {
			const href = revenueDetailHref(row);
			if (!href) return;
			e.preventDefault();
			void goto(href);
		}
	}
</script>

<PageShell
	eyebrow="Finance"
	title="Revenue"
	description="Review company revenue records across projects and standalone customer receipts."
>
	<div class="grid grid-cols-2 gap-4 md:grid-cols-3">
		<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
			<p class="text-[11px] font-medium uppercase tracking-wide text-slate-400">Total Revenue</p>
			<p class="mt-1 text-xl font-semibold text-slate-900">{money(data.totals.total)}</p>
		</div>
		<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
			<p class="text-[11px] font-medium uppercase tracking-wide text-slate-400">Standard Rated</p>
			<p class="mt-1 text-xl font-semibold text-slate-900">{money(data.totals.standardRated)}</p>
		</div>
		<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
			<p class="text-[11px] font-medium uppercase tracking-wide text-slate-400">Zero Rate</p>
			<p class="mt-1 text-xl font-semibold text-slate-900">{money(data.totals.zeroRate)}</p>
		</div>
	</div>

	<div class="flex flex-wrap items-center justify-between gap-3">
		<select bind:value={filterType} class="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
			<option value="all">All Types</option>
			<option value="standard">Standard</option>
			<option value="tax_invoice">Tax Invoice</option>
			<option value="zero_rate">Zero Rate</option>
		</select>

		<div class="flex items-center gap-2">
			<a
				class="rounded-md bg-[var(--sf-green)] px-3 py-2 text-sm font-medium text-white hover:bg-[#2f5e2c]"
				href="/finance/revenue/generate"
			>
				Generate customer invoice
			</a>
			<a
				class="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
				href="/finance/inbox"
			>
				Upload customer invoice
			</a>
			<button
				type="button"
				class="rounded-md bg-[var(--sf-green)] px-3 py-2 text-sm font-medium text-white hover:bg-[#2f5e2c]"
				onclick={() => (showManualEntry = true)}
			>
				Manual Entry
			</button>
		</div>
	</div>

	<div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
		<table class="min-w-full divide-y divide-slate-200 text-sm">
			<thead class="bg-slate-50 text-left text-slate-600">
				<tr>
					<th class="px-4 py-3 font-medium">Type</th>
					<th class="px-4 py-3 font-medium">Date</th>
					<th class="px-4 py-3 font-medium">Invoice No.</th>
					<th class="px-4 py-3 font-medium">Client</th>
					<th class="px-4 py-3 font-medium">Project</th>
					<th class="px-4 py-3 font-medium text-right">Amount</th>
					<th class="px-4 py-3 font-medium text-right">GST</th>
					<th class="px-4 py-3 font-medium">Notes</th>
					<th class="px-4 py-3 font-medium text-right">File</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#if filteredRevenue.length === 0}
					<tr>
						<td class="px-4 py-8 text-center text-slate-500" colspan="9">
							No revenue records found. Upload a customer invoice or create a manual entry.
						</td>
					</tr>
				{:else}
					{#each filteredRevenue as row}
						<tr
							class={`${rowClass} ${revenueDetailHref(row) ? 'cursor-pointer' : ''}`}
							role={revenueDetailHref(row) ? 'link' : undefined}
							tabindex={revenueDetailHref(row) ? 0 : undefined}
							onclick={() => rowNavigate(row)}
							onkeydown={(e) => rowKeyDown(e, row)}
						>
							<td class="px-4 py-3">
								<span class="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
									{invoiceTypeLabel(row.invoiceType)}
								</span>
							</td>
							<td class="px-4 py-3 text-slate-600">{formatDate(row.date)}</td>
							<td class="px-4 py-3 font-medium text-slate-800">{row.invoiceNumber || '-'}</td>
							<td class="max-w-[180px] truncate px-4 py-3 text-slate-600" title={row.clientName ?? ''}>
								{row.clientName || '-'}
							</td>
							<td class="max-w-[180px] truncate px-4 py-3 text-slate-600" title={row.projectName ?? ''}>
								{row.projectName ?? '-'}
							</td>
							<td class="px-4 py-3 text-right font-medium text-slate-800">
								{money(row.amount, row.currency)}
								{#if row.currency !== 'SGD' && row.sgdEquivalent}
									<span class="block text-xs text-slate-500">{money(row.sgdEquivalent)}</span>
								{/if}
							</td>
							<td class="px-4 py-3 text-right text-slate-600">
								{row.gstAmount ? money(row.gstAmount, row.currency) : '-'}
							</td>
							<td class="max-w-[200px] truncate px-4 py-3 text-xs text-slate-500" title={row.notes ?? ''}>
								{row.notes || '-'}
							</td>
							<td class="px-4 py-3 text-right">
								{#if row.hasAttachment && revenueDetailHref(row)}
									<a
										class="text-sm font-medium text-[var(--sf-green)] hover:underline"
										href={revenueDetailHref(row)}
										onclick={(e) => e.stopPropagation()}
									>
										View
									</a>
								{:else}
									<span class="text-slate-400">-</span>
								{/if}
							</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>
</PageShell>

{#if showManualEntry}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<button
			type="button"
			class="absolute inset-0 bg-black/40"
			aria-label="Close"
			onclick={() => (showManualEntry = false)}
		></button>
		<div class="relative w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
			<div class="border-b border-slate-200 bg-slate-50 px-5 py-4">
				<h3 class="text-base font-semibold text-slate-900">Manual Revenue Entry</h3>
				<p class="text-sm text-slate-500">Saving confirms revenue received without attaching a document.</p>
			</div>
			<form method="POST" action="?/create" class="space-y-4 p-5">
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label class="block text-sm font-medium text-slate-700" for="invoiceType">Invoice Type</label>
						<select id="invoiceType" name="invoiceType" class="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm" required>
							<option value="standard">Standard</option>
							<option value="tax_invoice">Tax Invoice</option>
							<option value="zero_rate">Zero Rate</option>
						</select>
					</div>
					<div>
						<label class="block text-sm font-medium text-slate-700" for="date">Date</label>
						<input
							type="date"
							id="date"
							name="date"
							class="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
							value={new Date().toISOString().slice(0, 10)}
							required
						/>
					</div>
				</div>
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label class="block text-sm font-medium text-slate-700" for="invoiceNumber">Invoice Number</label>
						<input type="text" id="invoiceNumber" name="invoiceNumber" class="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="INV-2026-001" />
					</div>
					<div>
						<label class="block text-sm font-medium text-slate-700" for="clientName">Client Name</label>
						<input type="text" id="clientName" name="clientName" class="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
					</div>
				</div>
				<div class="grid grid-cols-3 gap-4">
					<div>
						<label class="block text-sm font-medium text-slate-700" for="currency">Currency</label>
						<select id="currency" name="currency" class="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
							<option value="SGD">SGD</option>
							<option value="USD">USD</option>
							<option value="CNY">CNY</option>
						</select>
					</div>
					<div>
						<label class="block text-sm font-medium text-slate-700" for="amount">Amount</label>
						<input type="number" id="amount" name="amount" step="0.01" min="0" class="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm" required />
					</div>
					<div>
						<label class="block text-sm font-medium text-slate-700" for="gstAmount">GST</label>
						<input type="number" id="gstAmount" name="gstAmount" step="0.01" min="0" value="0" class="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
					</div>
				</div>
				<div>
					<label class="block text-sm font-medium text-slate-700" for="notes">Notes</label>
					<textarea id="notes" name="notes" rows="2" class="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"></textarea>
				</div>
				<div class="flex justify-end gap-2 border-t border-slate-200 pt-4">
					<button
						type="button"
						class="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
						onclick={() => (showManualEntry = false)}
					>
						Cancel
					</button>
					<button type="submit" class="rounded-md bg-[var(--sf-green)] px-4 py-2 text-sm font-medium text-white hover:bg-[#2f5e2c]">
						Save Revenue
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
