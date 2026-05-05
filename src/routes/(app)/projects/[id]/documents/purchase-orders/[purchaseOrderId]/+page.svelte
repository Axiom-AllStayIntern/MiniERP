<script lang="ts">
	import { goto } from '$app/navigation';
	import StorageTextPreview from '$app-layer/components/StorageTextPreview.svelte';
	import { documentPreviewMode } from '$platform/files/document-preview-mode';

	let { data, form } = $props();

	const base = $derived(`/projects/${data.project.id}`);

	const money = (value: number | null | undefined) =>
		new Intl.NumberFormat('en-SG', { style: 'currency', currency: data.purchaseOrder.currency ?? 'SGD' }).format(
			value ?? 0
		);

	const previewMode = $derived(
		documentPreviewMode({
			fileViewUrl: data.fileViewUrl,
			fileUrl: data.purchaseOrder.fileUrl,
			upload: data.docMeta.upload
		})
	);

	const fmtBytes = (n: number | undefined) => {
		if (n == null || !Number.isFinite(n)) return '-';
		if (n < 1024) return `${n} B`;
		if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
		return `${(n / (1024 * 1024)).toFixed(1)} MB`;
	};

	const fmtWhen = (iso: string | undefined) => {
		if (!iso) return '-';
		const d = new Date(iso);
		return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('en-SG');
	};
</script>

<div class="space-y-5">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<button
			type="button"
			class="text-xs font-medium text-[var(--sf-green)] hover:underline"
			onclick={() => goto(`${base}/documents`)}
		>
			�?Back to documents
		</button>
		<a
			class="text-xs font-medium text-[var(--sf-green)] hover:underline"
			href={`/finance/doc-hub/upload/project?projectId=${encodeURIComponent(data.project.id)}&docType=purchase_order`}
		>
			Upload another PO�?
		</a>
	</div>

	<section class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
		<div class="border-b border-slate-200 px-5 py-4">
			<p class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Purchase order</p>
			<h2 class="mt-1 text-lg font-medium text-slate-900">
				{data.docMeta.upload?.fileName ?? data.purchaseOrder.poNumber}
			</h2>
			<p class="mt-0.5 font-mono text-xs text-slate-400">{data.purchaseOrder.id}</p>
		</div>

		<div class="grid gap-px bg-slate-200 sm:grid-cols-2">
			<div class="bg-white px-5 py-3">
				<p class="text-[11px] font-medium uppercase tracking-wide text-slate-400">PO number</p>
				<p class="mt-1 text-sm text-slate-900">{data.purchaseOrder.poNumber}</p>
			</div>
			<div class="bg-white px-5 py-3">
				<p class="text-[11px] font-medium uppercase tracking-wide text-slate-400">Supplier</p>
				<p class="mt-1 text-sm text-slate-900">{data.purchaseOrder.supplierName ?? '-'}</p>
			</div>
			<div class="bg-white px-5 py-3">
				<p class="text-[11px] font-medium uppercase tracking-wide text-slate-400">Amount</p>
				<p class="mt-1 text-sm text-slate-900">{money(data.purchaseOrder.amount)}</p>
			</div>
			<div class="bg-white px-5 py-3">
				<p class="text-[11px] font-medium uppercase tracking-wide text-slate-400">Currency</p>
				<p class="mt-1 text-sm text-slate-900">{data.purchaseOrder.currency ?? 'SGD'}</p>
			</div>
			<div class="bg-white px-5 py-3">
				<p class="text-[11px] font-medium uppercase tracking-wide text-slate-400">PO date</p>
				<p class="mt-1 text-sm text-slate-900">{data.purchaseOrder.date ?? '-'}</p>
			</div>
			<div class="bg-white px-5 py-3">
				<p class="text-[11px] font-medium uppercase tracking-wide text-slate-400">Source</p>
				<p class="mt-1 text-sm text-slate-900">{data.docMeta.sourceType ?? '-'}</p>
			</div>
			<div class="bg-white px-5 py-3">
				<p class="text-[11px] font-medium uppercase tracking-wide text-slate-400">Parse status</p>
				<p class="mt-1 text-sm text-slate-900">{data.docMeta.parseStatus ?? '-'}</p>
			</div>
			<div class="bg-white px-5 py-3">
				<p class="text-[11px] font-medium uppercase tracking-wide text-slate-400">Storage key</p>
				<p class="mt-1 break-all font-mono text-xs text-slate-600">
					{data.purchaseOrder.fileUrl?.startsWith('manual://') ? 'Manual (no file)' : data.purchaseOrder.fileUrl}
				</p>
			</div>
			<div class="bg-white px-5 py-3 sm:col-span-2">
				<p class="text-[11px] font-medium uppercase tracking-wide text-slate-400">Upload</p>
				{#if data.docMeta.upload}
					<p class="mt-1 text-sm text-slate-800">{data.docMeta.upload.fileName}</p>
					<p class="mt-0.5 text-xs text-slate-500">
						{data.docMeta.upload.contentType} · {fmtBytes(data.docMeta.upload.size)} · {fmtWhen(
							data.docMeta.upload.uploadedAt
						)}
					</p>
				{:else}
					<p class="mt-1 text-sm text-slate-500">No upload metadata on file.</p>
				{/if}
			</div>
			<div class="bg-white px-5 py-3 sm:col-span-2">
				<p class="text-[11px] font-medium uppercase tracking-wide text-slate-400">Created / updated</p>
				<p class="mt-1 text-sm text-slate-800">
					{fmtWhen(data.purchaseOrder.createdAt)} · {fmtWhen(data.purchaseOrder.updatedAt)}
				</p>
			</div>
		</div>
	</section>

	{#if data.docMeta.notes}
		<section class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
			<div class="border-b border-slate-200 px-5 py-3">
				<h3 class="text-[13px] font-medium text-slate-900">Notes &amp; extracted details</h3>
			</div>
			<div class="px-5 py-4">
				<pre class="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-slate-700">{data.docMeta.notes}</pre>
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
					No file attached (manual entry or pending upload).
				</p>
			{:else if previewMode === 'pdf'}
				<iframe
					class="h-[min(75vh,900px)] w-full rounded-lg border border-slate-200 bg-slate-100"
					title="Purchase order PDF preview"
					src={data.fileViewUrl}
				></iframe>
			{:else if previewMode === 'image'}
				<div class="flex justify-center rounded-lg border border-slate-200 bg-slate-50 p-4">
					<img
						class="max-h-[min(75vh,900px)] max-w-full object-contain"
						alt="Purchase order attachment preview"
						src={data.fileViewUrl}
					/>
				</div>
			{:else if previewMode === 'text' && data.fileViewUrl}
				<p class="mb-2 text-xs text-slate-500">Extracted text (Word, plain text, CSV, etc.)</p>
				<StorageTextPreview fileViewUrl={data.fileViewUrl} />
			{:else}
				<p class="text-sm text-slate-600">
					Inline preview is not available for this file type (e.g. Excel, PowerPoint, or legacy .doc).
					<a class="ml-1 font-medium text-[var(--sf-green)] hover:underline" href={data.fileViewUrl} target="_blank" rel="noreferrer"
						>Open / download</a
					>
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
			<label class="block space-y-1 text-xs font-medium text-slate-700">
				PO number
				<input
					class="h-9 w-full rounded-md border border-slate-300 px-2.5 text-sm"
					name="poNumber"
					required
					value={data.purchaseOrder.poNumber}
				/>
			</label>
			<label class="block space-y-1 text-xs font-medium text-slate-700">
				Supplier
				<input
					class="h-9 w-full rounded-md border border-slate-300 px-2.5 text-sm"
					name="supplierName"
					required
					value={data.purchaseOrder.supplierName ?? ''}
				/>
			</label>
			<div class="grid gap-3 sm:grid-cols-2">
				<label class="block space-y-1 text-xs font-medium text-slate-700">
					Amount
					<input
						class="h-9 w-full rounded-md border border-slate-300 px-2.5 text-sm"
						name="amount"
						type="number"
						step="0.01"
						value={data.purchaseOrder.amount ?? 0}
					/>
				</label>
				<label class="block space-y-1 text-xs font-medium text-slate-700">
					Currency
					<input
						class="h-9 w-full rounded-md border border-slate-300 px-2.5 text-sm"
						name="currency"
						value={data.purchaseOrder.currency ?? 'SGD'}
					/>
				</label>
				<label class="block space-y-1 text-xs font-medium text-slate-700 sm:col-span-2">
					Date
					<input
						class="h-9 w-full rounded-md border border-slate-300 px-2.5 text-sm"
						name="date"
						type="date"
						value={data.purchaseOrder.date ?? ''}
					/>
				</label>
				<label class="block space-y-1 text-xs font-medium text-slate-700 sm:col-span-2">
					Notes (stored in metadata)
					<input
						class="h-9 w-full rounded-md border border-slate-300 px-2.5 text-sm"
						name="notes"
						value={data.docMeta.notes ?? ''}
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
					Delete record
				</button>
			</form>
		</div>
	</details>
</div>


