<script lang="ts">
	import PageShell from '$lib/components/PageShell.svelte';
	let { data, form } = $props();

	const parseNotes = (raw: string | null) => {
		if (!raw) return '';
		try {
			const parsed = JSON.parse(raw) as { notes?: string };
			return parsed.notes ?? '';
		} catch {
			return '';
		}
	};
</script>

<PageShell
	eyebrow="AR / Quotations"
	title="Quotation Management"
	description="Manage quotation records across projects with editable source, amount, and date."
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
		<a class="rounded border border-slate-300 px-3 py-2 text-center text-sm text-slate-700 hover:bg-slate-50" href="/ar/quotations">
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
		<input class="rounded border border-slate-300 px-3 py-2 text-sm" name="amount" type="number" step="0.01" placeholder="Amount" />
		<input class="rounded border border-slate-300 px-3 py-2 text-sm" name="currency" value="SGD" />
		<input class="rounded border border-slate-300 px-3 py-2 text-sm" name="sourceType" value="manual" placeholder="Source Type" />
		<input class="rounded border border-slate-300 px-3 py-2 text-sm" name="date" type="date" />
		<input class="rounded border border-slate-300 px-3 py-2 text-sm md:col-span-4" name="notes" placeholder="Notes (optional)" />
		<button class="rounded bg-[var(--sf-green)] px-3 py-2 text-sm text-white hover:bg-[#2f5e2c] md:col-span-2" type="submit">
			Add Quotation Record
		</button>
	</form>

	<div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
		<table class="min-w-full divide-y divide-slate-200 text-sm">
			<thead class="bg-slate-50 text-left text-slate-600">
				<tr>
					<th class="px-4 py-3">Project</th>
					<th class="px-4 py-3">Date</th>
					<th class="px-4 py-3">Amount</th>
					<th class="px-4 py-3">Source</th>
					<th class="px-4 py-3">Actions</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#if data.quotations.length === 0}
					<tr><td class="px-4 py-6 text-slate-500" colspan="5">No quotation records yet.</td></tr>
				{:else}
					{#each data.quotations as item}
						<tr class="align-top">
							<td class="px-4 py-3">
								<p class="font-medium text-slate-800">{item.projectName}</p>
								<p class="text-xs text-slate-500">{item.projectId}</p>
							</td>
							<td class="px-4 py-3">{item.date ?? '--'}</td>
							<td class="px-4 py-3">{item.amount ?? 0} {item.currency ?? 'SGD'}</td>
							<td class="px-4 py-3">{item.sourceType ?? 'manual'}</td>
							<td class="px-4 py-3">
								<details>
									<summary class="cursor-pointer text-[var(--sf-green)] hover:underline">Edit</summary>
									<div class="mt-3 space-y-2 rounded border border-slate-200 bg-slate-50 p-3">
										<form class="grid gap-2 md:grid-cols-2" method="POST" action="?/update">
											<input type="hidden" name="quotationId" value={item.id} />
											<input class="rounded border border-slate-300 px-2 py-1.5 text-xs" name="amount" type="number" step="0.01" value={item.amount ?? 0} />
											<input class="rounded border border-slate-300 px-2 py-1.5 text-xs" name="currency" value={item.currency ?? 'SGD'} />
											<input class="rounded border border-slate-300 px-2 py-1.5 text-xs" name="sourceType" value={item.sourceType ?? 'manual'} />
											<input class="rounded border border-slate-300 px-2 py-1.5 text-xs" name="date" type="date" value={item.date ?? ''} />
											<input class="rounded border border-slate-300 px-2 py-1.5 text-xs md:col-span-2" name="notes" value={parseNotes(item.metadata)} placeholder="Notes" />
											<button class="rounded bg-[var(--sf-green)] px-2 py-1.5 text-xs text-white hover:bg-[#2f5e2c] md:col-span-2" type="submit">
												Save Changes
											</button>
										</form>
										<form method="POST" action="?/delete">
											<input type="hidden" name="quotationId" value={item.id} />
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
