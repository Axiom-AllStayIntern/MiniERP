<script lang="ts">
	import PageShell from '$app-layer/components/PageShell.svelte';

	let { data, form } = $props();

	let profileEditing = $state(false);

	$effect(() => {
		if (form && 'profileUpdated' in form && form.profileUpdated) profileEditing = false;
	});

	const today = new Date().toISOString().slice(0, 10);
	const calendarYear = new Date().getFullYear();
	const taxYearMin = 2018;
	const taxYearMax = calendarYear + 1;
	const taxYearOptions = Array.from({ length: taxYearMax - taxYearMin + 1 }, (_, i) => taxYearMin + i);

	function formatSgd(n: number) {
		return new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD' }).format(n);
	}

	function dash(s: string | null | undefined) {
		const t = s?.trim();
		return t ? t : '-';
	}
</script>

<PageShell
	eyebrow="HR"
	title={data.employee.name}
	description={`Type: ${data.employee.type} · Status: ${data.employee.status}`}
>
	{#if form?.message}
		<p
			class="rounded-md border px-3 py-2 text-sm {form.ok
				? 'border-emerald-200 bg-emerald-50 text-emerald-800'
				: 'border-rose-200 bg-rose-50 text-rose-700'}"
		>
			{form.message}
		</p>
	{/if}

	<div class="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<h2 class="text-lg font-semibold text-slate-900">Profile</h2>
			<div class="flex flex-wrap items-center gap-2">
				{#if profileEditing}
					<button
						type="button"
						class="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
						onclick={() => {
							profileEditing = false;
						}}
					>
						Cancel
					</button>
				{:else}
					<button
						type="button"
						class="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
						onclick={() => {
							profileEditing = true;
						}}
					>
						Edit
					</button>
				{/if}
				<a class="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50" href="/employees">Back to list</a>
			</div>
		</div>

		{#if profileEditing}
			<form class="space-y-4" method="POST" action="?/updateProfile">
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
					<label class="flex items-center gap-2 text-sm pt-6">
						<input type="checkbox" name="cpfApplicable" checked={data.employee.cpfApplicable ?? true} class="rounded border-slate-300" />
						<span class="text-slate-700">CPF applicable (company default)</span>
					</label>
					<label class="space-y-1 text-sm">
						<span class="text-slate-700">Start date</span>
						<input type="date" name="startDate" value={data.employee.startDate ?? ''} class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--sf-green)]" />
					</label>
					<label class="space-y-1 text-sm">
						<span class="text-slate-700">End date</span>
						<input type="date" name="endDate" value={data.employee.endDate ?? ''} class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--sf-green)]" />
					</label>
					<label class="space-y-1 text-sm">
						<span class="text-slate-700">Contact</span>
						<input name="contact" value={data.employee.contact ?? ''} class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--sf-green)]" />
					</label>
					<label class="space-y-1 text-sm">
						<span class="text-slate-700">Tax ID</span>
						<input name="taxId" value={data.employee.taxId ?? ''} class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--sf-green)]" />
					</label>
					<label class="space-y-1 text-sm md:col-span-2">
						<span class="text-slate-700">Tax resident label</span>
						<input
							name="taxResidentLabel"
							value={data.employee.taxResidentLabel ?? ''}
							placeholder="e.g. Singapore citizen, PR, non-resident"
							class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--sf-green)]"
						/>
					</label>
				</div>
				<div class="flex flex-wrap gap-3">
					<button class="rounded-md bg-[var(--sf-green)] px-4 py-2 text-sm font-medium text-white hover:bg-[#2f5e2c]" type="submit">Save profile</button>
				</div>
			</form>
		{:else}
			<dl class="grid gap-4 border-t border-slate-100 pt-4 md:grid-cols-2">
				<div>
					<dt class="text-xs font-medium uppercase tracking-wide text-slate-500">Name</dt>
					<dd class="mt-1 text-sm text-slate-900">{data.employee.name}</dd>
				</div>
				<div>
					<dt class="text-xs font-medium uppercase tracking-wide text-slate-500">Type</dt>
					<dd class="mt-1 text-sm text-slate-900">{data.employee.type}</dd>
				</div>
				<div>
					<dt class="text-xs font-medium uppercase tracking-wide text-slate-500">Status</dt>
					<dd class="mt-1 text-sm text-slate-900">
						<span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{data.employee.status}</span>
					</dd>
				</div>
				<div>
					<dt class="text-xs font-medium uppercase tracking-wide text-slate-500">CPF applicable</dt>
					<dd class="mt-1 text-sm text-slate-900">{data.employee.cpfApplicable !== false ? 'Yes' : 'No'}</dd>
				</div>
				<div>
					<dt class="text-xs font-medium uppercase tracking-wide text-slate-500">Start date</dt>
					<dd class="mt-1 text-sm text-slate-900">{dash(data.employee.startDate)}</dd>
				</div>
				<div>
					<dt class="text-xs font-medium uppercase tracking-wide text-slate-500">End date</dt>
					<dd class="mt-1 text-sm text-slate-900">{dash(data.employee.endDate)}</dd>
				</div>
				<div>
					<dt class="text-xs font-medium uppercase tracking-wide text-slate-500">Contact</dt>
					<dd class="mt-1 text-sm text-slate-900">{dash(data.employee.contact)}</dd>
				</div>
				<div>
					<dt class="text-xs font-medium uppercase tracking-wide text-slate-500">Tax ID</dt>
					<dd class="mt-1 text-sm text-slate-900">{dash(data.employee.taxId)}</dd>
				</div>
				<div class="md:col-span-2">
					<dt class="text-xs font-medium uppercase tracking-wide text-slate-500">Tax resident label</dt>
					<dd class="mt-1 text-sm text-slate-900">{dash(data.employee.taxResidentLabel)}</dd>
				</div>
			</dl>
		{/if}
	</div>

	<section class="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
		<div>
			<h2 class="text-lg font-semibold text-slate-900">Company compensation components</h2>
			<p class="mt-1 text-xs text-slate-500">
				Rules applied at employee level; project assignment pages show an allocated slice using weights you set for projects this person is on (see
				<span class="font-medium text-slate-600">Base cost allocation</span>).
			</p>
		</div>

		<form class="grid gap-3 rounded-lg border border-slate-100 bg-slate-50/80 p-4 md:grid-cols-2 lg:grid-cols-3" method="POST" action="?/addCompanyComponent">
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
					<option value="fixed">fixed</option>
					<option value="hourly">hourly</option>
					<option value="manual">manual</option>
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
					<option value="monthly">monthly</option>
					<option value="quarterly">quarterly</option>
					<option value="annual">annual</option>
					<option value="one_off">one_off</option>
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
			<button class="rounded-md bg-[var(--sf-green)] px-4 py-2 text-sm font-medium text-white hover:bg-[#2f5e2c] md:col-span-3" type="submit">Add component</button>
		</form>

		<div class="overflow-hidden rounded border border-slate-200">
			<table class="min-w-full divide-y divide-slate-200 text-sm">
				<thead class="bg-slate-50 text-left text-slate-600">
					<tr>
						<th class="px-4 py-3">Label</th>
						<th class="px-4 py-3">Type</th>
						<th class="px-4 py-3">Rule</th>
						<th class="px-4 py-3">Value</th>
						<th class="px-4 py-3">Freq</th>
						<th class="px-4 py-3">From</th>
						<th class="px-4 py-3"></th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100">
					{#if data.companyComponents.length === 0}
						<tr><td class="px-4 py-6 text-slate-500" colspan="7">No company-level components yet.</td></tr>
					{:else}
						{#each data.companyComponents as c}
							<tr>
								<td class="px-4 py-3 font-medium text-slate-800">{c.label}</td>
								<td class="px-4 py-3 text-slate-600">{c.incomeType}</td>
								<td class="px-4 py-3 text-slate-600">{c.ruleType}</td>
								<td class="px-4 py-3 text-slate-600">{c.value}</td>
								<td class="px-4 py-3 text-slate-600">{c.frequency}</td>
								<td class="px-4 py-3 text-slate-600">{c.effectiveFrom}</td>
								<td class="px-4 py-3">
									<form method="POST" action="?/removeCompanyComponent">
										<input type="hidden" name="componentId" value={c.id} />
										<button class="rounded border border-rose-300 bg-rose-50 px-2 py-1 text-xs text-rose-700 hover:bg-rose-100" type="submit">Remove</button>
									</form>
								</td>
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>
	</section>

	<section class="space-y-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
		<h2 class="text-lg font-semibold text-slate-900">Project participation</h2>
		<p class="text-xs text-slate-500">
			Only these projects appear in base-cost allocation below. Add or remove people from each project’s roster.
		</p>
		{#if data.participation.length === 0}
			<p class="text-sm text-slate-500">Not assigned to any project yet.</p>
		{:else}
			<div class="flex flex-wrap gap-2">
				{#each data.participation as p}
					<a
						href="/projects/{p.projectId}/employees/{p.peId}"
						class="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 hover:border-[var(--sf-green)] hover:bg-[var(--sf-green-soft)]"
					>
						{p.projectName}
						<span class="text-slate-500">{p.staffType}{p.role ? ` · ${p.role}` : ''}</span>
					</a>
				{/each}
			</div>
		{/if}
	</section>

	<section class="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
		<div>
			<h2 class="text-lg font-semibold text-slate-900">Base cost allocation (participating projects only)</h2>
			<p class="mt-1 text-xs text-slate-500">
				Split company-level base cost across projects this employee is on. Positive weights must total 100%. Leave blank or 0 where this person’s
				base cost should not hit that project.
			</p>
		</div>
		{#if data.participation.length === 0}
			<p class="rounded-lg border border-amber-100 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
				Add this person to at least one project (project roster) before setting allocation weights.
			</p>
		{:else}
			<form method="POST" action="?/saveAllocations" class="space-y-4">
				<label class="flex flex-wrap items-center gap-2 text-sm">
					<span class="text-slate-700">Effective from</span>
					<input type="date" name="effectiveFrom" value={data.allocations[0]?.effectiveFrom ?? today} class="rounded-md border border-slate-300 px-3 py-2" />
				</label>
				<div class="max-h-[320px] space-y-2 overflow-y-auto rounded-lg border border-slate-100 p-3">
					{#each data.participation as p}
						<div class="flex flex-wrap items-center gap-3 text-sm">
							<span class="min-w-[12rem] font-medium text-slate-800">{p.projectName}</span>
							<label class="flex items-center gap-2">
								<span class="text-slate-500">Weight %</span>
								<input
									type="number"
									name={`w_${p.projectId}`}
									step="0.01"
									min="0"
									max="100"
									value={data.allocationByProjectId[p.projectId] ?? ''}
									class="w-24 rounded-md border border-slate-300 px-2 py-1"
								/>
							</label>
						</div>
					{/each}
				</div>
				<p class="text-xs text-slate-500">Saving replaces all allocation rows for this employee and keeps only the projects listed above.</p>
				<button class="rounded-md bg-[var(--sf-green)] px-4 py-2 text-sm font-medium text-white hover:bg-[#2f5e2c]" type="submit">Save allocation</button>
			</form>
		{/if}
	</section>

	<section class="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
		<div class="flex flex-wrap items-start justify-between gap-4">
			<div>
				<h2 class="text-lg font-semibold text-slate-900">Individual income tax (IR8A-style summary)</h2>
				<p class="mt-1 text-xs text-slate-500">
					Rolls up <strong>project-linked payouts</strong> (status confirmed or paid) by calendar year �?same basis as
					<code class="rounded bg-slate-100 px-1 text-[11px]">GET /api/tax/individual/-</code>. Not a filing-ready IR8A export.
				</p>
			</div>
			<form method="GET" class="flex items-end gap-2">
				<label class="space-y-1 text-sm">
					<span class="text-slate-700">Year</span>
					<select
						name="taxYear"
						value={String(data.individualTax.year)}
						class="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--sf-green)]"
						onchange={(e) => e.currentTarget.form?.requestSubmit()}
					>
						{#each taxYearOptions as y}
							<option value={y}>{y}</option>
						{/each}
					</select>
				</label>
			</form>
		</div>

		<p class="text-xs text-slate-600">{data.individualTax.note}</p>

		<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
			<div class="rounded-lg border border-slate-100 bg-slate-50/80 p-4">
				<p class="text-xs font-medium text-slate-500">Gross (computed)</p>
				<p class="mt-1 text-lg font-semibold text-slate-900">{formatSgd(data.individualTax.computedTotal)}</p>
				<p class="mt-1 text-[11px] text-slate-500">{data.individualTax.payoutCount} payout line(s)</p>
			</div>
			<div class="rounded-lg border border-slate-100 bg-slate-50/80 p-4">
				<p class="text-xs font-medium text-slate-500">Taxable (from lines)</p>
				<p class="mt-1 text-lg font-semibold text-slate-900">{formatSgd(data.individualTax.taxableTotal)}</p>
			</div>
			<div class="rounded-lg border border-slate-100 bg-slate-50/80 p-4">
				<p class="text-xs font-medium text-slate-500">Employee CPF (summed)</p>
				<p class="mt-1 text-lg font-semibold text-slate-900">{formatSgd(data.individualTax.cpfEmployeeTotal)}</p>
			</div>
			<div class="rounded-lg border border-emerald-100 bg-emerald-50/50 p-4">
				<p class="text-xs font-medium text-emerald-800">Chargeable (after CPF only)</p>
				<p class="mt-1 text-lg font-semibold text-emerald-900">{formatSgd(data.individualTax.chargeableBeforeOtherReliefs)}</p>
				<p class="mt-1 text-[11px] text-emerald-800/80">Before other IRAS reliefs</p>
			</div>
		</div>

		<div class="rounded-lg border border-amber-100 bg-amber-50/60 p-4">
			<p class="text-xs font-medium text-amber-900">Illustrative resident tax (progressive)</p>
			<p class="mt-1 text-2xl font-semibold text-amber-950">{formatSgd(data.individualTax.estimatedResidentTax)}</p>
			<p class="mt-1 text-[11px] text-amber-900/90">
				Applied to chargeable-after-CPF only; non-resident rules, rebates, and reliefs are not applied. Verify with IRAS.
			</p>
		</div>

		<div>
			<h3 class="mb-2 text-sm font-semibold text-slate-800">By income type</h3>
			<div class="overflow-hidden rounded border border-slate-200">
				<table class="min-w-full divide-y divide-slate-200 text-sm">
					<thead class="bg-slate-50 text-left text-slate-600">
						<tr>
							<th class="px-4 py-3">Income type</th>
							<th class="px-4 py-3 text-right">Lines</th>
							<th class="px-4 py-3 text-right">Computed</th>
							<th class="px-4 py-3 text-right">Taxable</th>
							<th class="px-4 py-3 text-right">CPF (employee)</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-100">
						{#if data.individualTax.byIncomeType.length === 0}
							<tr>
								<td class="px-4 py-6 text-slate-500" colspan="5">No confirmed or paid payouts in this year for this employee’s project assignments.</td>
							</tr>
						{:else}
							{#each data.individualTax.byIncomeType as row}
								<tr>
									<td class="px-4 py-3 font-medium text-slate-800">{row.incomeType}</td>
									<td class="px-4 py-3 text-right text-slate-600">{row.lineCount}</td>
									<td class="px-4 py-3 text-right text-slate-600">{formatSgd(row.computedSum)}</td>
									<td class="px-4 py-3 text-right text-slate-600">{formatSgd(row.taxableSum)}</td>
									<td class="px-4 py-3 text-right text-slate-600">{formatSgd(row.cpfEmployeeSum)}</td>
								</tr>
							{/each}
							<tr class="bg-slate-50 font-medium text-slate-900">
								<td class="px-4 py-3">Total</td>
								<td class="px-4 py-3 text-right">{data.individualTax.payoutCount}</td>
								<td class="px-4 py-3 text-right">{formatSgd(data.individualTax.computedTotal)}</td>
								<td class="px-4 py-3 text-right">{formatSgd(data.individualTax.taxableTotal)}</td>
								<td class="px-4 py-3 text-right">{formatSgd(data.individualTax.cpfEmployeeTotal)}</td>
							</tr>
						{/if}
					</tbody>
				</table>
			</div>
		</div>
	</section>

	<form method="POST" action="?/deleteEmployee">
		<button type="submit" class="rounded-md border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100">
			Archive employee
		</button>
	</form>
</PageShell>


