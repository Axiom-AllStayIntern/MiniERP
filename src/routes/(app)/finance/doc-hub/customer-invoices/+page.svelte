<script lang="ts">
	import PageShell from '$app-layer/components/PageShell.svelte';
	import { parseStoredInvoiceLineItems } from '$modules/finance/schemas/invoice-line-items';

	let { data } = $props();

	type InvoiceItem = (typeof data.invoices)[number];
	let selectedInvoice = $state<InvoiceItem | null>(null);

	const openDetail = (item: InvoiceItem) => {
		selectedInvoice = item;
	};
	const closeDetail = () => {
		selectedInvoice = null;
	};

	const lineRows = (raw: string | null) => parseStoredInvoiceLineItems(raw).lines;
</script>

<PageShell
	eyebrow="AR / Customer Invoices"
	title="Customer Invoices"
	description="Archive and review customer invoice records. Edit actions are handled in project module."
>
	{#snippet actions()}
		<a
			class="inline-flex items-center rounded-lg border border-[var(--sf-gold)] bg-[var(--sf-gold-soft)] px-4 py-2 text-sm font-medium text-[#7a5a07] hover:bg-[#f6e8b8]"
			href={data.filters.projectId
				? `/finance/doc-hub/customer-invoices/generate?projectId=${encodeURIComponent(data.filters.projectId)}`
				: '/finance/doc-hub/customer-invoices/generate'}
			data-sveltekit-noscroll
		>
			Generate invoice
		</a>
	{/snippet}
	<section class="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
		<form class="grid gap-3 lg:grid-cols-[2fr_1fr_1.3fr_auto_auto]" method="GET" data-sveltekit-noscroll>
			<input type="hidden" name="page" value="1" />
			<label class="space-y-1">
				<span class="text-xs font-medium text-slate-600">Project Search</span>
				<input class="w-full rounded border border-slate-300 px-3 py-2 text-sm" name="q" value={data.filters.q} placeholder="Project name / Project ID / Customer name" />
			</label>
			<label class="space-y-1">
				<span class="text-xs font-medium text-slate-600">Status</span>
				<select class="w-full rounded border border-slate-300 px-3 py-2 text-sm" name="status">
					<option value="">All status</option>
					<option value="active" selected={data.filters.status === 'active'}>active</option>
					<option value="on_hold" selected={data.filters.status === 'on_hold'}>on_hold</option>
					<option value="completed" selected={data.filters.status === 'completed'}>completed</option>
					<option value="archived" selected={data.filters.status === 'archived'}>archived</option>
				</select>
			</label>
			<label class="space-y-1">
				<span class="text-xs font-medium text-slate-600">Started On or After</span>
				<input class="w-full rounded border border-slate-300 px-3 py-2 text-sm" name="startedAfter" type="date" value={data.filters.startedAfter} />
			</label>
			<button class="h-10 rounded border border-[var(--sf-green)] bg-[var(--sf-green)] px-4 text-sm font-medium text-white hover:bg-[#2f5e2c] lg:mt-6" type="submit">Apply</button>
			<a class="inline-flex h-10 items-center justify-center rounded border border-[var(--sf-gold)] bg-[var(--sf-gold-soft)] px-4 text-center text-sm font-medium text-[#7a5a07] hover:bg-[#f6e8b8] lg:mt-6" href="/finance/doc-hub/customer-invoices" data-sveltekit-noscroll>
				Reset
			</a>
		</form>

		<div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
			<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Matched Projects</p>
			{#if data.projects.length === 0}
				<p class="mt-2 text-sm text-slate-500">No projects found. Try another keyword.</p>
			{:else}
				<div class="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white">
					<table class="min-w-full divide-y divide-slate-200 text-xs">
						<thead class="bg-slate-50 text-left text-slate-600">
							<tr>
								<th class="px-3 py-2">Project</th>
								<th class="px-3 py-2">Customer</th>
								<th class="px-3 py-2">Status</th>
								<th class="px-3 py-2">Start / End</th>
								<th class="px-3 py-2">Invoices</th>
								<th class="px-3 py-2">Action</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-100">
							{#each data.projects as project}
								<tr class={data.filters.projectId === project.id ? 'bg-[var(--sf-green-soft)]/50' : ''}>
									<td class="px-3 py-2">
										<p class="font-medium text-slate-800">{project.name}</p>
										<p class="text-slate-500">{project.id}</p>
									</td>
									<td class="px-3 py-2">{project.customerName ?? '--'}</td>
									<td class="px-3 py-2">{project.status}</td>
									<td class="px-3 py-2">{project.startDate ?? '--'} / {project.endDate ?? '--'}</td>
									<td class="px-3 py-2">{project.invoiceCount}</td>
									<td class="px-3 py-2">
										<a
											class={`rounded border px-2 py-1 ${
												data.filters.projectId === project.id
													? 'border-[var(--sf-green)] bg-[var(--sf-green-soft)] text-[var(--sf-green)]'
													: 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
											}`}
											href={`/finance/doc-hub/customer-invoices?q=${encodeURIComponent(data.filters.q)}&status=${encodeURIComponent(data.filters.status)}&startedAfter=${encodeURIComponent(data.filters.startedAfter)}&page=${data.filters.page}&projectId=${encodeURIComponent(project.id)}&listMode=selected&invoiceQ=${encodeURIComponent(data.filters.invoiceQ)}&invoiceField=${encodeURIComponent(data.filters.invoiceField)}`}
											data-sveltekit-noscroll
										>
											View Invoices
										</a>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				<div class="mt-3 flex items-center justify-between gap-3 text-xs text-slate-600">
					<p>Page {data.pagination.page} / {data.pagination.totalPages} - Total projects: {data.pagination.total}</p>
					<div class="flex items-center gap-2">
						{#if data.pagination.hasPrev}
							<a class="rounded border border-slate-300 bg-white px-2 py-1 hover:bg-slate-100" href={`/finance/doc-hub/customer-invoices?q=${encodeURIComponent(data.filters.q)}&status=${encodeURIComponent(data.filters.status)}&startedAfter=${encodeURIComponent(data.filters.startedAfter)}&page=${data.pagination.page - 1}&listMode=${encodeURIComponent(data.filters.listMode)}&invoiceQ=${encodeURIComponent(data.filters.invoiceQ)}&invoiceField=${encodeURIComponent(data.filters.invoiceField)}`} data-sveltekit-noscroll>
								Previous
							</a>
						{/if}
						{#if data.pagination.hasNext}
							<a class="rounded border border-slate-300 bg-white px-2 py-1 hover:bg-slate-100" href={`/finance/doc-hub/customer-invoices?q=${encodeURIComponent(data.filters.q)}&status=${encodeURIComponent(data.filters.status)}&startedAfter=${encodeURIComponent(data.filters.startedAfter)}&page=${data.pagination.page + 1}&listMode=${encodeURIComponent(data.filters.listMode)}&invoiceQ=${encodeURIComponent(data.filters.invoiceQ)}&invoiceField=${encodeURIComponent(data.filters.invoiceField)}`} data-sveltekit-noscroll>
								Next
							</a>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	</section>

	<section class="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
		<form class="grid gap-3 md:grid-cols-[1fr_180px_180px_auto]" method="GET" data-sveltekit-noscroll>
			<input type="hidden" name="q" value={data.filters.q} />
			<input type="hidden" name="status" value={data.filters.status} />
			<input type="hidden" name="startedAfter" value={data.filters.startedAfter} />
			<input type="hidden" name="projectId" value={data.filters.projectId} />
			<input type="hidden" name="page" value={data.filters.page} />
			<input class="rounded border border-slate-300 px-3 py-2 text-sm" name="invoiceQ" value={data.filters.invoiceQ} placeholder="Filter invoice list: ID / no / total / date / status / customer" />
			<select class="rounded border border-slate-300 px-3 py-2 text-sm" name="invoiceField">
				<option value="all" selected={data.filters.invoiceField === 'all'}>All Fields</option>
				<option value="id" selected={data.filters.invoiceField === 'id'}>Invoice ID</option>
				<option value="invoiceNo" selected={data.filters.invoiceField === 'invoiceNo'}>Invoice No</option>
				<option value="total" selected={data.filters.invoiceField === 'total'}>Total</option>
				<option value="date" selected={data.filters.invoiceField === 'date'}>Date</option>
				<option value="status" selected={data.filters.invoiceField === 'status'}>Status</option>
				<option value="customer" selected={data.filters.invoiceField === 'customer'}>Customer</option>
			</select>
			<select class="rounded border border-slate-300 px-3 py-2 text-sm" name="listMode">
				<option value="all" selected={data.filters.listMode === 'all'}>All Invoices</option>
				<option value="selected" selected={data.filters.listMode === 'selected'}>Selected Project</option>
			</select>
			<button class="rounded border border-[var(--sf-green)] bg-[var(--sf-green)] px-4 py-2 text-sm font-medium text-white hover:bg-[#2f5e2c]" type="submit">Filter List</button>
		</form>
	</section>

	<div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
		<table class="min-w-full divide-y divide-slate-200 text-sm">
			<thead class="bg-slate-50 text-left text-slate-600">
				<tr>
					<th class="px-4 py-3">Invoice</th>
					<th class="px-4 py-3">Project / Customer</th>
					<th class="px-4 py-3">Date</th>
					<th class="px-4 py-3">Subtotal</th>
					<th class="px-4 py-3">Total</th>
					<th class="px-4 py-3">Status</th>
					<th class="px-4 py-3">Actions</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#if data.filters.listMode === 'selected' && !data.filters.projectId}
					<tr><td class="px-4 py-6 text-slate-500" colspan="7">Select a project to view customer invoices.</td></tr>
				{:else if data.invoices.length === 0}
					<tr><td class="px-4 py-6 text-slate-500" colspan="7">No customer invoices found.</td></tr>
				{:else}
					{#each data.invoices as item}
						<tr class="align-top">
							<td class="px-4 py-3">
								<p class="font-medium text-slate-800">{item.invoiceNo}</p>
								<p class="text-xs text-slate-500">{item.currency}</p>
							</td>
							<td class="px-4 py-3">
								<p>{item.projectName}</p>
								<p class="text-xs text-slate-500">{item.customerName ?? item.customerId}</p>
							</td>
							<td class="px-4 py-3">{item.date} / {item.dueDate ?? '--'}</td>
							<td class="px-4 py-3">{item.subtotal}</td>
							<td class="px-4 py-3">{item.total}</td>
							<td class="px-4 py-3">{item.status}</td>
							<td class="px-4 py-3">
								<div class="flex flex-wrap gap-2">
									<button type="button" class="rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-100" onclick={() => openDetail(item)}>
										View Detail
									</button>
									{#if item.status === 'draft'}
										<a
											class="rounded border border-[var(--sf-gold)] bg-[var(--sf-gold-soft)] px-2 py-1.5 text-xs text-[#7a5a07] hover:bg-[#f6e8b8]"
											href={`/finance/doc-hub/customer-invoices/generate?invoiceId=${encodeURIComponent(item.id)}`}
											data-sveltekit-noscroll
										>
											Re-edit Draft
										</a>
									{/if}
									<a class="rounded border border-[var(--sf-green)] bg-[var(--sf-green-soft)] px-2 py-1.5 text-xs text-[var(--sf-green)] hover:bg-[#dcefd8]" href={`/projects/${item.projectId}`} data-sveltekit-noscroll>
										Go to Project
									</a>
								</div>
							</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>

	{#if selectedInvoice}
		<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
			<button type="button" class="absolute inset-0 bg-slate-900/40" aria-label="Close detail dialog" onclick={closeDetail}></button>
			<div class="relative max-h-[85vh] w-full max-w-4xl overflow-auto rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
				<div class="flex items-start justify-between gap-3">
					<div>
						<p class="text-xs font-semibold uppercase tracking-wide text-[var(--sf-green)]">Customer Invoice Detail</p>
						<p class="mt-1 text-lg font-semibold text-slate-900">{selectedInvoice.invoiceNo}</p>
						<p class="text-xs text-slate-500">{selectedInvoice.projectName}</p>
					</div>
					<button type="button" class="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100" onclick={closeDetail}>Close</button>
				</div>

				<div class="mt-4 grid gap-3 md:grid-cols-2">
					<div class="rounded border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">Record ID</p><p class="mt-1 break-all text-sm text-slate-800">{selectedInvoice.id}</p></div>
					<div class="rounded border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">Customer</p><p class="mt-1 text-sm text-slate-800">{selectedInvoice.customerName ?? selectedInvoice.customerId}</p></div>
					<div class="rounded border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">Date / Due</p><p class="mt-1 text-sm text-slate-800">{selectedInvoice.date} / {selectedInvoice.dueDate ?? '--'}</p></div>
					<div class="rounded border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">GST Type</p><p class="mt-1 text-sm text-slate-800">{selectedInvoice.gstType}</p></div>
					<div class="rounded border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">Subtotal / GST / Total</p><p class="mt-1 text-sm text-slate-800">{selectedInvoice.subtotal} / {selectedInvoice.gstAmount} / {selectedInvoice.total}</p></div>
					<div class="rounded border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">Status</p><p class="mt-1 text-sm text-slate-800">{selectedInvoice.status}</p></div>
				</div>

				<div class="mt-3 rounded border border-slate-200 bg-slate-50 p-3">
					<p class="text-xs text-slate-500">Line Items</p>
					{#if lineRows(selectedInvoice.lineItems).length === 0}
						<p class="mt-1 text-sm text-slate-500">No line items.</p>
					{:else}
						<div class="mt-2 overflow-x-auto">
							<table class="min-w-full divide-y divide-slate-200 text-xs">
								<thead class="bg-white text-left text-slate-600">
									<tr>
										<th class="px-2 py-1">Description</th>
										<th class="px-2 py-1">Qty</th>
										<th class="px-2 py-1">Price</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-slate-100">
									{#each lineRows(selectedInvoice.lineItems) as row}
										<tr>
											<td class="px-2 py-1">{row.desc ?? '--'}</td>
											<td class="px-2 py-1">{row.qty ?? '--'}</td>
											<td class="px-2 py-1">{row.price ?? '--'}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</div>

				<div class="mt-4 flex justify-end">
					<a class="rounded bg-[var(--sf-green)] px-3 py-2 text-sm text-white hover:bg-[#2f5e2c]" href={`/projects/${selectedInvoice.projectId}`} data-sveltekit-noscroll>
						Go to Project to Edit
					</a>
				</div>
			</div>
		</div>
	{/if}
</PageShell>


