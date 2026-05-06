<script lang="ts">
	import { invalidate } from '$app/navigation';
	import PageShell from '$app-layer/components/PageShell.svelte';
	import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
	import { EXPENSE_UPLOAD_CURRENCIES } from '$modules/finance/schemas/expense-upload';

	let { data } = $props();

	type ProjectInfo = {
		id: string;
		name: string;
		customerName: string | null;
		status: string;
		startDate: string | null;
		endDate: string | null;
	};

	let selectedProject = $state<ProjectInfo | null>(null);

	$effect(() => {
		const incoming = data.preselectedProject;
		if (incoming) selectedProject = incoming;
	});

	let showProjectPicker = $state(false);
	let projectSearchQ = $state('');
	let projectSearchStatus = $state('');
	let projectSearchStartedAfter = $state('');
	let projectSearchResults = $state<ProjectInfo[]>([]);
	let projectSearching = $state(false);

	const pageTitle = $derived(
		selectedProject ? `Upload customer invoice �?${selectedProject.name}` : 'Upload customer invoice'
	);

	async function searchProjects() {
		projectSearching = true;
		try {
			const params = new URLSearchParams();
			if (projectSearchQ) params.set('q', projectSearchQ);
			if (projectSearchStatus) params.set('status', projectSearchStatus);
			const res = await fetch(`/api/projects?${params.toString()}`);
			const json = (await res.json()) as {
				ok?: boolean;
				data?: Array<{
					project: {
						id: string;
						name: string;
						status: string;
						startDate: string | null;
						endDate: string | null;
					};
					customerName: string | null;
				}>;
			};
			if (json.ok && json.data) {
				projectSearchResults = json.data
					.filter((r) => {
						if (!projectSearchStartedAfter) return true;
						return (r.project.startDate ?? '') >= projectSearchStartedAfter;
					})
					.map((r) => ({
						id: r.project.id,
						name: r.project.name,
						customerName: r.customerName,
						status: r.project.status,
						startDate: r.project.startDate,
						endDate: r.project.endDate
					}));
			}
		} catch {
			/* ignore */
		} finally {
			projectSearching = false;
		}
	}

	function pickProject(p: ProjectInfo) {
		selectedProject = p;
		showProjectPicker = false;
	}

	function clearProject() {
		selectedProject = null;
	}

	let selectedFile = $state<File | null>(null);
	let previewUrl = $state<string | null>(null);
	let previewZoomPct = $state(100);
	const previewScale = $derived(previewZoomPct / 100);

	let uploading = $state(false);
	let detecting = $state(false);
	let message = $state('');
	let error = $state('');
	let detectRawText = $state('');
	let savedEntityId = $state<string | null>(null);
	let savedInvoiceNo = $state<string | null>(null);
	let duplicateRevenueEntityId = $state<string | null>(null);

	let invoiceNo = $state('');
	let invoiceDate = $state(new Date().toISOString().slice(0, 10));
	let invoiceDueDate = $state('');
	let currency = $state('SGD');
	let total = $state('');
	let gstAmount = $state('');
	let gstType = $state<'standard' | 'zero' | 'exempt'>('standard');
	let customerName = $state('');
	let poNumber = $state('');

	let reissueOnSave = $state(false);
	let duplicateInvoicePending = $state(false);

	$effect(() => {
		if (!selectedFile) {
			previewUrl = null;
			return;
		}
		const f = selectedFile;
		const isPdf = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
		const isImg = f.type.startsWith('image/');
		if (!isPdf && !isImg) {
			previewUrl = null;
			return;
		}
		const url = URL.createObjectURL(f);
		previewUrl = url;
		return () => URL.revokeObjectURL(url);
	});

	function setPreviewZoom(next: number): void {
		previewZoomPct = Math.min(200, Math.max(50, Math.round(next / 5) * 5));
	}

	let _pdfJsCache: (typeof import('pdfjs-dist')) | null = null;

	async function loadPdfJs() {
		if (_pdfJsCache) return _pdfJsCache;
		const lib = await import('pdfjs-dist');
		lib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
		_pdfJsCache = lib;
		return lib;
	}

	async function extractPdfTextClient(file: File): Promise<string> {
		const pdfjs = await loadPdfJs();
		const data = new Uint8Array(await file.arrayBuffer());
		const pdf = await Promise.race([
			pdfjs.getDocument({ data }).promise,
			new Promise<never>((_, reject) => setTimeout(() => reject(new Error('PDF parse timeout')), 15000))
		]);
		const maxPages = Math.min(pdf.numPages, 8);
		const chunks: string[] = [];
		for (let i = 1; i <= maxPages; i++) {
			const page = await pdf.getPage(i);
			const content = await page.getTextContent();
			const line = content.items
				.map((item) => ('str' in item ? item.str : ''))
				.join(' ')
				.replace(/\s+/g, ' ')
				.trim();
			if (line) chunks.push(line);
		}
		return chunks.join('\n').trim();
	}

	async function renderPdfFirstPageToJpeg(file: File): Promise<Blob | null> {
		try {
			const pdfjs = await loadPdfJs();
			const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
			if (pdf.numPages < 1) return null;
			const page = await pdf.getPage(1);
			const viewport = page.getViewport({
				scale: Math.min(2.5, 1600 / Math.max(page.getViewport({ scale: 1 }).width, 1))
			});
			const canvas = document.createElement('canvas');
			canvas.width = Math.ceil(viewport.width);
			canvas.height = Math.ceil(viewport.height);
			const ctx = canvas.getContext('2d');
			if (!ctx) return null;
			await page.render({ canvasContext: ctx, viewport, canvas }).promise;
			return await new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.88));
		} catch {
			return null;
		}
	}

	async function runWorkersVisionOcr(blob: Blob, fileName: string): Promise<string> {
		const fd = new FormData();
		fd.append('file', blob, fileName);
		const res = await fetch('/api/ocr/workers-vision', { method: 'POST', body: fd });
		const payload = (await res.json()) as { ok?: boolean; data?: { text?: string }; error?: string };
		if (!res.ok || !payload.ok || typeof payload.data?.text !== 'string') {
			throw new Error(payload.error ?? `Workers AI vision OCR failed (${res.status})`);
		}
		return payload.data.text;
	}

	function onPickFile(event: Event): void {
		const input = event.currentTarget as HTMLInputElement;
		selectedFile = input.files?.[0] ?? null;
		message = '';
		error = '';
		detectRawText = '';
		savedEntityId = null;
		savedInvoiceNo = null;
		reissueOnSave = false;
		duplicateInvoicePending = false;
		previewZoomPct = 100;
	}

	function applySuggestions(s: Record<string, unknown>) {
		if (typeof s.invoiceNo === 'string' && s.invoiceNo.trim()) invoiceNo = s.invoiceNo.trim();
		if (typeof s.invoiceDate === 'string' && s.invoiceDate.trim()) invoiceDate = s.invoiceDate.trim();
		if (typeof s.invoiceDueDate === 'string' && s.invoiceDueDate.trim()) invoiceDueDate = s.invoiceDueDate.trim();
		if (typeof s.invoiceCurrency === 'string' && s.invoiceCurrency.trim()) currency = s.invoiceCurrency.trim();
		if (typeof s.invoiceAmount === 'number' && Number.isFinite(s.invoiceAmount)) total = String(s.invoiceAmount);
		if (typeof s.invoiceGstAmount === 'number' && Number.isFinite(s.invoiceGstAmount))
			gstAmount = String(s.invoiceGstAmount);
		if (typeof s.customerName === 'string' && s.customerName.trim()) customerName = s.customerName.trim();
		if (typeof s.poNumber === 'string' && s.poNumber.trim()) poNumber = s.poNumber.trim();
	}

	async function runDetect(): Promise<void> {
		if (!selectedFile) return;
		detecting = true;
		error = '';
		message = '';
		reissueOnSave = false;
		duplicateInvoicePending = false;
		try {
			const fd = new FormData();
			fd.set('file', selectedFile);

			const mime = selectedFile.type.toLowerCase();
			const fname = selectedFile.name.toLowerCase();
			const isPdf = mime === 'application/pdf' || fname.endsWith('.pdf');
			const isImage = mime.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(fname);

			if (isImage) {
				const ocrText = await runWorkersVisionOcr(selectedFile, selectedFile.name);
				if (ocrText.trim()) fd.set('rawText', ocrText);
			} else if (isPdf) {
				try {
					const text = await extractPdfTextClient(selectedFile);
					if (text.trim().length >= 48) {
						fd.set('rawText', text);
					} else {
						const jpeg = await renderPdfFirstPageToJpeg(selectedFile);
						if (jpeg) {
							const baseName = fname.replace(/\.pdf$/i, '') || 'document';
							const ocrText = await runWorkersVisionOcr(jpeg, `${baseName}-p1.jpg`);
							if (ocrText.trim()) fd.set('rawText', ocrText);
						}
					}
				} catch {
					/* fall back to server-side extraction */
				}
			}

			const res = await fetch('/api/finance/revenue-invoice/detect', { method: 'POST', body: fd });
			const txt = await res.text();
			let json: {
				ok?: boolean;
				error?: string;
				details?: { message?: string };
				data?: {
					suggestions?: Record<string, unknown>;
					rawTextPreview?: string;
					rawTextLength?: number;
					ocr?: { warnings?: string[] };
					llm?: { provider?: string };
				};
			} | null = null;
			try {
				json = txt ? JSON.parse(txt) : null;
			} catch {
				/* ignore */
			}
			if (!res.ok || !json?.ok) {
				const detailMsg = json?.details?.message;
				throw new Error([json?.error || 'Detection failed', detailMsg, txt].filter(Boolean).join(': '));
			}
			const d = json.data ?? {};
			detectRawText = typeof d.rawTextPreview === 'string' ? d.rawTextPreview : '';
			if (d.suggestions) applySuggestions(d.suggestions);

			const conf =
				typeof d.rawTextLength === 'number' ? `, ${d.rawTextLength} characters extracted` : '';
			const warn = (d.ocr?.warnings ?? []).length ? `\nNote: ${(d.ocr?.warnings ?? []).join('; ')}` : '';
			const prov = d.llm?.provider ? ` (${d.llm.provider})` : '';
			message = `OCR + AI completed${prov}${conf}. Please review before saving.${warn}`;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Detection failed';
		} finally {
			detecting = false;
		}
	}

	async function upload(): Promise<void> {
		if (!selectedFile) {
			error = 'Please choose a file first.';
			return;
		}
		if (!selectedProject) {
			error = 'Please link a project first (customer invoices must be project-linked).';
			return;
		}
		const totalNum = Number(total);
		if (!Number.isFinite(totalNum) || totalNum <= 0) {
			error = 'Please enter a valid gross total amount (greater than 0).';
			return;
		}
		if (!invoiceDate?.trim()) {
			error = 'Please provide the invoice date.';
			return;
		}

		uploading = true;
		error = '';
		message = '';
		if (!reissueOnSave) duplicateInvoicePending = false;
		duplicateRevenueEntityId = null;

		try {
			const entityId = crypto.randomUUID();
			const presignRes = await fetch('/api/upload/presign', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					fileName: selectedFile.name,
					contentType: selectedFile.type || 'application/octet-stream',
					projectId: selectedProject.id,
					entityType: 'invoice_out',
					entityId
				})
			});
			const presignTxt = await presignRes.text();
			let presignJson: { ok?: boolean; error?: string; data?: { key: string; uploadUrl: string } } | null =
				null;
			try {
				presignJson = presignTxt ? JSON.parse(presignTxt) : null;
			} catch {
				/* ignore */
			}
			if (!presignRes.ok || !presignJson?.ok || !presignJson?.data) {
				throw new Error(
					presignJson?.error || presignTxt || `Could not create upload target (${presignRes.status})`
				);
			}

			const putRes = await fetch(presignJson.data.uploadUrl, {
				method: 'PUT',
				headers: { 'content-type': selectedFile.type || 'application/octet-stream' },
				body: selectedFile
			});
			if (!putRes.ok) throw new Error('File upload to storage failed');

			const gstNum = gstAmount.trim() ? Number(gstAmount) : 0;
			const payload: Record<string, unknown> = {
				idempotencyKey: crypto.randomUUID(),
				key: presignJson.data.key,
				fileName: selectedFile.name,
				fileType: selectedFile.type || 'application/octet-stream',
				fileSize: selectedFile.size,
				projectId: selectedProject.id,
				docType: 'invoice_out',
				invoiceOutNo: invoiceNo.trim(),
				invoiceOutDate: invoiceDate.trim(),
				invoiceOutDueDate: invoiceDueDate.trim() || null,
				invoiceOutCurrency: currency.trim() || 'SGD',
				invoiceOutTotal: totalNum,
				invoiceOutGstAmount: Number.isFinite(gstNum) ? gstNum : 0,
				invoiceOutGstType: gstType,
				invoiceOutCustomer: customerName.trim() || null,
				invoiceOutReissueNumber: reissueOnSave,
				rawDetectedText: detectRawText || null
			};

			const saveRes = await fetch('/api/finance/save-project-document', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(payload)
			});
			const saveTxt = await saveRes.text();
			let saveJson: {
				ok?: boolean;
				error?: string;
				details?: { code?: string; invoiceNo?: string; existingEntityId?: string; message?: string };
				data?: { entityId?: string; invoiceNo?: string };
			} | null = null;
			try {
				saveJson = saveTxt ? JSON.parse(saveTxt) : null;
			} catch {
				/* ignore */
			}

			if (saveRes.status === 409 && saveJson?.details?.code === 'DUPLICATE_INVOICE_NO') {
				duplicateInvoicePending = true;
				error = `Invoice number "${saveJson.details.invoiceNo ?? invoiceNo}" already exists. Edit the number, or use a system-generated number to continue.`;
				return;
			}
			if (saveRes.status === 409 && saveJson?.details?.code === 'DUPLICATE_FILE_UPLOAD') {
				duplicateRevenueEntityId = saveJson.details.existingEntityId ?? null;
				error = duplicateRevenueEntityId
					? 'This file has already been recorded as a customer invoice. Duplicate upload is not allowed. You can open the existing record below.'
					: 'This file has already been recorded as a customer invoice. Duplicate upload is not allowed.';
				return;
			}

			if (!saveRes.ok || !saveJson?.ok) {
				const detailMsg = saveJson?.details && typeof saveJson.details === 'object' ? (saveJson.details as { message?: string }).message : undefined;
				throw new Error([saveJson?.error || 'Save failed', detailMsg, saveTxt].filter(Boolean).join(': '));
			}

			savedEntityId = saveJson.data?.entityId ?? null;
			savedInvoiceNo = saveJson.data?.invoiceNo ?? null;
			reissueOnSave = false;
			duplicateInvoicePending = false;
			message = `Customer invoice saved${savedInvoiceNo ? ` (${savedInvoiceNo})` : ''}.`;
			const pid = selectedProject.id;
			void invalidate(`app:project-activity:${pid}`);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Upload failed';
		} finally {
			uploading = false;
		}
	}
</script>

<PageShell
	eyebrow="Finance / Revenue"
	title={pageTitle}
	description="Upload customer-side invoice PDFs/images, use OCR + AI to prefill fields, then save to project customer invoices (invoice_out)."
>
	{#snippet actions()}
		<div class="flex flex-wrap items-center gap-2">
			{#if selectedProject}
				<span
					class="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800"
				>
					<span class="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
					{selectedProject.name}
					{#if selectedProject.customerName}
						<span class="text-emerald-600">({selectedProject.customerName})</span>
					{/if}
					<button
						type="button"
						class="ml-1 text-emerald-500 hover:text-emerald-800"
						onclick={clearProject}
						title="Unlink"
					>
						�?
					</button>
				</span>
			{/if}
			<button
				type="button"
				class="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
				onclick={() => {
					showProjectPicker = true;
					void searchProjects();
				}}
			>
				<span aria-hidden="true">📁</span>
				{selectedProject ? 'Change Project' : 'Link Project'}
			</button>
		</div>
	{/snippet}

	<div class="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:gap-8">
		<section class="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
			<h2 class="text-sm font-semibold text-slate-900">Customer invoice intake</h2>
			<div class="mt-4 space-y-4">
				<div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
					Project link is required. Verify amount and dates before saving. This is AR customer billing (opposite flow of supplier/AP invoices).
				</div>

				<label class="block">
					<span class="mb-1 block text-xs font-medium text-slate-700">File</span>
					<input
						type="file"
						accept=".pdf,.png,.jpg,.jpeg,.webp"
						class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
						onchange={onPickFile}
					/>
				</label>

				<div class="grid gap-3 md:grid-cols-2">
					<label>
						<span class="mb-1 block text-xs font-medium text-slate-700">Invoice Number</span>
						<input
							class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
							bind:value={invoiceNo}
							placeholder="Can be prefilled by OCR"
						/>
					</label>
					<label>
						<span class="mb-1 block text-xs font-medium text-slate-700">PO Number (Optional)</span>
						<input class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" bind:value={poNumber} />
					</label>
				</div>

				<div class="grid gap-3 md:grid-cols-2">
					<label>
						<span class="mb-1 block text-xs font-medium text-slate-700">Invoice Date</span>
						<input type="date" class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" bind:value={invoiceDate} />
					</label>
					<label>
						<span class="mb-1 block text-xs font-medium text-slate-700">Due Date (Optional)</span>
						<input type="date" class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" bind:value={invoiceDueDate} />
					</label>
				</div>

				<label>
					<span class="mb-1 block text-xs font-medium text-slate-700">Customer Name (Bill-To / Buyer, Optional)</span>
					<input class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" bind:value={customerName} />
				</label>

				<div class="grid gap-3 md:grid-cols-2">
					<label>
						<span class="mb-1 block text-xs font-medium text-slate-700">Gross Total</span>
						<input type="number" step="0.01" class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" bind:value={total} />
					</label>
					<label>
						<span class="mb-1 block text-xs font-medium text-slate-700">Currency</span>
						<select class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" bind:value={currency}>
							{#each EXPENSE_UPLOAD_CURRENCIES as code (code)}
								<option value={code}>{code}</option>
							{/each}
						</select>
					</label>
				</div>

				<div class="grid gap-3 md:grid-cols-2">
					<label>
						<span class="mb-1 block text-xs font-medium text-slate-700">GST Amount</span>
						<input type="number" step="0.01" class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" bind:value={gstAmount} placeholder="0" />
					</label>
					<label>
						<span class="mb-1 block text-xs font-medium text-slate-700">GST Type</span>
						<select class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" bind:value={gstType}>
							<option value="standard">standard</option>
							<option value="zero">zero</option>
							<option value="exempt">exempt</option>
						</select>
					</label>
				</div>

				<div class="flex flex-wrap items-center gap-2">
					<button
						type="button"
						class="rounded-md border border-[var(--sf-green)] bg-[var(--sf-green-soft)] px-3 py-2 text-xs font-medium text-[var(--sf-green)] hover:bg-[#dcefd8] disabled:opacity-50"
						disabled={detecting || !selectedFile}
						onclick={() => void runDetect()}
					>
						{detecting ? 'Detecting...' : 'OCR + AI detect & fill'}
					</button>
					<button
						type="button"
						class="rounded-md bg-[var(--sf-green)] px-4 py-2 text-sm font-medium text-white hover:bg-[#2f5e2c] disabled:opacity-50"
						disabled={uploading || !selectedFile}
						onclick={() => void upload()}
					>
						{uploading ? 'Saving...' : 'Upload and save'}
					</button>
					{#if duplicateInvoicePending}
						<button
							type="button"
							class="rounded-md border border-amber-600 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
							disabled={uploading}
							onclick={() => {
								reissueOnSave = true;
								void upload();
							}}
						>
							Save with system-generated number
						</button>
					{/if}
					<a
						href="/finance/doc-hub/customer-invoices"
						class="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
					>
						Customer invoice list
					</a>
				</div>

				{#if message}
					<p class="text-sm text-emerald-700">{message}</p>
				{/if}
				{#if error}
					<p class="text-sm text-rose-700">{error}</p>
					{#if duplicateRevenueEntityId && selectedProject}
						<p class="text-xs text-slate-600">
							<a
								class="text-[var(--sf-green)] hover:underline"
								href={`/projects/${selectedProject.id}/documents/revenue/${duplicateRevenueEntityId}`}
							>
								View existing customer invoice
							</a>
						</p>
					{/if}
				{/if}
			</div>
		</section>

		<section class="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:sticky xl:top-4">
			<h2 class="text-sm font-semibold text-slate-900">File preview</h2>
			{#if selectedFile && previewUrl}
				<div class="mt-3 flex flex-wrap items-center gap-2">
					<span class="text-[11px] font-medium text-slate-500">Zoom</span>
					<button
						type="button"
						class="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-40"
						disabled={previewZoomPct <= 50}
						onclick={() => setPreviewZoom(previewZoomPct - 10)}
					>
						�?
					</button>
					<button
						type="button"
						class="rounded border border-slate-300 bg-white px-2 py-1 text-xs tabular-nums text-slate-700 hover:bg-slate-50"
						onclick={() => {
							previewZoomPct = 100;
						}}
					>
						{previewZoomPct}%
					</button>
					<button
						type="button"
						class="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-40"
						disabled={previewZoomPct >= 200}
						onclick={() => setPreviewZoom(previewZoomPct + 10)}
					>
						+
					</button>
					<a
						href={previewUrl}
						target="_blank"
						rel="noreferrer"
						class="ml-auto text-xs font-medium text-[var(--sf-green)] hover:underline"
					>
						Open in new tab
					</a>
				</div>
				<div class="mt-2 max-h-[min(72vh,820px)] w-full overflow-auto rounded-lg border border-slate-200 bg-slate-100/80">
					<div
						class="origin-top-left"
						style="transform: scale({previewScale}); width: {previewScale > 0 ? (100 / previewScale).toFixed(4) : 100}%;"
					>
						{#if selectedFile.type === 'application/pdf' || selectedFile.name.toLowerCase().endsWith('.pdf')}
							<iframe
								title="PDF preview"
								class="block h-[min(65vh,720px)] w-full border-0 bg-white"
								src={previewUrl}
							></iframe>
						{:else if selectedFile.type.startsWith('image/')}
							<img
								alt="Preview"
								class="block max-h-[min(65vh,720px)] w-full object-contain bg-white"
								src={previewUrl}
							/>
						{/if}
					</div>
				</div>
			{:else if selectedFile}
				<p class="mt-3 text-xs text-slate-600">This file type cannot be previewed in-browser, but detection and save are still available.</p>
			{:else}
				<p class="mt-3 text-xs text-slate-500">Select a file to preview it here.</p>
			{/if}

			<h2 class="mt-6 text-sm font-semibold text-slate-900">Save result</h2>
			<div class="mt-2 space-y-1 text-xs text-slate-600">
				<p><span class="font-medium text-slate-800">Invoice Number:</span> {savedInvoiceNo ?? '-'}</p>
				<p><span class="font-medium text-slate-800">Record ID:</span> {savedEntityId ?? '-'}</p>
				{#if savedEntityId && selectedProject}
					<p>
						<a
							class="text-[var(--sf-green)] hover:underline"
							href="/projects/{selectedProject.id}/documents/revenue/{savedEntityId}"
						>
							Open customer invoice in project
						</a>
					</p>
				{/if}
			</div>

			{#if detectRawText}
				<details class="mt-4 rounded-lg border border-slate-200 bg-slate-50" open>
					<summary class="cursor-pointer select-none px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100/80">
						Extracted text ({detectRawText.length} chars)
					</summary>
					<pre
						class="max-h-64 overflow-auto whitespace-pre-wrap break-words border-t border-slate-200 px-3 py-2 text-[11px] leading-relaxed text-slate-700">{detectRawText}</pre>
				</details>
			{/if}
		</section>
	</div>
</PageShell>

{#if showProjectPicker}
	<div
		class="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[8vh]"
		role="dialog"
		aria-modal="true"
	>
		<div class="w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-xl">
			<div class="flex items-center justify-between border-b border-slate-200 px-5 py-3">
				<h2 class="text-sm font-semibold text-slate-900">Select Project</h2>
				<button
					type="button"
					class="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
					onclick={() => {
						showProjectPicker = false;
					}}
				>
					�?
				</button>
			</div>
			<div class="border-b border-slate-100 px-5 py-3">
				<div class="grid gap-3 lg:grid-cols-[2fr_1fr_1.3fr_auto]">
					<label class="space-y-1">
						<span class="text-xs font-medium text-slate-600">Search</span>
						<input
							class="w-full rounded border border-slate-300 px-3 py-2 text-sm"
							placeholder="Project name / ID / Customer name"
							bind:value={projectSearchQ}
							onkeydown={(e) => {
								if (e.key === 'Enter') {
									e.preventDefault();
									void searchProjects();
								}
							}}
						/>
					</label>
					<label class="space-y-1">
						<span class="text-xs font-medium text-slate-600">Status</span>
						<select class="w-full rounded border border-slate-300 px-3 py-2 text-sm" bind:value={projectSearchStatus}>
							<option value="">All</option>
							<option value="active">active</option>
							<option value="on_hold">on_hold</option>
							<option value="completed">completed</option>
							<option value="archived">archived</option>
						</select>
					</label>
					<label class="space-y-1">
						<span class="text-xs font-medium text-slate-600">Started On/After</span>
						<input class="w-full rounded border border-slate-300 px-3 py-2 text-sm" type="date" bind:value={projectSearchStartedAfter} />
					</label>
					<button
						type="button"
						class="h-10 self-end rounded border border-[var(--sf-green)] bg-[var(--sf-green)] px-4 text-sm font-medium text-white hover:bg-[#2f5e2c]"
						onclick={() => void searchProjects()}
					>
						{projectSearching ? 'Searching...' : 'Search'}
					</button>
				</div>
			</div>
			<div class="max-h-[50vh] overflow-auto px-5 py-3">
				{#if projectSearchResults.length === 0}
					<p class="py-6 text-center text-sm text-slate-400">
						{projectSearching ? 'Searching...' : 'No results. Try different filters.'}
					</p>
				{:else}
					<div class="overflow-hidden rounded-lg border border-slate-200 bg-white">
						<table class="min-w-full divide-y divide-slate-200 text-xs">
							<thead class="bg-slate-50 text-left text-slate-600">
								<tr>
									<th class="px-3 py-2">Project</th>
									<th class="px-3 py-2">Customer</th>
									<th class="px-3 py-2">Status</th>
									<th class="px-3 py-2">Start / End</th>
									<th class="px-3 py-2"></th>
								</tr>
							</thead>
							<tbody class="divide-y divide-slate-100">
								{#each projectSearchResults as p (p.id)}
									<tr class="hover:bg-slate-50/80">
										<td class="px-3 py-2">
											<p class="font-medium text-slate-800">{p.name}</p>
											<p class="text-[11px] text-slate-400">{p.id}</p>
										</td>
										<td class="px-3 py-2">{p.customerName ?? '-'}</td>
										<td class="px-3 py-2">{p.status}</td>
										<td class="px-3 py-2">{p.startDate ?? '-'} / {p.endDate ?? '-'}</td>
										<td class="px-3 py-2">
											<button
												type="button"
												class="rounded border border-[var(--sf-green)] bg-[var(--sf-green-soft)] px-2 py-1 text-[var(--sf-green)] hover:bg-[#dcefd8]"
												onclick={() => pickProject(p)}
											>
												Select
											</button>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}


