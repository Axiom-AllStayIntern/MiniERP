<script lang="ts">
	import { goto } from '$app/navigation';

	let { data } = $props();
	const contracts = $derived(data.contracts ?? []);
	const quotations = $derived(data.quotations ?? []);
	const purchaseOrders = $derived(data.purchaseOrders ?? []);
	const expenseDocuments = $derived(data.expenseDocuments ?? []);
	const revenueDocuments = $derived(data.revenueDocuments ?? []);

	const money = (value: number | null, currency = 'SGD') =>
		value != null
			? new Intl.NumberFormat('en-SG', { style: 'currency', currency }).format(value)
			: '-';

	const formatDate = (date: string | null) => {
		if (!date) return '-';
		return new Date(date).toLocaleDateString('en-SG', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	};

	const docTypeLabel = (type: string) => {
		const labels: Record<string, string> = {
			contract: 'Contract',
			po: 'Purchase Order',
			bom: 'BOM',
			quotation: 'Quotation',
			other: 'Other'
		};
		return labels[type] || type;
	};

	const statusBadgeClass = (status: string | null) => {
		switch (status) {
			case 'active':
			case 'confirmed':
			case 'accepted':
			case 'done':
				return 'bg-emerald-100 text-emerald-700';
			case 'draft':
			case 'sent':
			case 'pending':
			case 'processing':
				return 'bg-amber-100 text-amber-700';
			case 'completed':
			case 'fulfilled':
				return 'bg-blue-100 text-blue-700';
			case 'terminated':
			case 'rejected':
			case 'expired':
			case 'failed':
				return 'bg-red-100 text-red-700';
			default:
				return 'bg-slate-100 text-slate-600';
		}
	};

	const totalDocs = $derived(
		data.documents.length +
			contracts.length +
			quotations.length +
			purchaseOrders.length +
			expenseDocuments.length +
			revenueDocuments.length
	);

	const expenseTypeBadgeClass = (expenseType: string) =>
		expenseType === 'sales_cost' ? 'bg-sky-100 text-sky-800' : 'bg-purple-100 text-purple-800';

	const rowClass =
		'cursor-pointer transition hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sf-green)] focus-visible:ring-offset-2';

	function go(href: string) {
		void goto(href);
	}

	function rowKey(e: KeyboardEvent, href: string) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			void goto(href);
		}
	}

	function openFile(key: string) {
		window.open(`/api/files?key=${encodeURIComponent(key)}`, '_blank', 'noopener,noreferrer');
	}

	function otherDocKey(e: KeyboardEvent, key: string) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			openFile(key);
		}
	}
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-xl font-semibold text-slate-900">Reference Documents</h1>
		<p class="mt-1 text-sm text-slate-500">
			Contracts, quotations, purchase orders, expense receipts, and other project reference files.
		</p>
	</div>

	<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
		<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
			<p class="text-[11px] font-medium uppercase tracking-wide text-slate-400">Total Documents</p>
			<p class="mt-1 text-2xl font-semibold text-slate-900">{totalDocs}</p>
		</div>
		<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
			<p class="text-[11px] font-medium uppercase tracking-wide text-slate-400">Contracts</p>
			<p class="mt-1 text-2xl font-semibold text-slate-900">{contracts.length}</p>
		</div>
		<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
			<p class="text-[11px] font-medium uppercase tracking-wide text-slate-400">Quotations</p>
			<p class="mt-1 text-2xl font-semibold text-slate-900">{quotations.length}</p>
		</div>
		<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
			<p class="text-[11px] font-medium uppercase tracking-wide text-slate-400">Purchase Orders</p>
			<p class="mt-1 text-2xl font-semibold text-slate-900">{purchaseOrders.length}</p>
		</div>
		<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
			<p class="text-[11px] font-medium uppercase tracking-wide text-slate-400">Expense Docs</p>
			<p class="mt-1 text-2xl font-semibold text-slate-900">{expenseDocuments.length}</p>
		</div>
		<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
			<p class="text-[11px] font-medium uppercase tracking-wide text-slate-400">Revenue Docs</p>
			<p class="mt-1 text-2xl font-semibold text-slate-900">{revenueDocuments.length}</p>
		</div>
	</div>

	<div class="flex flex-wrap items-center gap-2">
		<a
			class="rounded-md border border-[var(--sf-green)] bg-[var(--sf-green)] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
			href={`/finance/doc-hub/upload/project?projectId=${encodeURIComponent(data.project.id)}`}
		>
			Upload file only
		</a>
		<a
			class="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
			href={`/projects/${data.project.id}/expenses`}
		>
			Upload expense
		</a>
	</div>

	{#if contracts.length > 0}
		<div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
			<div class="border-b border-slate-200 bg-slate-50 px-5 py-3">
				<h3 class="text-sm font-semibold text-slate-900">Contracts</h3>
			</div>
			<table class="min-w-full divide-y divide-slate-200 text-sm">
				<thead class="bg-white text-left text-slate-600">
					<tr>
						<th class="px-4 py-3 font-medium">Ref.</th>
						<th class="px-4 py-3 font-medium">File name</th>
						<th class="px-4 py-3 font-medium">Date</th>
						<th class="px-4 py-3 font-medium">Status</th>
						<th class="px-4 py-3 font-medium">Amount</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100">
					{#each contracts as contract}
						<tr
							class={rowClass}
							tabindex="0"
							role="link"
							onclick={() => go(`/projects/${data.project.id}/documents/contracts/${contract.id}`)}
							onkeydown={(e) => rowKey(e, `/projects/${data.project.id}/documents/contracts/${contract.id}`)}
						>
							<td class="px-4 py-3 font-medium text-slate-800">{contract.displayNumber}</td>
							<td class="max-w-xs truncate px-4 py-3 text-slate-700" title={contract.displayFileName}>
								{contract.displayFileName}
							</td>
							<td class="px-4 py-3 text-slate-600">{formatDate(contract.date)}</td>
							<td class="px-4 py-3">
								<span class="rounded-full px-2 py-0.5 text-xs font-medium {statusBadgeClass(contract.status)}">
									{contract.status || 'draft'}
								</span>
							</td>
							<td class="px-4 py-3 font-medium text-slate-800">
								{money(contract.amount, contract.currency || 'SGD')}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	{#if quotations.length > 0}
		<div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
			<div class="border-b border-slate-200 bg-slate-50 px-5 py-3">
				<h3 class="text-sm font-semibold text-slate-900">Quotations</h3>
			</div>
			<table class="min-w-full divide-y divide-slate-200 text-sm">
				<thead class="bg-white text-left text-slate-600">
					<tr>
						<th class="px-4 py-3 font-medium">Ref.</th>
						<th class="px-4 py-3 font-medium">File name</th>
						<th class="px-4 py-3 font-medium">Date</th>
						<th class="px-4 py-3 font-medium">Status</th>
						<th class="px-4 py-3 font-medium">Amount</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100">
					{#each quotations as quotation}
						<tr
							class={rowClass}
							tabindex="0"
							role="link"
							onclick={() => go(`/projects/${data.project.id}/documents/quotations/${quotation.id}`)}
							onkeydown={(e) => rowKey(e, `/projects/${data.project.id}/documents/quotations/${quotation.id}`)}
						>
							<td class="px-4 py-3 font-medium text-slate-800">{quotation.displayNumber}</td>
							<td class="max-w-xs truncate px-4 py-3 text-slate-700" title={quotation.displayFileName}>
								{quotation.displayFileName}
							</td>
							<td class="px-4 py-3 text-slate-600">{formatDate(quotation.date)}</td>
							<td class="px-4 py-3">
								<span class="rounded-full px-2 py-0.5 text-xs font-medium {statusBadgeClass(quotation.status)}">
									{quotation.status || 'draft'}
								</span>
							</td>
							<td class="px-4 py-3 font-medium text-slate-800">
								{money(quotation.amount, quotation.currency || 'SGD')}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	{#if expenseDocuments.length > 0}
		<div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
			<div class="border-b border-slate-200 bg-slate-50 px-5 py-3">
				<h3 class="text-sm font-semibold text-slate-900">Expense documents</h3>
				<p class="mt-0.5 text-xs text-slate-500">
					Project expense records and uploaded receipts (same as Expenses module).
				</p>
			</div>
			<table class="min-w-full divide-y divide-slate-200 text-sm">
				<thead class="bg-white text-left text-slate-600">
					<tr>
						<th class="px-4 py-3 font-medium">Ref.</th>
						<th class="px-4 py-3 font-medium">File name</th>
						<th class="px-4 py-3 font-medium">Date</th>
						<th class="px-4 py-3 font-medium">Status</th>
						<th class="px-4 py-3 font-medium">Amount</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100">
					{#each expenseDocuments as exp}
						<tr
							class={rowClass}
							tabindex="0"
							role="link"
							onclick={() => go(`/projects/${data.project.id}/documents/expenses/${exp.id}`)}
							onkeydown={(e) =>
								rowKey(e, `/projects/${data.project.id}/documents/expenses/${exp.id}`)}
						>
							<td class="px-4 py-3 font-medium text-slate-800">{exp.displayNumber}</td>
							<td class="max-w-xs truncate px-4 py-3 text-slate-700" title={exp.displayFileName}>
								{exp.displayFileName}
							</td>
							<td class="px-4 py-3 text-slate-600">{formatDate(exp.date)}</td>
							<td class="px-4 py-3">
								<span
									class="rounded-full px-2 py-0.5 text-xs font-medium {expenseTypeBadgeClass(
										exp.expenseType
									)}"
								>
									{exp.statusLabel}
								</span>
							</td>
							<td class="px-4 py-3 font-medium text-slate-800">
								{money(exp.amount, exp.currency || 'SGD')}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	{#if revenueDocuments.length > 0}
		<div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
			<div class="border-b border-slate-200 bg-slate-50 px-5 py-3">
				<h3 class="text-sm font-semibold text-slate-900">Revenue documents</h3>
				<p class="mt-0.5 text-xs text-slate-500">
					Project customer invoice files and revenue records (same style as expense docs).
				</p>
			</div>
			<table class="min-w-full divide-y divide-slate-200 text-sm">
				<thead class="bg-white text-left text-slate-600">
					<tr>
						<th class="px-4 py-3 font-medium">Ref.</th>
						<th class="px-4 py-3 font-medium">File name</th>
						<th class="px-4 py-3 font-medium">Date</th>
						<th class="px-4 py-3 font-medium">Status</th>
						<th class="px-4 py-3 font-medium">Amount</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100">
					{#each revenueDocuments as rev}
						<tr
							class={rowClass}
							tabindex="0"
							role="link"
							onclick={() => go(`/projects/${data.project.id}/documents/revenue/${rev.id}`)}
							onkeydown={(e) =>
								rowKey(e, `/projects/${data.project.id}/documents/revenue/${rev.id}`)}
						>
							<td class="px-4 py-3 font-medium text-slate-800">{rev.displayNumber}</td>
							<td class="max-w-xs truncate px-4 py-3 text-slate-700" title={rev.displayFileName}>
								{rev.displayFileName}
							</td>
							<td class="px-4 py-3 text-slate-600">{formatDate(rev.date)}</td>
							<td class="px-4 py-3">
								<span class="rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700">
									{rev.statusLabel}
								</span>
							</td>
							<td class="px-4 py-3 font-medium text-slate-800">
								{money(rev.amount, rev.currency || 'SGD')}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	{#if purchaseOrders.length > 0}
		<div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
			<div class="border-b border-slate-200 bg-slate-50 px-5 py-3">
				<h3 class="text-sm font-semibold text-slate-900">Purchase Orders</h3>
			</div>
			<table class="min-w-full divide-y divide-slate-200 text-sm">
				<thead class="bg-white text-left text-slate-600">
					<tr>
						<th class="px-4 py-3 font-medium">Ref.</th>
						<th class="px-4 py-3 font-medium">File name</th>
						<th class="px-4 py-3 font-medium">Date</th>
						<th class="px-4 py-3 font-medium">Status</th>
						<th class="px-4 py-3 font-medium">Amount</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100">
					{#each purchaseOrders as po}
						<tr
							class={rowClass}
							tabindex="0"
							role="link"
							onclick={() => go(`/projects/${data.project.id}/documents/purchase-orders/${po.id}`)}
							onkeydown={(e) =>
								rowKey(e, `/projects/${data.project.id}/documents/purchase-orders/${po.id}`)}
						>
							<td class="px-4 py-3 font-medium text-slate-800">{po.displayNumber}</td>
							<td class="max-w-xs truncate px-4 py-3 text-slate-700" title={po.displayFileName}>
								{po.displayFileName}
							</td>
							<td class="px-4 py-3 text-slate-600">{formatDate(po.date)}</td>
							<td class="px-4 py-3">
								<span class="rounded-full px-2 py-0.5 text-xs font-medium {statusBadgeClass(po.status)}">
									{po.status || 'draft'}
								</span>
							</td>
							<td class="px-4 py-3 font-medium text-slate-800">
								{money(po.amount, po.currency || 'SGD')}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	{#if data.documents.length > 0}
		<div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
			<div class="border-b border-slate-200 bg-slate-50 px-5 py-3">
				<h3 class="text-sm font-semibold text-slate-900">Other reference files</h3>
				<p class="mt-0.5 text-xs text-slate-500">
					Reference files <strong>not</strong> tied to a row in Contracts, Quotations, or Purchase Orders above (e.g. archive-only). Doc Hub quotations with a project appear under
					<strong>Quotations</strong> only �?they are no longer duplicated here.
				</p>
				<p class="mt-1 text-xs text-slate-500">Click a row to open the file in a new tab.</p>
			</div>
			<table class="min-w-full divide-y divide-slate-200 text-sm">
				<thead class="bg-white text-left text-slate-600">
					<tr>
						<th class="px-4 py-3 font-medium">Ref.</th>
						<th class="px-4 py-3 font-medium">File name</th>
						<th class="px-4 py-3 font-medium">Date</th>
						<th class="px-4 py-3 font-medium">Status</th>
						<th class="px-4 py-3 font-medium">Amount</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100">
					{#each data.documents as doc}
						<tr
							class={rowClass}
							tabindex="0"
							role="link"
							onclick={() => openFile(doc.fileKey)}
							onkeydown={(e) => otherDocKey(e, doc.fileKey)}
						>
							<td class="px-4 py-3 font-mono text-xs text-slate-700">{doc.id.length > 12 ? `${doc.id.slice(0, 10)}…` : doc.id}</td>
							<td class="max-w-xs truncate px-4 py-3 font-medium text-slate-800" title={doc.fileName}>
								{doc.fileName}
							</td>
							<td class="px-4 py-3 text-slate-600">{formatDate(doc.createdAt)}</td>
							<td class="px-4 py-3">
								<span class="rounded-full px-2 py-0.5 text-xs font-medium {statusBadgeClass(doc.ocrStatus)}">
									{doc.ocrStatus}
								</span>
								<span class="ml-1 text-[11px] text-slate-400">({docTypeLabel(doc.docType)})</span>
							</td>
							<td class="px-4 py-3 text-slate-500">-</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	{#if totalDocs === 0}
		<div class="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
			<p class="text-slate-500">No documents uploaded yet.</p>
			<p class="mt-2 text-sm text-slate-400">
				Upload contracts, quotations, purchase orders, or add expenses with receipts from this page.
			</p>
		</div>
	{/if}
</div>


