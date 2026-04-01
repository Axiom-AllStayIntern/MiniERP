<script lang="ts">
	import PageShell from '$lib/components/PageShell.svelte';
	let { data, form } = $props();
</script>

<PageShell
	eyebrow="Employee Detail"
	title={data.employee.name}
	description={`Type: ${data.employee.type} | Status: ${data.employee.status}`}
>
	{#if form?.message}
		<p class="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{form.message}</p>
	{/if}

	<form class="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm" method="POST" action="?/updateProfile">
		<div class="grid gap-4 md:grid-cols-2">
			<label class="space-y-1 text-sm">
				<span class="text-slate-700">Name</span>
				<input name="name" required value={data.employee.name} class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--sf-green)]" />
			</label>
			<label class="space-y-1 text-sm">
				<span class="text-slate-700">Type</span>
				<select name="type" value={data.employee.type} class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--sf-green)]">
					<option value="full_time">full_time</option>
					<option value="part_time">part_time</option>
					<option value="freelancer">freelancer</option>
					<option value="advisor">advisor</option>
					<option value="overseas_staff">overseas_staff</option>
				</select>
			</label>
			<label class="space-y-1 text-sm">
				<span class="text-slate-700">Status</span>
				<select name="status" value={data.employee.status} class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--sf-green)]">
					<option value="active">active</option>
					<option value="inactive">inactive</option>
				</select>
			</label>
			<label class="space-y-1 text-sm">
				<span class="text-slate-700">Start Date</span>
				<input type="date" name="startDate" value={data.employee.startDate ?? ''} class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--sf-green)]" />
			</label>
			<label class="space-y-1 text-sm">
				<span class="text-slate-700">End Date</span>
				<input type="date" name="endDate" value={data.employee.endDate ?? ''} class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--sf-green)]" />
			</label>
			<label class="space-y-1 text-sm">
				<span class="text-slate-700">Contact</span>
				<input name="contact" value={data.employee.contact ?? ''} class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--sf-green)]" />
			</label>
			<label class="space-y-1 text-sm md:col-span-2">
				<span class="text-slate-700">Tax ID</span>
				<input name="taxId" value={data.employee.taxId ?? ''} class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--sf-green)]" />
			</label>
		</div>

		<div class="flex gap-3">
			<button class="rounded-md bg-[var(--sf-green)] px-4 py-2 text-sm font-medium text-white hover:bg-[#2f5e2c]" type="submit">Save Profile</button>
			<a class="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50" href="/employees">Back to List</a>
		</div>
	</form>

	<section class="space-y-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
		<h2 class="text-lg font-semibold text-slate-900">Monthly Salary Records</h2>
		<form class="grid gap-3 md:grid-cols-5" method="POST" action="?/addSalary">
			<input name="month" type="month" class="rounded border border-slate-300 px-3 py-2 text-sm" required />
			<input name="salary" type="number" step="0.01" placeholder="Salary" class="rounded border border-slate-300 px-3 py-2 text-sm" />
			<input name="allowance" type="number" step="0.01" placeholder="Allowance" class="rounded border border-slate-300 px-3 py-2 text-sm" />
			<input name="cpfEmployee" type="number" step="0.01" placeholder="CPF Employee" class="rounded border border-slate-300 px-3 py-2 text-sm" />
			<input name="cpfEmployer" type="number" step="0.01" placeholder="CPF Employer" class="rounded border border-slate-300 px-3 py-2 text-sm" />
			<button class="rounded bg-[var(--sf-green)] px-3 py-2 text-sm text-white hover:bg-[#2f5e2c] md:col-span-5" type="submit">Add Salary Record</button>
		</form>

		<div class="overflow-hidden rounded border border-slate-200">
			<table class="min-w-full divide-y divide-slate-200 text-sm">
				<thead class="bg-slate-50 text-left text-slate-600">
					<tr>
						<th class="px-4 py-3">Month</th>
						<th class="px-4 py-3">Salary</th>
						<th class="px-4 py-3">Allowance</th>
						<th class="px-4 py-3">CPF Employee</th>
						<th class="px-4 py-3">CPF Employer</th>
						<th class="px-4 py-3">Action</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100">
					{#if data.salaries.length === 0}
						<tr><td class="px-4 py-6 text-slate-500" colspan="6">No salary records yet.</td></tr>
					{:else}
						{#each data.salaries as item}
							<tr>
								<td class="px-4 py-3">{item.month}</td>
								<td class="px-4 py-3">{item.salary}</td>
								<td class="px-4 py-3">{item.allowance}</td>
								<td class="px-4 py-3">{item.cpfEmployee}</td>
								<td class="px-4 py-3">{item.cpfEmployer}</td>
								<td class="px-4 py-3">
									<form method="POST" action="?/deleteSalary">
										<input type="hidden" name="salaryId" value={item.id} />
										<button class="rounded border border-rose-300 bg-rose-50 px-2 py-1 text-xs text-rose-700 hover:bg-rose-100" type="submit">Delete</button>
									</form>
								</td>
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>
	</section>

	<form method="POST" action="?/deleteEmployee">
		<button type="submit" class="rounded-md border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100">
			Archive and Remove Employee
		</button>
	</form>
</PageShell>
