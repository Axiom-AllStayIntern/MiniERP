<script lang="ts">
	import PageShell from '$lib/components/PageShell.svelte';
	let { data, form } = $props();
</script>

<PageShell
	eyebrow="AR / Supplier Invoices"
	title="Supplier Invoices"
	description="Manage incoming supplier invoices with status tracking and editable financial fields."
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
			{#each ['pending_review', 'processing', 'confirmed', 'failed'] as item}
				<option value={item} selected={data.filters.status === item}>{item}</option>
			{/each}
		</select>
		<button class="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" type="submit">
			Apply Filter
		</button>
		<a class="rounded border border-slate-300 px-3 py-2 text-center text-sm text-slate-700 hover:bg-slate-50" href="/ar/supplier-invoices">
			Reset
		</a>
	</form>

	<form
		class="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-6"
		method="POST"
		action="?/upload"
		enctype="multipart/form-data"
	>
		<select class="rounded border border-slate-300 px-3 py-2 text-sm" name="projectId" required>
			<option value="" disabled selected>Select project</option>
			{#each data.projects as project}
				<option value={project.id}>{project.name}</option>
			{/each}
		</select>
		<input
			class="rounded border border-slate-300 px-3 py-2 text-sm md:col-span-3"
			type="file"
			name="file"
			accept=".pdf,.png,.jpg,.jpeg,.webp"
			required
		/>
		<label class="flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm text-slate-700">
			<input type="checkbox" name="triggerOcr" value="true" checked />
			Queue OCR after upload
		</label>
		<button class="rounded bg-[var(--sf-green)] px-3 py-2 text-sm text-white hover:bg-[#2f5e2c] md:col-span-6" type="submit">
			Upload Invoice File
		</button>
	</form>

	<div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
		<table class="min-w-full divide-y divide-slate-200 text-sm">
			<thead class="bg-slate-50 text-left text-slate-600">
				<tr>
					<th class="px-4 py-3">Project</th>
					<th class="px-4 py-3">Supplier</th>
					<th class="px-4 py-3">Invoice Date</th>
					<th class="px-4 py-3">Amount</th>
					<th class="px-4 py-3">GST</th>
					<th class="px-4 py-3">Status</th>
					<th class="px-4 py-3">Confidence</th>
					<th class="px-4 py-3">Actions</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#if data.invoices.length === 0}
					<tr><td class="px-4 py-6 text-slate-500" colspan="8">No supplier invoices yet.</td></tr>
				{:else}
					{#each data.invoices as item}
						<tr class="align-top">
							<td class="px-4 py-3">
								<p class="font-medium text-slate-800">{item.projectName}</p>
								<p class="text-xs text-slate-500">{item.projectId}</p>
							</td>
							<td class="px-4 py-3">{item.supplierName ?? '--'}</td>
							<td class="px-4 py-3">{item.invoiceDate ?? '--'}</td>
							<td class="px-4 py-3">{item.amount} {item.currency}</td>
							<td class="px-4 py-3">{item.gstAmount}</td>
							<td class="px-4 py-3">{item.status}</td>
							<td class="px-4 py-3">{item.ocrConfidence ? `${(item.ocrConfidence * 100).toFixed(1)}%` : '--'}</td>
							<td class="px-4 py-3">
								<details>
									<summary class="cursor-pointer text-[var(--sf-green)] hover:underline">Review / Actions</summary>
									<div class="mt-3 space-y-2 rounded border border-slate-200 bg-slate-50 p-3">
										{#if item.rawParsed}
											<pre class="max-h-52 overflow-auto rounded border border-slate-200 bg-white p-2 text-xs text-slate-600">{JSON.stringify(item.rawParsed, null, 2)}</pre>
										{/if}

										<form class="grid gap-2 md:grid-cols-2" method="POST" action="?/confirm">
											<input type="hidden" name="invoiceId" value={item.id} />
											<input class="rounded border border-slate-300 px-2 py-1.5 text-xs md:col-span-2" name="supplierName" value={item.supplierName ?? ''} />
											<input class="rounded border border-slate-300 px-2 py-1.5 text-xs" name="invoiceDate" type="date" value={item.invoiceDate ?? ''} required />
											<input class="rounded border border-slate-300 px-2 py-1.5 text-xs" name="dueDate" type="date" value={item.dueDate ?? ''} />
											<input class="rounded border border-slate-300 px-2 py-1.5 text-xs" name="poNumber" value={item.poNumber ?? ''} />
											<input class="rounded border border-slate-300 px-2 py-1.5 text-xs" name="currency" value={item.currency} />
											<input class="rounded border border-slate-300 px-2 py-1.5 text-xs" name="amount" type="number" step="0.01" value={item.amount} />
											<input class="rounded border border-slate-300 px-2 py-1.5 text-xs" name="gstAmount" type="number" step="0.01" value={item.gstAmount} />
											<select class="rounded border border-slate-300 px-2 py-1.5 text-xs" name="status" value={item.status}>
												<option value="pending_review">pending_review</option>
												<option value="processing">processing</option>
												<option value="confirmed">confirmed</option>
												<option value="failed">failed</option>
											</select>
											<button class="rounded bg-[var(--sf-green)] px-2 py-1.5 text-xs text-white hover:bg-[#2f5e2c] md:col-span-2" type="submit">
												Confirm / Save
											</button>
										</form>
										<div class="flex flex-wrap gap-2">
											<form method="POST" action="?/retryQueue">
												<input type="hidden" name="invoiceId" value={item.id} />
												<button class="rounded border border-indigo-300 bg-[var(--sf-green-soft)] px-2 py-1.5 text-xs text-[var(--sf-green)] hover:bg-indigo-100" type="submit">
													Queue OCR
												</button>
											</form>
											<form method="POST" action="?/processNow">
												<input type="hidden" name="invoiceId" value={item.id} />
												<button class="rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-100" type="submit">
													Process Now (Local)
												</button>
											</form>
										</div>
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
