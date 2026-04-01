<script lang="ts">
	import PageShell from '$lib/components/PageShell.svelte';
	let { data, form } = $props();
</script>

<PageShell
	eyebrow="AR / Purchase Orders"
	title="Purchase Order Management"
	description="Manage purchase orders across projects with supplier, amount, and date updates."
>
	{#if form?.message}
		<p class="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{form.message}</p>
	{/if}

	<form class="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4" method="GET">
		<select class="rounded border border-slate-300 px-3 py-2 text-sm" name="projectId">
			<option value="">All projects</option>
			{#each data.projects as project}
				<option value={project.id} selected={data.filters.projectId === project.id}>{project.name}</option>
			{/each}
		</select>
		<button class="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" type="submit">
			Apply Filter
		</button>
		<a class="rounded border border-slate-300 px-3 py-2 text-center text-sm text-slate-700 hover:bg-slate-50" href="/ar/purchase-orders">
			Reset
		</a>
	</form>

	<form class="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-6" method="POST" action="?/create">
		<select class="rounded border border-slate-300 px-3 py-2 text-sm" name="projectId" required>
			<option value="" disabled selected>Select project</option>
			{#each data.projects as project}
				<option value={project.id}>{project.name}</option>
			{/each}
		</select>
		<input class="rounded border border-slate-300 px-3 py-2 text-sm" name="poNumber" placeholder="PO Number (optional auto-generate)" />
		<input class="rounded border border-slate-300 px-3 py-2 text-sm" name="supplierName" placeholder="Supplier Name" required />
		<input class="rounded border border-slate-300 px-3 py-2 text-sm" name="amount" type="number" step="0.01" placeholder="Amount" />
		<input class="rounded border border-slate-300 px-3 py-2 text-sm" name="currency" value="SGD" />
		<input class="rounded border border-slate-300 px-3 py-2 text-sm" name="date" type="date" />
		<button class="rounded bg-[var(--sf-green)] px-3 py-2 text-sm text-white hover:bg-[#2f5e2c] md:col-span-6" type="submit">
			Add Purchase Order
		</button>
	</form>

	<div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
		<table class="min-w-full divide-y divide-slate-200 text-sm">
			<thead class="bg-slate-50 text-left text-slate-600">
				<tr>
					<th class="px-4 py-3">Project</th>
					<th class="px-4 py-3">PO Number</th>
					<th class="px-4 py-3">Supplier</th>
					<th class="px-4 py-3">Amount</th>
					<th class="px-4 py-3">Date</th>
					<th class="px-4 py-3">Actions</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#if data.purchaseOrders.length === 0}
					<tr><td class="px-4 py-6 text-slate-500" colspan="6">No purchase order records yet.</td></tr>
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
								<details>
									<summary class="cursor-pointer text-[var(--sf-green)] hover:underline">Edit</summary>
									<div class="mt-3 space-y-2 rounded border border-slate-200 bg-slate-50 p-3">
										<form class="grid gap-2 md:grid-cols-2" method="POST" action="?/update">
											<input type="hidden" name="purchaseOrderId" value={item.id} />
											<input class="rounded border border-slate-300 px-2 py-1.5 text-xs md:col-span-2" name="poNumber" value={item.poNumber} required />
											<input class="rounded border border-slate-300 px-2 py-1.5 text-xs md:col-span-2" name="supplierName" value={item.supplierName ?? ''} required />
											<input class="rounded border border-slate-300 px-2 py-1.5 text-xs" name="amount" type="number" step="0.01" value={item.amount ?? 0} />
											<input class="rounded border border-slate-300 px-2 py-1.5 text-xs" name="currency" value={item.currency ?? 'SGD'} />
											<input class="rounded border border-slate-300 px-2 py-1.5 text-xs md:col-span-2" name="date" type="date" value={item.date ?? ''} />
											<button class="rounded bg-[var(--sf-green)] px-2 py-1.5 text-xs text-white hover:bg-[#2f5e2c] md:col-span-2" type="submit">
												Save Changes
											</button>
										</form>
										<form method="POST" action="?/delete">
											<input type="hidden" name="purchaseOrderId" value={item.id} />
											<button class="rounded border border-rose-300 bg-rose-50 px-2 py-1.5 text-xs text-rose-700 hover:bg-rose-100" type="submit">
												Delete Record
											</button>
										</form>
									</div>
								</details>
							</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>
</PageShell>
