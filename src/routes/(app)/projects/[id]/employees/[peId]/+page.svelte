<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	let { data, form } = $props();

	const base = $derived(`/projects/${data.project.id}`);
	const empHref = $derived(data.employee ? `/employees/${data.employee.id}` : '/employees');
	const selfPath = $derived(page.url.pathname);

	const money = (value: number | null | undefined) =>
		new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD' }).format(value ?? 0);

	const today = new Date().toISOString().slice(0, 10);

	const monthHref = (ym: string) => `${selfPath}?month=${encodeURIComponent(ym)}`;
</script>

<div class="space-y-5">
	{#if form?.message}
		<p
			class="rounded-md border px-3 py-2 text-sm {form.ok
				? 'border-emerald-200 bg-emerald-50 text-emerald-800'
				: 'border-rose-200 bg-rose-50 text-rose-700'}"
		>
			{form.message}
		</p>
	{/if}

	<div class="flex flex-wrap items-center justify-between gap-2">
		<button
			type="button"
			class="text-xs font-medium text-[var(--sf-green)] hover:underline"
			onclick={() => goto(`${base}/employees`)}
		>
			�?Back to roster
		</button>
		<a class="text-xs font-medium text-[var(--sf-green)] hover:underline" href={empHref}>Open employee master -</a>
	</div>

	<section class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
		<div class="border-b border-slate-200 px-5 py-4">
			<p class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Project assignment</p>
			<h2 class="mt-1 text-lg font-medium text-slate-900">{data.pe.name}</h2>
			<p class="mt-0.5 font-mono text-xs text-slate-400">{data.pe.id}</p>
		</div>
		<form class="space-y-4 px-5 py-5" method="POST" action="?/updateAssignment">
			<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
				<label class="space-y-1 text-sm">
					<span class="text-slate-700">Staff type</span>
					<select name="staffType" class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={data.pe.staffType}>
						<option value="fulltime">fulltime</option>
						<option value="parttime">parttime</option>
						<option value="freelancer">freelancer</option>
						<option value="director">director</option>
					</select>
				</label>
				<label class="space-y-1 text-sm">
					<span class="text-slate-700">Date in</span>
					<input type="date" name="dateIn" value={data.pe.dateIn ?? ''} class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
				</label>
				<label class="space-y-1 text-sm">
					<span class="text-slate-700">Date out</span>
					<input type="date" name="dateOut" value={data.pe.dateOut ?? ''} class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
				</label>
				<label class="flex items-center gap-2 text-sm pt-6">
					<input type="checkbox" name="cpfApplicable" checked={data.pe.cpfApplicable} class="rounded border-slate-300" />
					<span class="text-slate-700">CPF on this assignment</span>
				</label>
				<label class="space-y-1 text-sm sm:col-span-2">
					<span class="text-slate-700">Role</span>
					<input name="role" value={data.pe.role ?? ''} class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
				</label>
			</div>
			<button class="rounded-md bg-[var(--sf-green)] px-4 py-2 text-sm font-medium text-white hover:bg-[#2f5e2c]" type="submit">
				Save assignment
			</button>
		</form>
	</section>

	<section
		class="overflow-hidden rounded-xl border shadow-sm"
		style="border-color: rgba(56, 114, 52, 0.25); background: linear-gradient(to bottom, rgba(56, 114, 52, 0.06), white 48%);"
	>
		<div class="border-b border-slate-200/80 px-5 py-4">
			<div class="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h2 class="text-[13px] font-medium text-slate-900">Staff cost �?{data.selectedMonthYm}</h2>
					<p class="mt-0.5 text-xs text-slate-500">Compare preview vs confirmed payouts for this assignment.</p>
				</div>
				<div class="flex items-center gap-2 text-xs">
					<a class="rounded border border-slate-200 bg-white px-2 py-1 text-slate-600 hover:bg-slate-50" href={monthHref(data.prevMonthYm)}>�?Prev</a>
					<span class="font-mono text-slate-700">{data.selectedMonthYm}</span>
					<a class="rounded border border-slate-200 bg-white px-2 py-1 text-slate-600 hover:bg-slate-50" href={monthHref(data.nextMonthYm)}>Next -</a>
				</div>
			</div>
		</div>
		<div class="grid gap-px bg-slate-200/80 sm:grid-cols-2 lg:grid-cols-4">
			<div class="bg-white px-5 py-4">
				<p class="text-[11px] font-medium uppercase tracking-wide text-slate-400">Company slice (preview)</p>
				<p class="mt-1 text-lg font-semibold text-slate-900">{money(data.companyAllocatedEstimate)}</p>
				<p class="mt-0.5 text-xs text-slate-500">From master rules × this project’s %</p>
			</div>
			<div class="bg-white px-5 py-4">
				<p class="text-[11px] font-medium uppercase tracking-wide text-slate-400">Allocated (settled)</p>
				<p class="mt-1 text-lg font-semibold text-slate-900">{money(data.allocatedSettledThisMonth)}</p>
				<p class="mt-0.5 text-xs text-slate-500">Source: allocated_from_company</p>
			</div>
			<div class="bg-white px-5 py-4">
				<p class="text-[11px] font-medium uppercase tracking-wide text-slate-400">Project rules (settled)</p>
				<p class="mt-1 text-lg font-semibold text-slate-900">{money(data.projectRulesSettledThisMonth)}</p>
				<p class="mt-0.5 text-xs text-slate-500">Bonuses / fees on this roster line</p>
			</div>
			<div class="bg-white px-5 py-4">
				<p class="text-[11px] font-medium uppercase tracking-wide text-slate-400">Total confirmed (month)</p>
				<p class="mt-1 text-lg font-semibold text-[var(--sf-green)]">{money(data.confirmedStaffCostThisMonth)}</p>
				<p class="mt-0.5 text-xs text-slate-500">Counts toward project staff cost</p>
			</div>
		</div>
		{#if data.adjustmentSettledThisMonth > 0}
			<p class="border-t border-slate-100 px-5 py-2 text-xs text-slate-600">
				Adjustments (confirmed): <span class="font-medium text-slate-800">{money(data.adjustmentSettledThisMonth)}</span>
			</p>
		{/if}
		<div class="border-t border-slate-100 px-5 py-4">
			<form class="flex flex-wrap items-end gap-3" method="POST" action="?/settleCompanyAllocation">
				<label class="space-y-1 text-sm">
					<span class="text-slate-700">Post company allocation for month</span>
					<input type="month" name="monthYm" value={data.selectedMonthYm} class="rounded-md border border-slate-300 px-3 py-2 text-sm" />
				</label>
				<button
					type="submit"
					class="rounded-md bg-[var(--sf-green)] px-4 py-2 text-sm font-medium text-white hover:bg-[#2f5e2c]"
				>
					Settle month (confirm)
				</button>
			</form>
			<form class="mt-3 flex flex-wrap items-end gap-3" method="POST" action="?/settleProjectComponents">
				<input type="hidden" name="monthYm" value={data.selectedMonthYm} />
				<button
					type="submit"
					class="rounded-md border border-[var(--sf-green)] px-4 py-2 text-sm font-medium text-[var(--sf-green)] hover:bg-[var(--sf-green-soft)]"
				>
					Settle project components (confirm)
				</button>
			</form>
			<p class="mt-2 text-xs text-slate-500">
				Creates or updates <strong>confirmed</strong> payout lines with source <code class="rounded bg-slate-100 px-1">allocated_from_company</code> (month
				period <code class="rounded bg-slate-100 px-1">YYYY-MM-01</code>). Re-run for the same month to refresh amounts after master rule / weight
				changes.
			</p>
			<p class="mt-1 text-xs text-slate-500">
				Project component settle currently posts <code class="rounded bg-slate-100 px-1">monthly</code> and
				<code class="rounded bg-slate-100 px-1">one_off</code> manual rules into source
				<code class="rounded bg-slate-100 px-1">settlement</code>.
			</p>
		</div>
	</section>

	<section class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
		<div class="border-b border-slate-200 px-5 py-4">
			<h2 class="text-[13px] font-medium text-slate-900">Company pay �?allocated slice (read-only)</h2>
			<p class="mt-0.5 text-xs text-slate-500">
				{#if data.allocationRow}
					Weight on this project: <strong>{data.allocationRow.weightPct}%</strong> ({data.allocationRow.allocationMode}). Edit weights on the
					<a class="text-[var(--sf-green)] hover:underline" href={empHref}>employee master</a>.
				{:else}
					No allocation row for this project. Add weights on the employee master to preview base split.
				{/if}
			</p>
		</div>
		<div class="overflow-x-auto">
			<table class="min-w-full divide-y divide-slate-200 text-sm">
				<thead class="bg-slate-50 text-left text-slate-600">
					<tr>
						<th class="px-4 py-3">Label</th>
						<th class="px-4 py-3">Income</th>
						<th class="px-4 py-3">Rule</th>
						<th class="px-4 py-3">Company value</th>
						<th class="px-4 py-3">Freq</th>
						<th class="px-4 py-3 text-right">Allocated (monthly fixed)</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100">
					{#if data.companyAllocationPreview.length === 0}
						<tr><td class="px-4 py-6 text-slate-500" colspan="6">No company components.</td></tr>
					{:else}
						{#each data.companyAllocationPreview as row}
							<tr>
								<td class="px-4 py-3 font-medium text-slate-800">{row.label}</td>
								<td class="px-4 py-3 text-slate-600">{row.incomeType}</td>
								<td class="px-4 py-3 text-slate-600">{row.ruleType}</td>
								<td class="px-4 py-3 text-slate-600">{row.value}</td>
								<td class="px-4 py-3 text-slate-600">{row.frequency}</td>
								<td class="px-4 py-3 text-right text-slate-800">
									{#if row.allocatedMonthly != null}
										{money(row.allocatedMonthly)}
									{:else}
										<span class="text-slate-400">-</span>
									{/if}
								</td>
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>
		<div class="border-t border-slate-100 px-5 py-4">
			<p class="text-xs text-slate-500">
				Editing is on the employee master. Use <strong>Settle month</strong> above to post amounts into payout history (read-only mirror rows
				<code class="rounded bg-slate-100 px-1">[Company] -</code> are created automatically).
			</p>
		</div>
	</section>

	<section class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
		<div class="border-b border-slate-200 px-5 py-4">
			<h2 class="text-[13px] font-medium text-slate-900">Project compensation components</h2>
			<p class="mt-0.5 text-xs text-slate-500">Rules for this person on this project only (bonuses, fees, etc.).</p>
		</div>
		<form class="grid gap-3 border-b border-slate-100 bg-slate-50/80 px-5 py-4 md:grid-cols-2 lg:grid-cols-3" method="POST" action="?/addProjectComponent">
			<label class="space-y-1 text-sm md:col-span-2">
				<span class="text-slate-700">Label</span>
				<input name="label" required class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
			</label>
			<label class="space-y-1 text-sm">
				<span class="text-slate-700">Income type</span>
				<select name="incomeType" class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
					<option value="salary">salary</option>
					<option value="bonus">bonus</option>
					<option value="allowance">allowance</option>
					<option value="dividend">dividend</option>
					<option value="reimbursement">reimbursement</option>
				</select>
			</label>
			<label class="space-y-1 text-sm">
				<span class="text-slate-700">Rule type</span>
				<select name="ruleType" class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
					<option value="manual">manual</option>
					<option value="fixed">fixed</option>
					<option value="hourly">hourly</option>
					<option value="profit_pct">profit_pct</option>
					<option value="revenue_pct">revenue_pct</option>
					<option value="equity_share">equity_share</option>
				</select>
			</label>
			<label class="space-y-1 text-sm">
				<span class="text-slate-700">Value</span>
				<input name="value" type="number" step="0.01" value="0" class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
			</label>
			<label class="space-y-1 text-sm">
				<span class="text-slate-700">Frequency</span>
				<select name="frequency" class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
					<option value="one_off">one_off</option>
					<option value="monthly">monthly</option>
					<option value="quarterly">quarterly</option>
					<option value="annual">annual</option>
					<option value="on_project_close">on_project_close</option>
				</select>
			</label>
			<label class="space-y-1 text-sm">
				<span class="text-slate-700">Effective from</span>
				<input name="effectiveFrom" type="date" value={today} class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
			</label>
			<label class="flex items-center gap-2 text-sm md:col-span-2">
				<input type="checkbox" name="taxable" checked class="rounded border-slate-300" />
				<span class="text-slate-700">Taxable</span>
			</label>
			<button class="rounded-md bg-[var(--sf-green)] px-4 py-2 text-sm font-medium text-white hover:bg-[#2f5e2c] md:col-span-3" type="submit">
				Add component
			</button>
		</form>
		<div class="overflow-x-auto">
			<table class="min-w-full divide-y divide-slate-200 text-sm">
				<thead class="bg-slate-50 text-left text-slate-600">
					<tr>
						<th class="px-4 py-3">Label</th>
						<th class="px-4 py-3">Income</th>
						<th class="px-4 py-3">Rule</th>
						<th class="px-4 py-3">Value</th>
						<th class="px-4 py-3">From</th>
						<th class="px-4 py-3"></th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100">
					{#if data.projectComponents.length === 0}
						<tr><td class="px-4 py-6 text-slate-500" colspan="6">No project-level components.</td></tr>
					{:else}
						{#each data.projectComponents as c}
							<tr>
								<td class="px-4 py-3 font-medium text-slate-800">{c.label}</td>
								<td class="px-4 py-3 text-slate-600">{c.incomeType}</td>
								<td class="px-4 py-3 text-slate-600">{c.ruleType}</td>
								<td class="px-4 py-3 text-slate-600">{c.value}</td>
								<td class="px-4 py-3 text-slate-600">{c.effectiveFrom}</td>
								<td class="px-4 py-3">
									<form method="POST" action="?/removeProjectComponent">
										<input type="hidden" name="componentId" value={c.id} />
										<button class="rounded border border-rose-300 bg-rose-50 px-2 py-1 text-xs text-rose-700 hover:bg-rose-100" type="submit">
											Remove
										</button>
									</form>
								</td>
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>
	</section>

	<section class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
		<div class="border-b border-slate-200 px-5 py-4">
			<h2 class="text-[13px] font-medium text-slate-900">Payout history (this assignment)</h2>
			<p class="mt-0.5 text-xs text-slate-500">
				Includes project rules and company-allocated lines (shadow components). Period may be <code class="rounded bg-slate-50 px-1">YYYY-MM-01</code> or
				event dates from older data.
			</p>
		</div>
		{#if data.payouts.length === 0}
			<p class="px-5 py-8 text-center text-sm text-slate-500">No payouts yet.</p>
		{:else}
			<div class="overflow-x-auto">
				<table class="min-w-full divide-y divide-slate-200 text-sm">
					<thead class="bg-slate-50 text-left text-slate-600">
						<tr>
							<th class="px-4 py-3">Period</th>
							<th class="px-4 py-3">Component</th>
							<th class="px-4 py-3">Income</th>
							<th class="px-4 py-3">Source</th>
							<th class="px-4 py-3">Status</th>
							<th class="px-4 py-3">Note</th>
							<th class="px-4 py-3 text-right">Amount</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-100">
						{#each data.payouts as p}
							<tr>
								<td class="px-4 py-3 text-slate-600">{p.period}</td>
								<td class="px-4 py-3 font-medium text-slate-800">{p.componentLabel}</td>
								<td class="px-4 py-3 text-slate-600">{p.incomeType}</td>
								<td class="px-4 py-3 text-slate-600">{p.source}</td>
								<td class="px-4 py-3 text-slate-600">{p.status}</td>
								<td class="px-4 py-3 text-slate-600">{p.note ?? '-'}</td>
								<td class="px-4 py-3 text-right text-slate-800">{money(p.computedAmount)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>
</div>


