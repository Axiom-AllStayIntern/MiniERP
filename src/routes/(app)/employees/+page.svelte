<script lang="ts">
	import PageShell from '$app-layer/components/PageShell.svelte';
	let { data } = $props();
</script>

<PageShell
	eyebrow="HR"
	title="Employee Management"
	description="Manage employee profiles and track monthly fixed salary records."
>
	<div class="flex items-center justify-end">
		<a class="rounded-md bg-[var(--sf-green)] px-3 py-2 text-sm font-medium text-white hover:bg-[#2f5e2c]" href="/employees/new">
			Create Employee
		</a>
	</div>

	<div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
		<table class="min-w-full divide-y divide-slate-200 text-sm">
			<thead class="bg-slate-50 text-left text-slate-600">
				<tr>
					<th class="px-4 py-3 font-medium">Name</th>
					<th class="px-4 py-3 font-medium">Type</th>
					<th class="px-4 py-3 font-medium">Status</th>
					<th class="px-4 py-3 font-medium">Start Date</th>
					<th class="px-4 py-3 font-medium">Action</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#if data.employees.length === 0}
					<tr>
						<td class="px-4 py-8 text-center text-slate-500" colspan="5">No employees yet.</td>
					</tr>
				{:else}
					{#each data.employees as employee}
						<tr class="hover:bg-slate-50">
							<td class="px-4 py-3 font-medium text-slate-800">{employee.name}</td>
							<td class="px-4 py-3 text-slate-600">{employee.type}</td>
							<td class="px-4 py-3">
								<span class="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">{employee.status}</span>
							</td>
							<td class="px-4 py-3 text-slate-600">{employee.startDate ?? '--'}</td>
							<td class="px-4 py-3">
								<a class="text-[var(--sf-green)] hover:underline" href={`/employees/${employee.id}`}>View Details</a>
							</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>
</PageShell>


