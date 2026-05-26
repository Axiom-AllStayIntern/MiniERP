<script lang="ts">
	import PageShell from '$app-layer/components/PageShell.svelte';
	let { data } = $props();

	const money = (value: number) =>
		new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD' }).format(value ?? 0);

	const boxRows = [
		{ code: 1, key: 'box1', label: 'Standard-rated supplies' },
		{ code: 2, key: 'box2', label: 'Zero-rated supplies' },
		{ code: 3, key: 'box3', label: 'Exempt supplies' },
		{ code: 4, key: 'box4', label: 'Total supplies' },
		{ code: 5, key: 'box5', label: 'Taxable purchases' },
		{ code: 6, key: 'box6', label: 'Output tax due' },
		{ code: 7, key: 'box7', label: 'Input tax and refunds' },
		{ code: 8, key: 'box8', label: 'GST payable / claimable' },
		{
			code: 9,
			key: 'box9',
			label: 'Total value of exempt imports under approved import schemes (e.g. MES / ISE)'
		},
		{ code: 10, key: 'box10', label: 'Output tax due under reverse charge' },
		{ code: 11, key: 'box11', label: 'Value of taxable purchases under reverse charge' },
		{ code: 12, key: 'box12', label: 'Value of imported services subject to reverse charge' },
		{ code: 13, key: 'box13', label: 'Revenue for period' }
	] as const;

	type BoxKey = (typeof boxRows)[number]['key'];

	function boxesFromGst(boxes: typeof data.gst.boxes): Record<BoxKey, number> {
		const n = (v: unknown) => {
			const x = Number(v);
			return Number.isFinite(x) ? x : 0;
		};
		return {
			box1: n(boxes.box1),
			box2: n(boxes.box2),
			box3: n(boxes.box3),
			box4: n(boxes.box4),
			box5: n(boxes.box5),
			box6: n(boxes.box6),
			box7: n(boxes.box7),
			box8: n(boxes.box8),
			box9: n(boxes.box9),
			box10: n(boxes.box10),
			box11: n(boxes.box11),
			box12: n(boxes.box12),
			box13: n(boxes.box13)
		};
	}

	let tempEditMode = $state(false);
	let tempBoxes = $state<Record<BoxKey, number>>(boxesFromGst(data.gst.boxes));
	let exportingF5 = $state(false);

	async function exportGstF5() {
		exportingF5 = true;
		try {
			const response = await fetch(`/api/finance/tax/gst/${data.year}/${data.quarter}/f5`);
			const result = (await response.json()) as { ok: boolean; data?: unknown };
			if (result.ok) {
				const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = `GST-F5-${data.year}-Q${data.quarter}.json`;
				a.click();
				URL.revokeObjectURL(url);
			}
		} finally {
			exportingF5 = false;
		}
	}

	/** After loading a period or server refresh: sync draft boxes from server totals (not from in-progress local edits). */
	$effect(() => {
		const y = data.year;
		const q = data.quarter;
		const fingerprint = `${y}|${q}|${boxRows.map((r) => data.gst.boxes[r.key]).join('|')}`;
		void fingerprint;
		tempBoxes = boxesFromGst(data.gst.boxes);
	});

	const displayValue = (key: BoxKey) => (tempEditMode ? tempBoxes[key] : data.gst.boxes[key]);
</script>

<PageShell
	eyebrow="Tax"
	title="Tax Management"
	description="Quarterly GST box summary with drill-down to invoice-level details."
>
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-2">
			<span class="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
				GST Rate: {data.gst.gstRate ?? 9}%
			</span>
			<span class="text-xs text-slate-500">Singapore — IRAS GST F5</span>
		</div>
		<div class="flex gap-2">
			<button
				type="button"
				class="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
				onclick={() => {
					if (!tempEditMode) {
						tempBoxes = boxesFromGst(data.gst.boxes);
					}
					tempEditMode = !tempEditMode;
				}}
			>
				{tempEditMode ? 'Exit Temp Edit' : 'Edit GST (Temp)'}
			</button>
			<button
				type="button"
				class="rounded-md bg-[var(--sf-green)] px-3 py-2 text-sm font-medium text-white hover:bg-[#2f5e2c] disabled:opacity-50"
				disabled={exportingF5}
				onclick={exportGstF5}
			>
				{exportingF5 ? 'Exporting…' : 'Export GST F5'}
			</button>
			<a
				class="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
				href={`/finance/tax/settings?year=${data.year}&quarter=${data.quarter}`}
			>
				Manual Box 9-12
			</a>
		</div>
	</div>

	{#if tempEditMode}
		<section class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
			<p class="font-medium">Temporary edit mode is on</p>
			<p class="mt-1">Edits apply to current page view only. Clicking <strong>Load Period</strong> recalculates from database and resets temporary values.</p>
		</section>
	{/if}

	<form method="GET" class="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-4">
		<label class="text-sm text-slate-600">
			Year
			<input
				type="number"
				name="year"
				value={data.year}
				class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
			/>
		</label>
		<label class="text-sm text-slate-600">
			Quarter
			<select
				name="quarter"
				value={`${data.quarter}`}
				class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
			>
				<option value="1">Q1</option>
				<option value="2">Q2</option>
				<option value="3">Q3</option>
				<option value="4">Q4</option>
			</select>
		</label>
		<div class="flex items-end">
			<button class="rounded-lg bg-[var(--sf-green)] px-4 py-2 text-sm font-medium text-white" type="submit">
				Load Period
			</button>
		</div>
		<p class="flex items-end text-sm text-slate-500">
			Range: {data.gst.range.start || '--'} to {data.gst.range.end || '--'}
		</p>
	</form>

	<section class="grid gap-4 md:grid-cols-3">
		<article class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
			<p class="text-xs text-slate-500">Corporate Taxable Income ({data.corporatePreview.year})</p>
			<p class="mt-2 text-xl font-semibold text-slate-900">{money(data.corporatePreview.taxableIncome)}</p>
		</article>
		<article class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
			<p class="text-xs text-slate-500">Corporate Tax Payable</p>
			<p class="mt-2 text-xl font-semibold text-slate-900">{money(data.corporatePreview.taxPayable)}</p>
		</article>
		<article class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
			<p class="text-xs text-slate-500">Effective Tax Rate</p>
			<p class="mt-2 text-xl font-semibold text-slate-900">
				{(data.corporatePreview.effectiveRate * 100).toFixed(2)}%
			</p>
			<a class="mt-2 inline-block text-sm text-[var(--sf-green)] hover:text-[#2f5e2c]" href={`/finance/tax/corporate?year=${data.year}`}>
				Open Corporate Tax Detail
			</a>
		</article>
	</section>

	<div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
		<table class="min-w-full divide-y divide-slate-200 text-sm">
			<thead class="bg-slate-50 text-left text-slate-600">
				<tr>
					<th class="px-4 py-3">Box</th>
					<th class="px-4 py-3">Description</th>
					<th class="px-4 py-3">Amount</th>
					<th class="px-4 py-3">Details</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#each boxRows as box}
					<tr class="hover:bg-slate-50">
						<td class="px-4 py-3 font-semibold text-slate-700">Box {box.code}</td>
						<td class="px-4 py-3">{box.label}</td>
						<td class="px-4 py-3">
							{#if tempEditMode}
								<input
									type="number"
									step="0.01"
									class="w-44 min-w-[11rem] rounded-md border border-slate-300 px-2 py-1 text-sm tabular-nums"
									value={tempBoxes[box.key]}
									oninput={(e) => {
										const raw = e.currentTarget.value;
										const parsed = raw === '' ? 0 : Number.parseFloat(raw);
										const next = Number.isFinite(parsed) ? parsed : 0;
										tempBoxes = { ...tempBoxes, [box.key]: next };
									}}
								/>
							{:else}
								{money(displayValue(box.key))}
							{/if}
						</td>
						<td class="px-4 py-3">
							<a
								class="text-[var(--sf-green)] hover:text-[#2f5e2c]"
								href={`/finance/tax/gst/${data.year}/${data.quarter}/box/${box.code}`}
							>
								View
							</a>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	{#if data.gst.meta?.notes && data.gst.meta.notes.length > 0}
		<section class="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
			<p class="font-medium text-slate-700">Calculation Notes</p>
			<ul class="mt-2 list-disc space-y-1 pl-5">
				{#each data.gst.meta.notes as note}
					<li>{note}</li>
				{/each}
			</ul>
		</section>
	{/if}
</PageShell>


