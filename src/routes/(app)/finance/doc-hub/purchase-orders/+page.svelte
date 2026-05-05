<script lang="ts">
	import PageShell from '$app-layer/components/PageShell.svelte';

	let { data } = $props();

	type PoItem = (typeof data.purchaseOrders)[number];
	let selectedPo = $state<PoItem | null>(null);

	const openDetail = (item: PoItem) => {
		selectedPo = item;
	};
	const closeDetail = () => {
		selectedPo = null;
	};
</script>

<PageShell
	eyebrow="AR / Purchase Orders"
	title="Purchase Order Management"
	description="Archive and review purchase order records. Edit actions are handled in project module."
>
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
			<button class="h-10 rounded border border-[var(--sf-green)] bg-[var(--sf-green)] px-4 text-sm font-medium text-white hover:bg-[#2f5e2c] lg:mt-6" type="submit">
				Apply
			</button>
			<a class="inline-flex h-10 items-center justify-center rounded border border-[var(--sf-gold)] bg-[var(--sf-gold-soft)] px-4 text-center text-sm font-medium text-[#7a5a07] hover:bg-[#f6e8b8] lg:mt-6" href="/finance/doc-hub/purchase-orders" data-sveltekit-noscroll>
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
								<th class="px-3 py-2">POs</th>
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
									<td class="px-3 py-2">{project.poCount}</td>
									<td class="px-3 py-2">
										<a
											class={`rounded border px-2 py-1 ${
												data.filters.projectId === project.id
													? 'border-[var(--sf-green)] bg-[var(--sf-green-soft)] text-[var(--sf-green)]'
													: 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
											}`}
											href={`/finance/doc-hub/purchase-orders?q=${encodeURIComponent(data.filters.q)}&status=${encodeURIComponent(data.filters.status)}&startedAfter=${encodeURIComponent(data.filters.startedAfter)}&page=${data.filters.page}&projectId=${encodeURIComponent(project.id)}&listMode=selected&poQ=${encodeURIComponent(data.filters.poQ)}&poField=${encodeURIComponent(data.filters.poField)}`}
											data-sveltekit-noscroll
										>
											View POs
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
							<a class="rounded border border-slate-300 bg-white px-2 py-1 hover:bg-slate-100" href={`/finance/doc-hub/purchase-orders?q=${encodeURIComponent(data.filters.q)}&status=${encodeURIComponent(data.filters.status)}&startedAfter=${encodeURIComponent(data.filters.startedAfter)}&page=${data.pagination.page - 1}&listMode=${encodeURIComponent(data.filters.listMode)}&poQ=${encodeURIComponent(data.filters.poQ)}&poField=${encodeURIComponent(data.filters.poField)}`} data-sveltekit-noscroll>
								Previous
							</a>
						{/if}
						{#if data.pagination.hasNext}
							<a class="rounded border border-slate-300 bg-white px-2 py-1 hover:bg-slate-100" href={`/finance/doc-hub/purchase-orders?q=${encodeURIComponent(data.filters.q)}&status=${encodeURIComponent(data.filters.status)}&startedAfter=${encodeURIComponent(data.filters.startedAfter)}&page=${data.pagination.page + 1}&listMode=${encodeURIComponent(data.filters.listMode)}&poQ=${encodeURIComponent(data.filters.poQ)}&poField=${encodeURIComponent(data.filters.poField)}`} data-sveltekit-noscroll>
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
			<input class="rounded border border-slate-300 px-3 py-2 text-sm" name="poQ" value={data.filters.poQ} placeholder="Filter PO list: ID / number / supplier / amount / date / notes" />
			<select class="rounded border border-slate-300 px-3 py-2 text-sm" name="poField">
				<option value="all" selected={data.filters.poField === 'all'}>All Fields</option>
				<option value="id" selected={data.filters.poField === 'id'}>PO ID</option>
				<option value="poNumber" selected={data.filters.poField === 'poNumber'}>PO Number</option>
				<option value="supplier" selected={data.filters.poField === 'supplier'}>Supplier</option>
				<option value="amount" selected={data.filters.poField === 'amount'}>Amount</option>
				<option value="date" selected={data.filters.poField === 'date'}>Date</option>
				<option value="notes" selected={data.filters.poField === 'notes'}>Notes</option>
			</select>
			<select class="rounded border border-slate-300 px-3 py-2 text-sm" name="listMode">
				<option value="all" selected={data.filters.listMode === 'all'}>All POs</option>
				<option value="selected" selected={data.filters.listMode === 'selected'}>Selected Project</option>
			</select>
			<button class="rounded border border-[var(--sf-green)] bg-[var(--sf-green)] px-4 py-2 text-sm font-medium text-white hover:bg-[#2f5e2c]" type="submit">Filter List</button>
		</form>
	</section>

	<div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
		<table class="min-w-full divide-y divide-slate-200 text-sm">
			<thead class="bg-slate-50 text-left text-slate-600">
				<tr>
					<th class="px-4 py-3">Project</th>
					<th class="px-4 py-3">PO Number</th>
					<th class="px-4 py-3">Supplier</th>
					<th class="px-4 py-3">Amount</th>
					<th class="px-4 py-3">Date</th>
					<th class="px-4 py-3">Document</th>
					<th class="px-4 py-3">Parse Status</th>
					<th class="px-4 py-3">Actions</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#if data.filters.listMode === 'selected' && !data.filters.projectId}
					<tr><td class="px-4 py-6 text-slate-500" colspan="8">Select a project to view purchase orders.</td></tr>
				{:else if data.purchaseOrders.length === 0}
					<tr><td class="px-4 py-6 text-slate-500" colspan="8">No purchase order records found.</td></tr>
				{:else}
					{#each data.purchaseOrders as item}
						<tr class="align-top">
							<td class="px-4 py-3">
								<p class="font-medium text-slate-800">{item.projectName}</p>
								<p class="text-xs text-slate-500">{item.projectId}</p>
							</td>
							<td class="px-4 py-3">{item.poNumber}</td>
							<td class="px-4 py-3">{item.supplierName ?? '--'}</td>
							<td class="px-4 py-3">{item.amount ?? 0} {item.currency ?? 'SGD'}</td>
							<td class="px-4 py-3">{item.date ?? '--'}</td>
							<td class="px-4 py-3">
								{#if item.fileViewUrl}
									<a class="text-[var(--sf-green)] hover:underline" href={item.fileViewUrl} target="_blank" rel="noreferrer">
										{item.docMeta?.upload?.fileName ?? 'Open file'}
									</a>
								{:else}
									<span class="text-slate-500">No file</span>
								{/if}
							</td>
							<td class="px-4 py-3">{item.docMeta?.parseStatus ?? 'not_parsed'}</td>
							<td class="px-4 py-3">
								<div class="flex flex-wrap gap-2">
									<button type="button" class="rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-100" onclick={() => openDetail(item)}>
										View Detail
									</button>
									<a
										class="rounded border border-[var(--sf-green)] bg-[var(--sf-green-soft)] px-2 py-1.5 text-xs text-[var(--sf-green)] hover:bg-[#dcefd8]"
										href={item.projectId ? `/projects/${item.projectId}/documents/purchase-orders/${item.id}` : '/projects'}
										data-sveltekit-noscroll
									>
										{item.projectId ? 'Open in project' : 'Open Projects'}
									</a>
								</div>
							</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>

	{#if selectedPo}
		<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
			<button type="button" class="absolute inset-0 bg-slate-900/40" aria-label="Close detail dialog" onclick={closeDetail}></button>
			<div class="relative max-h-[85vh] w-full max-w-3xl overflow-auto rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
				<div class="flex items-start justify-between gap-3">
					<div>
						<p class="text-xs font-semibold uppercase tracking-wide text-[var(--sf-green)]">Purchase Order Detail</p>
						<p class="mt-1 text-lg font-semibold text-slate-900">{selectedPo.projectName}</p>
						<p class="text-xs text-slate-500">{selectedPo.projectId}</p>
					</div>
					<button type="button" class="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100" onclick={closeDetail}>Close</button>
				</div>

				<div class="mt-4 grid gap-3 md:grid-cols-2">
					<div class="rounded border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">Record ID</p><p class="mt-1 break-all text-sm text-slate-800">{selectedPo.id}</p></div>
					<div class="rounded border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">PO Number</p><p class="mt-1 text-sm text-slate-800">{selectedPo.poNumber}</p></div>
					<div class="rounded border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">Supplier</p><p class="mt-1 text-sm text-slate-800">{selectedPo.supplierName ?? '--'}</p></div>
					<div class="rounded border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">Amount / Currency</p><p class="mt-1 text-sm text-slate-800">{selectedPo.amount ?? 0} {selectedPo.currency ?? 'SGD'}</p></div>
					<div class="rounded border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">Date</p><p class="mt-1 text-sm text-slate-800">{selectedPo.date ?? '--'}</p></div>
					<div class="rounded border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">Parse Status</p><p class="mt-1 text-sm text-slate-800">{selectedPo.docMeta?.parseStatus ?? 'not_parsed'}</p></div>
				</div>

				<div class="mt-3 rounded border border-slate-200 bg-slate-50 p-3">
					<p class="text-xs text-slate-500">Document</p>
					{#if selectedPo.fileViewUrl}
						<a class="mt-1 inline-block break-all text-sm text-[var(--sf-green)] hover:underline" href={selectedPo.fileViewUrl} target="_blank" rel="noreferrer">
							{selectedPo.docMeta?.upload?.fileName ?? selectedPo.fileUrl}
						</a>
					{:else}
						<p class="mt-1 text-sm text-slate-500">No uploaded file.</p>
					{/if}
				</div>

				<div class="mt-3 rounded border border-slate-200 bg-slate-50 p-3">
					<p class="text-xs text-slate-500">Notes</p>
					<p class="mt-1 whitespace-pre-wrap text-sm text-slate-800">{selectedPo.docMeta?.notes || '--'}</p>
				</div>

				<div class="mt-4 flex justify-end">
					{#if selectedPo.projectId}
						<a class="rounded bg-[var(--sf-green)] px-3 py-2 text-sm text-white hover:bg-[#2f5e2c]" href={`/projects/${selectedPo.projectId}/documents/purchase-orders/${selectedPo.id}`} data-sveltekit-noscroll>
							Open in project workspace
						</a>
					{:else}
						<a class="rounded bg-[var(--sf-green)] px-3 py-2 text-sm text-white hover:bg-[#2f5e2c]" href="/projects" data-sveltekit-noscroll>
							Open Projects
						</a>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</PageShell>


