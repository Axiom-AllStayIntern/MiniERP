<script lang="ts">
	let { data, form } = $props();

	const base = $derived(`/projects/${data.project.id}`);
</script>

<div class="space-y-6">
	{#if form?.message}
		<p class="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{form.message}</p>
	{/if}

	<section class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
		<div class="border-b border-slate-200 px-5 py-4">
			<h2 class="text-[13px] font-medium text-slate-900">Roster</h2>
			<p class="mt-0.5 text-xs text-slate-500">People assigned to this project. Open a row for project-level compensation and payouts.</p>
		</div>
		{#if data.roster.length === 0}
			<p class="px-5 py-10 text-center text-sm text-slate-500">No employees on this project yet.</p>
		{:else}
			<div class="overflow-x-auto">
				<table class="min-w-full divide-y divide-slate-200 text-sm">
					<thead class="bg-slate-50 text-left text-slate-600">
						<tr>
							<th class="px-4 py-3">Name</th>
							<th class="px-4 py-3">Staff type</th>
							<th class="px-4 py-3">Role</th>
							<th class="px-4 py-3">Dates</th>
							<th class="px-4 py-3">Master</th>
							<th class="px-4 py-3 text-right">Actions</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-100">
						{#each data.roster as pe}
							<tr class="hover:bg-slate-50">
								<td class="px-4 py-3 font-medium text-slate-800">
									<a class="text-[var(--sf-green)] hover:underline" href={`${base}/employees/${pe.id}`}>{pe.name}</a>
								</td>
								<td class="px-4 py-3 text-slate-600">{pe.staffType}</td>
								<td class="px-4 py-3 text-slate-600">{pe.role ?? '—'}</td>
								<td class="px-4 py-3 text-slate-600">
									{pe.dateIn ?? '—'}{#if pe.dateOut} → {pe.dateOut}{/if}
								</td>
								<td class="px-4 py-3">
									<a class="text-xs text-slate-600 hover:text-[var(--sf-green)] hover:underline" href="/employees/{pe.employeeId}">Employee record</a>
								</td>
								<td class="px-4 py-3 text-right">
									<form method="POST" action="?/removeFromProject" class="inline">
										<input type="hidden" name="peId" value={pe.id} />
										<button
											type="submit"
											class="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-800 hover:bg-rose-100"
										>
											Remove
										</button>
									</form>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>

	<section class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
		<div class="border-b border-slate-200 px-5 py-4">
			<h2 class="text-[13px] font-medium text-slate-900">Add from employee directory</h2>
			<p class="mt-0.5 text-xs text-slate-500">Creates a project assignment; company-level pay and allocation stay under the employee master record.</p>
		</div>
		{#if data.assignableEmployees.length === 0}
			<p class="px-5 py-8 text-center text-sm text-slate-500">Every active employee is already on this project.</p>
		{:else}
			<form class="space-y-4 px-5 py-5" method="POST" action="?/addToProject">
				<div class="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
					<label class="space-y-1 text-sm md:col-span-2">
						<span class="text-slate-700">Employee</span>
						<select name="employeeId" required class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
							<option value="" disabled selected>Select…</option>
							{#each data.assignableEmployees as e}
								<option value={e.id}>{e.name} ({e.type})</option>
							{/each}
						</select>
					</label>
					<label class="space-y-1 text-sm">
						<span class="text-slate-700">Staff type</span>
						<select name="staffType" class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
							<option value="fulltime">fulltime</option>
							<option value="parttime">parttime</option>
							<option value="freelancer">freelancer</option>
							<option value="director">director</option>
						</select>
					</label>
					<label class="space-y-1 text-sm">
						<span class="text-slate-700">Date in</span>
						<input type="date" name="dateIn" class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
					</label>
					<label class="space-y-1 text-sm">
						<span class="text-slate-700">Date out</span>
						<input type="date" name="dateOut" class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
					</label>
					<label class="space-y-1 text-sm md:col-span-2">
						<span class="text-slate-700">Role (optional)</span>
						<input name="role" class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
					</label>
				</div>
				<button class="rounded-md bg-[var(--sf-green)] px-4 py-2 text-sm font-medium text-white hover:bg-[#2f5e2c]" type="submit">
					Add to project
				</button>
			</form>
		{/if}
	</section>
</div>
