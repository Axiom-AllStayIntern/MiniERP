<script lang="ts">
	import { goto } from '$app/navigation';

	let { data, form } = $props();

	const base = $derived(`/projects/${data.project.id}`);
	const invoicesList = $derived(`${base}/invoices`);

	const money = (value: number | null | undefined, currency = data.invoice.currency) =>
		new Intl.NumberFormat('en-SG', { style: 'currency', currency: currency ?? 'SGD' }).format(value ?? 0);

	const storageKey = $derived(data.invoice.fileUrl ?? '');

	const displayTitle = $derived.by(() => {
		const tail = storageKey.split('/').pop() ?? storageKey;
		try {
			return decodeURIComponent(tail) || data.invoice.supplierName || 'Supplier invoice';
		} catch {
			return tail || data.invoice.supplierName || 'Supplier invoice';
		}
	});

	const previewMode = $derived.by((): 'pdf' | 'image' | 'none' | 'other' => {
		if (!data.fileViewUrl) return 'none';
		const fn = (data.docMeta.upload?.fileName ?? storageKey.split('/').pop() ?? '').toLowerCase();
		const ct = (data.docMeta.upload?.contentType ?? '').toLowerCase();
		if (ct.includes('pdf') || fn.endsWith('.pdf')) return 'pdf';
		if (ct.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/i.test(fn)) return 'image';
		return 'other';
	});

	const fmtWhen = (iso: string | undefined) => {
		if (!iso) return '—';
		const d = new Date(iso);
		return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('en-SG');
	};
</script>

<div class="space-y-5">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<div class="flex flex-wrap gap-3">
			<button
				type="button"
				class="text-xs font-medium text-[var(--sf-green)] hover:underline"
				onclick={() => goto(invoicesList)}
			>
				← Back to invoices
			</button>
			<button
				type="button"
				class="text-xs font-medium text-slate-500 hover:underline"
				onclick={() => goto(base)}
			>
				Project overview
			</button>
		</div>
	</div>

	<section class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
		<div class="border-b border-slate-200 px-5 py-4">
			<p class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Supplier invoice</p>
			<h2 class="mt-1 text-lg font-medium text-slate-900">{displayTitle}</h2>
			<p class="mt-0.5 font-mono text-xs text-slate-400">{data.invoice.id}</p>
		</div>

		<div class="grid gap-px bg-slate-200 sm:grid-cols-2">
			<div class="bg-white px-5 py-3 sm:col-span-2">
				<p class="text-[11px] font-medium uppercase tracking-wide text-slate-400">Supplier</p>
				<p class="mt-1 text-sm text-slate-900">{data.invoice.supplierName ?? '—'}</p>
			</div>
			<div class="bg-white px-5 py-3">
				<p class="text-[11px] font-medium uppercase tracking-wide text-slate-400">Invoice date</p>
				<p class="mt-1 text-sm text-slate-900">{data.invoice.invoiceDate ?? '—'}</p>
			</div>
			<div class="bg-white px-5 py-3">
				<p class="text-[11px] font-medium uppercase tracking-wide text-slate-400">Due date</p>
				<p class="mt-1 text-sm text-slate-900">{data.invoice.dueDate ?? '—'}</p>
			</div>
			<div class="bg-white px-5 py-3">
				<p class="text-[11px] font-medium uppercase tracking-wide text-slate-400">Status</p>
				<p class="mt-1 text-sm text-slate-900">{data.invoice.status}</p>
			</div>
			<div class="bg-white px-5 py-3">
				<p class="text-[11px] font-medium uppercase tracking-wide text-slate-400">PO number</p>
				<p class="mt-1 text-sm text-slate-900">{data.invoice.poNumber ?? '—'}</p>
			</div>
			<div class="bg-white px-5 py-3">
				<p class="text-[11px] font-medium uppercase tracking-wide text-slate-400">Amount</p>
				<p class="mt-1 text-sm text-slate-900">{money(data.invoice.amount)}</p>
			</div>
			<div class="bg-white px-5 py-3">
				<p class="text-[11px] font-medium uppercase tracking-wide text-slate-400">GST</p>
				<p class="mt-1 text-sm text-slate-900">{money(data.invoice.gstAmount)}</p>
			</div>
			<div class="bg-white px-5 py-3">
				<p class="text-[11px] font-medium uppercase tracking-wide text-slate-400">OCR confidence</p>
				<p class="mt-1 text-sm text-slate-900">{data.invoice.ocrConfidence ?? '—'}</p>
			</div>
			<div class="bg-white px-5 py-3 sm:col-span-2">
				<p class="text-[11px] font-medium uppercase tracking-wide text-slate-400">Storage key</p>
				<p class="mt-1 break-all font-mono text-xs text-slate-600">{data.invoice.fileUrl}</p>
			</div>
			<div class="bg-white px-5 py-3 sm:col-span-2">
				<p class="text-[11px] font-medium uppercase tracking-wide text-slate-400">Created / updated</p>
				<p class="mt-1 text-sm text-slate-800">
					{fmtWhen(data.invoice.createdAt)} · {fmtWhen(data.invoice.updatedAt)}
				</p>
			</div>
		</div>
	</section>

	{#if data.notesBlock}
		<section class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
			<div class="border-b border-slate-200 px-5 py-3">
				<h3 class="text-[13px] font-medium text-slate-900">Notes &amp; OCR / extracted data</h3>
			</div>
			<div class="px-5 py-4">
				<pre class="max-h-72 overflow-auto whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-slate-700">{data.notesBlock}</pre>
			</div>
		</section>
	{/if}

	<section class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
		<div class="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
			<div>
				<h3 class="text-[13px] font-medium text-slate-900">File preview</h3>
				<p class="mt-0.5 text-xs text-slate-500">Served from your R2 bucket via /api/files (local dev needs R2 binding).</p>
			</div>
			{#if data.fileDownloadUrl}
				<a
					class="shrink-0 rounded-md bg-[var(--sf-green)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#2f5e2c]"
					href={data.fileDownloadUrl}
				>
					Download
				</a>
			{/if}
		</div>
		<div class="p-4">
			{#if previewMode === 'none'}
				<p class="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
					No file attached.
				</p>
			{:else if previewMode === 'pdf'}
				<iframe
					class="h-[min(75vh,900px)] w-full rounded-lg border border-slate-200 bg-slate-100"
					title="Supplier invoice PDF preview"
					src={data.fileViewUrl}
				></iframe>
			{:else if previewMode === 'image'}
				<div class="flex justify-center rounded-lg border border-slate-200 bg-slate-50 p-4">
					<img
						class="max-h-[min(75vh,900px)] max-w-full object-contain"
						alt="Supplier invoice attachment"
						src={data.fileViewUrl}
					/>
				</div>
			{:else}
				<p class="text-sm text-slate-600">
					Preview is not embedded for this file type.
					<a class="ml-1 font-medium text-[var(--sf-green)] hover:underline" href={data.fileViewUrl} target="_blank" rel="noreferrer"
						>Open in new tab</a
					>
					{#if data.fileDownloadUrl}
						<span class="text-slate-300"> · </span>
						<a class="font-medium text-[var(--sf-green)] hover:underline" href={data.fileDownloadUrl}>Download</a>
					{/if}
				</p>
			{/if}
		</div>
	</section>

	{#if form?.message}
		<p class="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{form.message}</p>
	{/if}

	<details class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
		<summary class="cursor-pointer border-b border-slate-200 px-5 py-4 text-[13px] font-medium text-slate-900">
			Edit fields
		</summary>
		<form class="space-y-4 p-5" method="POST" action="?/update">
			<div class="grid gap-3 sm:grid-cols-2">
				<label class="block space-y-1 text-xs font-medium text-slate-700 sm:col-span-2">
					Supplier name
					<input
						class="h-9 w-full rounded-md border border-slate-300 px-2.5 text-sm"
						name="supplierName"
						value={data.invoice.supplierName ?? ''}
					/>
				</label>
				<label class="block space-y-1 text-xs font-medium text-slate-700">
					Status
					<input class="h-9 w-full rounded-md border border-slate-300 px-2.5 text-sm" name="status" value={data.invoice.status} />
				</label>
				<label class="block space-y-1 text-xs font-medium text-slate-700">
					Invoice date
					<input
						class="h-9 w-full rounded-md border border-slate-300 px-2.5 text-sm"
						name="invoiceDate"
						type="date"
						value={data.invoice.invoiceDate ?? ''}
					/>
				</label>
				<label class="block space-y-1 text-xs font-medium text-slate-700">
					Amount
					<input
						class="h-9 w-full rounded-md border border-slate-300 px-2.5 text-sm"
						name="amount"
						type="number"
						step="0.01"
						value={data.invoice.amount}
					/>
				</label>
				<label class="block space-y-1 text-xs font-medium text-slate-700">
					GST amount
					<input
						class="h-9 w-full rounded-md border border-slate-300 px-2.5 text-sm"
						name="gstAmount"
						type="number"
						step="0.01"
						value={data.invoice.gstAmount}
					/>
				</label>
				<label class="block space-y-1 text-xs font-medium text-slate-700 sm:col-span-2">
					PO number
					<input
						class="h-9 w-full rounded-md border border-slate-300 px-2.5 text-sm"
						name="poNumber"
						value={data.invoice.poNumber ?? ''}
					/>
				</label>
			</div>
			<button
				class="rounded-md bg-[var(--sf-green)] px-4 py-2 text-sm font-medium text-white hover:bg-[#2f5e2c]"
				type="submit"
			>
				Save changes
			</button>
		</form>
		<div class="border-t border-slate-200 px-5 py-4">
			<form method="POST" action="?/delete">
				<button
					class="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 hover:bg-rose-100"
					type="submit"
				>
					Delete invoice
				</button>
			</form>
		</div>
	</details>
</div>
