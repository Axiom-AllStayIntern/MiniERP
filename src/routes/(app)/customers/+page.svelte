<script lang="ts">
	import PageShell from '$app-layer/components/PageShell.svelte';

	let { data } = $props();
</script>

<PageShell
	eyebrow="Business partners"
	title="Customers"
	description="Customers are required before you create a project. Add billing party details used on AR documents."
>
	<div class="mb-4 flex flex-wrap items-center gap-3">
		<a
			class="rounded-md bg-[var(--sf-green)] px-4 py-2 text-sm font-medium text-white hover:bg-[#2f5e2c]"
			href="/customers/new"
		>
			New customer
		</a>
		<a class="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50" href="/projects/new">
			Create project
		</a>
	</div>

	<div class="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
		<table class="min-w-full divide-y divide-slate-200 text-sm">
			<thead class="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
				<tr>
					<th class="px-4 py-3">Name</th>
					<th class="px-4 py-3">Contact</th>
					<th class="px-4 py-3">Address</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#if data.customers.length === 0}
					<tr>
						<td colspan="3" class="px-4 py-8 text-center text-slate-500">
							No customers yet.
							<a class="font-medium text-[var(--sf-green)] hover:underline" href="/customers/new">Add your first customer</a>
							then create a project.
						</td>
					</tr>
				{:else}
					{#each data.customers as c}
						<tr class="hover:bg-slate-50/80">
							<td class="px-4 py-3 font-medium text-slate-900">{c.name}</td>
							<td class="px-4 py-3 text-slate-600">{c.contact ?? '-'}</td>
							<td class="max-w-md truncate px-4 py-3 text-slate-600" title={c.address ?? ''}>{c.address ?? '-'}</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>
</PageShell>


