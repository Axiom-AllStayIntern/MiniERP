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
	eyebrow="Project / Quotations"
	title={`${data.project.name} - Quotation Management`}
	description="This version supports manual quotation entries. File archiving and version tracking will be added later."
>
	<nav class="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
		<a class="hover:text-[var(--sf-green)] hover:underline" href="/dashboard">Dashboard</a>
		<span>/</span>
		<a class="hover:text-[var(--sf-green)] hover:underline" href="/projects">Projects</a>
		<span>/</span>
		<a class="hover:text-[var(--sf-green)] hover:underline" href={`/projects/${data.project.id}`}>{data.project.name}</a>
		<span>/</span>
		<span class="font-medium text-slate-800">Quotations</span>
	</nav>
	<div class="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-2 text-xs">
		<a class="rounded-md px-2 py-1 text-slate-600 hover:bg-slate-100" href={`/projects/${data.project.id}/contracts`}>Contracts</a>
		<span class="rounded-md bg-[var(--sf-green)] px-2 py-1 font-medium text-white">Quotations</span>
		<a class="rounded-md px-2 py-1 text-slate-600 hover:bg-slate-100" href={`/projects/${data.project.id}/purchase-orders`}>Purchase Orders</a>
		<a class="rounded-md px-2 py-1 text-slate-600 hover:bg-slate-100" href={`/projects/${data.project.id}/expenses`}>Expenses</a>
	</div>
	{#if form?.message}
		<p class="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{form.message}</p>
	{/if}
	<form class="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-5" method="POST" action="?/create">
		<input class="rounded border border-slate-300 px-3 py-2 text-sm" name="amount" type="number" step="0.01" placeholder="Amount" />
		<input class="rounded border border-slate-300 px-3 py-2 text-sm" name="currency" value="SGD" />
		<input class="rounded border border-slate-300 px-3 py-2 text-sm" name="sourceType" value="manual" placeholder="Source Type" />
		<input class="rounded border border-slate-300 px-3 py-2 text-sm" name="date" type="date" />
		<input class="rounded border border-slate-300 px-3 py-2 text-sm" name="notes" placeholder="Notes" />
		<button class="rounded bg-[var(--sf-green)] px-3 py-2 text-sm text-white hover:bg-[#2f5e2c] md:col-span-5" type="submit">Add Quotation Record</button>
	</form>

	<div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
		<table class="min-w-full divide-y divide-slate-200 text-sm">
			<thead class="bg-slate-50 text-left text-slate-600">
				<tr><th class="px-4 py-3">Date</th><th class="px-4 py-3">Amount</th><th class="px-4 py-3">Currency</th><th class="px-4 py-3">Source</th><th class="px-4 py-3">Actions</th></tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#if data.quotations.length === 0}
					<tr><td class="px-4 py-6 text-slate-500" colspan="5">No quotation records yet.</td></tr>
				{:else}
					{#each data.quotations as item}
						<tr class="align-top">
							<td class="px-4 py-3">{item.date ?? '--'}</td>
							<td class="px-4 py-3">{item.amount ?? 0}</td>
							<td class="px-4 py-3">{item.currency ?? 'SGD'}</td>
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
											<button class="rounded bg-[var(--sf-green)] px-2 py-1.5 text-xs text-white hover:bg-[#2f5e2c] md:col-span-2" type="submit">Save Changes</button>
										</form>
										<form method="POST" action="?/delete">
											<input type="hidden" name="quotationId" value={item.id} />
											<button class="rounded border border-rose-300 bg-rose-50 px-2 py-1.5 text-xs text-rose-700 hover:bg-rose-100" type="submit">Delete Record</button>
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
