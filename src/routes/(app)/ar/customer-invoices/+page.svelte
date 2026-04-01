<script lang="ts">
	import PageShell from '$lib/components/PageShell.svelte';
	let { data, form } = $props();
</script>

<PageShell
	eyebrow="AR / Customer Invoices"
	title="Customer Invoices"
	description="Manage outgoing customer invoices with GST type, amount, status, and due date."
>
	{#if form?.message}
		<p class="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{form.message}</p>
	{/if}

	<form class="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-5" method="GET">
		<select class="rounded border border-slate-300 px-3 py-2 text-sm" name="projectId">
			<option value="">All projects</option>
			{#each data.projects as project}
				<option value={project.id} selected={data.filters.projectId === project.id}>{project.name}</option>
			{/each}
		</select>
		<select class="rounded border border-slate-300 px-3 py-2 text-sm" name="status">
			<option value="">All statuses</option>
			{#each ['draft', 'issued', 'paid', 'void'] as item}
				<option value={item} selected={data.filters.status === item}>{item}</option>
			{/each}
		</select>
		<button class="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" type="submit">
			Apply Filter
		</button>
		<a class="rounded border border-slate-300 px-3 py-2 text-center text-sm text-slate-700 hover:bg-slate-50" href="/ar/customer-invoices">
			Reset
		</a>
	</form>

	<form class="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-7" method="POST" action="?/create">
		<select class="rounded border border-slate-300 px-3 py-2 text-sm" name="projectId" required>
			<option value="" disabled selected>Select project</option>
			{#each data.projects as project}
				<option value={project.id}>{project.name}</option>
			{/each}
		</select>
		<select class="rounded border border-slate-300 px-3 py-2 text-sm" name="customerId" required>
			<option value="" disabled selected>Select customer</option>
			{#each data.customers as customer}
				<option value={customer.id}>{customer.name}</option>
			{/each}
		</select>
		<input class="rounded border border-slate-300 px-3 py-2 text-sm" name="date" type="date" required />
		<input class="rounded border border-slate-300 px-3 py-2 text-sm" name="dueDate" type="date" />
		<input class="rounded border border-slate-300 px-3 py-2 text-sm" name="subtotal" type="number" step="0.01" placeholder="Subtotal" />
		<select class="rounded border border-slate-300 px-3 py-2 text-sm" name="gstType">
			<option value="standard">standard</option>
			<option value="zero">zero</option>
			<option value="exempt">exempt</option>
		</select>
		<select class="rounded border border-slate-300 px-3 py-2 text-sm" name="status">
			<option value="draft">draft</option>
			<option value="issued">issued</option>
			<option value="paid">paid</option>
			<option value="void">void</option>
		</select>
		<input class="rounded border border-slate-300 px-3 py-2 text-sm md:col-span-2" name="currency" value="SGD" />
		<button class="rounded bg-[var(--sf-green)] px-3 py-2 text-sm text-white hover:bg-[#2f5e2c] md:col-span-5" type="submit">
			Add Invoice
		</button>
	</form>

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
				{#if data.invoices.length === 0}
					<tr><td class="px-4 py-6 text-slate-500" colspan="7">No customer invoices yet.</td></tr>
				{:else}
					{#each data.invoices as item}
						<tr class="align-top">
							<td class="px-4 py-3">
								<p class="font-medium text-slate-800">{item.invoiceNo}</p>
								<p class="text-xs text-slate-500">{item.currency}</p>
							</td>
							<td class="px-4 py-3">
								<p>{item.projectName}</p>
								<p class="text-xs text-slate-500">{item.customerName}</p>
							</td>
							<td class="px-4 py-3">{item.date} / {item.dueDate ?? '--'}</td>
							<td class="px-4 py-3">{item.subtotal}</td>
							<td class="px-4 py-3">{item.total}</td>
							<td class="px-4 py-3">{item.status}</td>
							<td class="px-4 py-3">
								<details>
									<summary class="cursor-pointer text-[var(--sf-green)] hover:underline">Edit</summary>
									<div class="mt-3 space-y-2 rounded border border-slate-200 bg-slate-50 p-3">
										<form class="grid gap-2 md:grid-cols-2" method="POST" action="?/update">
											<input type="hidden" name="invoiceId" value={item.id} />
											<input class="rounded border border-slate-300 px-2 py-1.5 text-xs md:col-span-2" name="dueDate" type="date" value={item.dueDate ?? ''} />
											<input class="rounded border border-slate-300 px-2 py-1.5 text-xs" name="subtotal" type="number" step="0.01" value={item.subtotal} />
											<input class="rounded border border-slate-300 px-2 py-1.5 text-xs" name="currency" value={item.currency} />
											<select class="rounded border border-slate-300 px-2 py-1.5 text-xs" name="gstType" value={item.gstType}>
												<option value="standard">standard</option>
												<option value="zero">zero</option>
												<option value="exempt">exempt</option>
											</select>
											<select class="rounded border border-slate-300 px-2 py-1.5 text-xs" name="status" value={item.status}>
												<option value="draft">draft</option>
												<option value="issued">issued</option>
												<option value="paid">paid</option>
												<option value="void">void</option>
											</select>
											<button class="rounded bg-[var(--sf-green)] px-2 py-1.5 text-xs text-white hover:bg-[#2f5e2c] md:col-span-2" type="submit">
												Save Changes
											</button>
										</form>
										<form method="POST" action="?/delete">
											<input type="hidden" name="invoiceId" value={item.id} />
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
