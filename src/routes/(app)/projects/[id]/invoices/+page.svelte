<script lang="ts">
	let { data } = $props();

	const money = (value: number, currency = 'SGD') =>
		new Intl.NumberFormat('en-SG', { style: 'currency', currency }).format(value ?? 0);

	const fmtDate = (d: string | null | undefined) => {
		if (!d) return '—';
		const raw = d.trim();
		const dt = new Date(raw.length === 10 ? `${raw}T12:00:00` : raw);
		if (Number.isNaN(dt.getTime())) return raw;
		return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(dt);
	};

	const displayStatus = (s: string | null | undefined) => {
		const t = String(s ?? '').trim();
		if (!t) return '—';
		return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
	};

	const badgeClass = (status: string | null | undefined) => {
		const s = String(status ?? '').toLowerCase();
		if (s.includes('draft')) return 'bg-[#FAEEDA] text-[#854F0B]';
		if (s.includes('paid')) return 'bg-[#EAF3DE] text-[#3B6D11]';
		if (s.includes('issued')) return 'bg-[#E6F1FB] text-[#185FA5]';
		if (s.includes('confirm')) return 'bg-[#EAF3DE] text-[#3B6D11]';
		return 'bg-slate-100 text-slate-700';
	};

	const btnNeutral =
		'inline-flex items-center justify-center rounded-md border border-slate-300/80 bg-white px-3 py-[5px] text-xs text-slate-600 hover:bg-slate-50';
	const btnDownload =
		'inline-flex items-center justify-center rounded-md border border-[#3B6D11] bg-[#EAF3DE] px-3 py-[5px] text-xs font-medium text-[#3B6D11] hover:bg-[#C0DD97]';
</script>

<div class="space-y-5">
	<section class="overflow-hidden rounded-xl border border-slate-200/90 bg-white">
		<div class="border-b border-slate-200/80 px-[18px] py-[14px]">
			<h2 class="text-[13px] font-medium text-slate-900">Invoices</h2>
			<p class="mt-0.5 text-xs text-slate-500">
				Click any row to view full record, line items, and embedded preview
			</p>
		</div>

		<div class="grid grid-cols-1 gap-px bg-slate-200/80 md:grid-cols-2">
			<!-- Customer invoices (out) -->
			<div class="flex flex-col gap-2 bg-white px-4 py-[14px]">
				<div
					class="flex items-center justify-between border-b border-slate-200/80 pb-2 text-[11px] font-medium uppercase tracking-[0.04em] text-slate-500"
				>
					Customer invoices (out)
					<span
						class="rounded-[10px] bg-slate-100 px-1.5 py-px text-[11px] font-normal normal-case tracking-normal text-slate-600"
					>
						{data.invoicesOut.length}
					</span>
				</div>

				{#if data.invoicesOut.length === 0}
					<p class="py-6 text-center text-xs text-slate-500">No customer invoices yet.</p>
				{:else}
					{#each data.invoicesOut as inv}
						<div
							class="flex flex-col gap-3 rounded-md border border-slate-200/90 bg-white px-3 py-2.5 transition-colors hover:border-slate-300 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
						>
							<div class="min-w-0 flex-1">
								<div class="flex items-center gap-2">
									<span class="truncate text-[13px] font-medium text-slate-900">{inv.invoiceNo}</span>
									<span class={`shrink-0 rounded-[10px] px-[7px] py-0.5 text-[10px] font-medium ${badgeClass(inv.status)}`}>
										{displayStatus(inv.status)}
									</span>
								</div>
								<div class="mt-1 flex flex-wrap items-center gap-2 text-xs">
									<span class="text-slate-500">{fmtDate(inv.date)}</span>
									<span class="text-slate-300">·</span>
									<span class="font-medium text-slate-900">{money(inv.total, inv.currency)}</span>
								</div>
							</div>
							<div class="flex shrink-0 flex-col gap-[5px] sm:items-stretch">
								<a class={btnNeutral} href={inv.detailHref}>View</a>
								{#if inv.fileDownloadUrl}
									<a class={btnDownload} href={inv.fileDownloadUrl}>Download</a>
								{/if}
							</div>
						</div>
					{/each}
				{/if}
			</div>

			<!-- Supplier invoices (in) -->
			<div class="flex flex-col gap-2 bg-white px-4 py-[14px]">
				<div
					class="flex items-center justify-between border-b border-slate-200/80 pb-2 text-[11px] font-medium uppercase tracking-[0.04em] text-slate-500"
				>
					Supplier invoices (in)
					<span
						class="rounded-[10px] bg-slate-100 px-1.5 py-px text-[11px] font-normal normal-case tracking-normal text-slate-600"
					>
						{data.invoicesIn.length}
					</span>
				</div>

				{#if data.invoicesIn.length === 0}
					<p class="py-6 text-center text-xs text-slate-500">No supplier invoices yet.</p>
				{:else}
					{#each data.invoicesIn as inv}
						<div
							class="flex flex-col gap-3 rounded-md border border-slate-200/90 bg-white px-3 py-2.5 transition-colors hover:border-slate-300 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
						>
							<div class="min-w-0 flex-1">
								<div class="flex items-center gap-2">
									<span class="truncate text-[13px] font-medium text-slate-900">{inv.supplierName ?? 'Supplier'}</span>
									<span class={`shrink-0 rounded-[10px] px-[7px] py-0.5 text-[10px] font-medium ${badgeClass(inv.status)}`}>
										{displayStatus(inv.status)}
									</span>
								</div>
								<div class="mt-1 flex flex-wrap items-center gap-2 text-xs">
									<span class="text-slate-500">{fmtDate(inv.invoiceDate)}</span>
									<span class="text-slate-300">·</span>
									<span class="font-medium text-slate-900">{money(inv.amount, inv.currency)}</span>
									{#if inv.poNumber}
										<span class="text-slate-300">·</span>
										<span class="font-mono text-[11px] text-slate-500">{inv.poNumber}</span>
									{/if}
								</div>
							</div>
							<div class="flex shrink-0 flex-col gap-[5px] sm:items-stretch">
								<a class={btnNeutral} href={inv.detailHref}>View</a>
								{#if inv.fileDownloadUrl}
									<a class={btnDownload} href={inv.fileDownloadUrl}>Download</a>
								{/if}
							</div>
						</div>
					{/each}
				{/if}
			</div>
		</div>
	</section>
</div>
