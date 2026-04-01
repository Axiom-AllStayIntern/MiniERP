<script lang="ts">
	import PageShell from '$lib/components/PageShell.svelte';

	let { data } = $props();

	const statuses = ['active', 'on_hold', 'completed', 'archived'];
</script>

<PageShell eyebrow="Project Management" title="Project Management" description="Manage project master data and open detail pages for profit breakdown.">
	<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<form class="flex flex-wrap gap-2" method="GET">
				<select
					name="status"
					class="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-[var(--sf-green)]"
					value={data.filters.status}
				>
					<option value="">All Statuses</option>
					{#each statuses as status}
						<option value={status}>{status}</option>
					{/each}
				</select>

				<select
					name="customer_id"
					class="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-[var(--sf-green)]"
					value={data.filters.customerId}
				>
					<option value="">All Customers</option>
					{#each data.customers as customer}
						<option value={customer.id}>{customer.name}</option>
					{/each}
				</select>

				<button
					type="submit"
					class="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
				>
					Filter
				</button>
			</form>

			<a
				href="/projects/new"
				class="rounded-md bg-[var(--sf-green)] px-3 py-2 text-sm font-medium text-white hover:bg-[#2f5e2c]"
			>
				Create Project
			</a>
		</div>
	</div>

	<div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
		<table class="min-w-full divide-y divide-slate-200 text-sm">
			<thead class="bg-slate-50 text-left text-slate-600">
				<tr>
					<th class="px-4 py-3 font-medium">Project Name</th>
					<th class="px-4 py-3 font-medium">Customer</th>
					<th class="px-4 py-3 font-medium">Status</th>
					<th class="px-4 py-3 font-medium">Start Date</th>
					<th class="px-4 py-3 font-medium">Updated At</th>
					<th class="px-4 py-3 font-medium">Action</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#if data.projects.length === 0}
					<tr>
						<td class="px-4 py-8 text-center text-slate-500" colspan="6">No projects yet. Create one to get started.</td>
					</tr>
				{:else}
					{#each data.projects as project}
						<tr class="hover:bg-slate-50">
							<td class="px-4 py-3 font-medium text-slate-800">{project.name}</td>
							<td class="px-4 py-3 text-slate-600">{project.customerName}</td>
							<td class="px-4 py-3">
								<span class="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">{project.status}</span>
							</td>
							<td class="px-4 py-3 text-slate-600">{project.startDate ?? '--'}</td>
							<td class="px-4 py-3 text-slate-600">{project.updatedAt.slice(0, 10)}</td>
							<td class="px-4 py-3">
								<a class="text-[var(--sf-green)] hover:underline" href={`/projects/${project.id}`}>View Details</a>
							</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>
</PageShell>
