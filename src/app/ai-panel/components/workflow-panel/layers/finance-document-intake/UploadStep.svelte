<script lang="ts">
	import { UploadCloud, FileText, Loader2, AlertTriangle } from 'lucide-svelte';
	import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
	import { panel } from '$app-layer/ai-panel/workflow/panel.svelte';
	import {
		uploadDocument,
		type DocumentProcessingStatus
	} from '$app-layer/ai-panel/workflow/finance-workflow-api';

	type Stage = 'idle' | 'parsing' | 'storing' | 'queued' | 'error';

	let fileInput: HTMLInputElement | null = $state(null);
	let dragOver = $state(false);
	let stage = $state<Stage>('idle');
	let fileName = $state('');
	let error = $state('');

	const TERMINAL_BAD: DocumentProcessingStatus[] = ['needs_manual_review', 'failed'];
	const MIN_USEFUL_CLIENT_TEXT = 48;

	// ---------------------------------------------------------------------------
	// Client-side text extraction (Ship 1 of upload pipeline redesign).
	// Same pattern as src/app/ai-panel/components/workflow-panel/layers/intake/DropZone.svelte.
	// PDF: pdfjs text layer; if too thin, render page 1 → JPEG → server vision OCR.
	// Image: skip client extraction, server runs vision OCR.
	// ---------------------------------------------------------------------------
	type PdfJs = typeof import('pdfjs-dist');
	let _pdfJsCache: PdfJs | null = null;

	async function loadPdfJs(): Promise<PdfJs> {
		if (_pdfJsCache) return _pdfJsCache;
		const lib = await import('pdfjs-dist');
		lib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
		_pdfJsCache = lib;
		return lib;
	}

	async function extractPdfText(file: File): Promise<string> {
		const pdfjs = await loadPdfJs();
		const data = new Uint8Array(await file.arrayBuffer());
		const pdf = await Promise.race([
			pdfjs.getDocument({ data }).promise,
			new Promise<never>((_, reject) =>
				setTimeout(() => reject(new Error('PDF parse timeout')), 15000)
			)
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

	async function renderPdfFirstPageJpeg(file: File): Promise<File | null> {
		try {
			const pdfjs = await loadPdfJs();
			const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
				.promise;
			if (pdf.numPages < 1) return null;
			const page = await pdf.getPage(1);
			const base = page.getViewport({ scale: 1 });
			const viewport = page.getViewport({
				scale: Math.min(2.5, 1600 / Math.max(base.width, 1))
			});
			const canvas = document.createElement('canvas');
			canvas.width = Math.ceil(viewport.width);
			canvas.height = Math.ceil(viewport.height);
			const ctx = canvas.getContext('2d');
			if (!ctx) return null;
			await page.render({ canvasContext: ctx, viewport, canvas }).promise;
			const blob = await new Promise<Blob | null>((resolve) =>
				canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.88)
			);
			if (!blob) return null;
			const baseName = file.name.replace(/\.pdf$/i, '') || 'document';
			return new File([blob], `${baseName}-p1.jpg`, { type: 'image/jpeg' });
		} catch {
			return null;
		}
	}

	type ClientExtraction = {
		text: string;
		method: 'pdfjs' | 'vision_first_page' | 'manual';
		uploadFile: File;
	};

	async function buildClientExtraction(file: File): Promise<ClientExtraction> {
		const mime = (file.type || '').toLowerCase();
		const name = file.name.toLowerCase();
		const isPdf = mime === 'application/pdf' || name.endsWith('.pdf');
		const isImage =
			mime.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|tiff?)$/i.test(name);

		if (isImage) {
			// Server-side vision OCR will handle this; nothing to extract on client.
			return { text: '', method: 'manual', uploadFile: file };
		}

		if (isPdf) {
			const text = await extractPdfText(file).catch(() => '');
			if (text.length >= MIN_USEFUL_CLIENT_TEXT) {
				return { text, method: 'pdfjs', uploadFile: file };
			}
			// Scanned PDF: rasterize first page → JPEG, upload that as the artifact.
			// Server-side vision OCR handles it from there.
			const jpeg = await renderPdfFirstPageJpeg(file);
			if (jpeg) {
				return { text: '', method: 'vision_first_page', uploadFile: jpeg };
			}
			// Last-resort: upload the original PDF; server will mark needs_manual_review.
			return { text: '', method: 'manual', uploadFile: file };
		}

		return { text: '', method: 'manual', uploadFile: file };
	}

	async function onFile(file: File) {
		if (!file) return;
		fileName = file.name;
		error = '';
		stage = 'parsing';

		try {
			const extraction = await buildClientExtraction(file);

			stage = 'storing';
			const artifact = await uploadDocument(extraction.uploadFile, {
				uploadedFrom: 'ai_panel',
				clientExtractedText: extraction.text || undefined,
				clientExtractionMethod: extraction.method
			});

			if (TERMINAL_BAD.includes(artifact.processingStatus)) {
				error =
					artifact.textExtraction?.error?.message ??
					(artifact.processingStatus === 'needs_manual_review'
						? "I could read the file but the text was too thin to use confidently."
						: 'Something went wrong while reading the file.');
				stage = 'error';
				return;
			}

			stage = 'queued';
			panel.startWorkflow('finance-inbox');
			panel.patchState({
				initialTab: artifact.processingStatus === 'ready_for_review' ? 'review' : 'processing',
				justUploadedDocumentId: artifact.id,
				documentId: artifact.id,
				documentArtifactId: artifact.id,
				documentArtifactStatus: artifact.processingStatus,
				documentClassification: artifact.classification,
				suggestedDocumentType: artifact.documentType,
				fileName: file.name,
				fileSize: file.size
			});
		} catch (e) {
			error = e instanceof Error ? e.message : 'Could not start the workflow.';
			stage = 'error';
		}
	}

	function onInputChange(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (file) void onFile(file);
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		const file = e.dataTransfer?.files?.[0];
		if (file) void onFile(file);
	}

	function onDragOver(e: DragEvent) {
		e.preventDefault();
		dragOver = true;
	}

	function onDragLeave() {
		dragOver = false;
	}

	function onBrowseClick() {
		fileInput?.click();
	}

	function onRetry() {
		stage = 'idle';
		error = '';
		fileName = '';
	}
</script>

<div class="intake-drop">
	<button
		type="button"
		class="drop-area"
		class:is-dragging={dragOver}
		class:is-busy={stage === 'parsing' ||
			stage === 'storing' ||
			stage === 'queued'}
		class:is-error={stage === 'error'}
		ondragover={onDragOver}
		ondragleave={onDragLeave}
		ondrop={onDrop}
		onclick={stage === 'error' ? onRetry : onBrowseClick}
		disabled={stage === 'parsing' ||
			stage === 'storing' ||
			stage === 'queued'}
	>
		<span class="drop-glow" aria-hidden="true"></span>

		<span class="drop-icon">
			{#if stage === 'parsing' || stage === 'storing' || stage === 'queued'}
				<Loader2 size={30} strokeWidth={1.6} />
			{:else if stage === 'error'}
				<AlertTriangle size={30} strokeWidth={1.6} />
			{:else if fileName}
				<FileText size={30} strokeWidth={1.6} />
			{:else}
				<UploadCloud size={30} strokeWidth={1.6} />
			{/if}
		</span>

		<span class="drop-heading">
			{#if stage === 'parsing'}
				Reading {fileName} locally…
			{:else if stage === 'storing'}
				Storing {fileName}…
			{:else if stage === 'queued'}
				Adding {fileName} to Inbox…
			{:else if stage === 'error'}
				Couldn't start
			{:else}
				Drop the financial document here
			{/if}
		</span>

		<span class="drop-sub">
			{#if stage === 'error'}
				{error}
			{:else}
				PDF or photo. Invoice, receipt, PO, customer invoice - I'll figure out the rest.
			{/if}
		</span>

		<span class="drop-footnote">
			{#if stage === 'idle' && !fileName}
				Click or drop · client-side text extraction + AI classification
			{:else if stage === 'parsing'}
				Extracting text in browser (pdf.js)
			{:else if stage === 'storing'}
				Stashing in object storage
			{:else if stage === 'queued'}
				The async worker will extract, classify, and prefill fields
			{/if}
		</span>
	</button>

	<input
		bind:this={fileInput}
		type="file"
		accept="application/pdf,image/png,image/jpeg,image/webp"
		onchange={onInputChange}
		hidden
	/>
</div>

<style>
	.intake-drop {
		display: flex;
		flex-direction: column;
		gap: 18px;
	}

	.drop-area {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		padding: 48px 28px 42px;
		background: var(--panel-surface);
		border: 1.5px dashed rgba(234, 188, 60, 0.28);
		border-radius: 20px;
		color: inherit;
		font-family: inherit;
		cursor: pointer;
		overflow: hidden;
		text-align: center;
		transition:
			transform var(--panel-dur-fast) var(--panel-ease),
			border-color var(--panel-dur-fast) var(--panel-ease),
			background var(--panel-dur-fast) var(--panel-ease),
			box-shadow var(--panel-dur-fast) var(--panel-ease);
	}
	.drop-area:hover:not(.is-busy) {
		transform: translateY(-1px);
		border-color: var(--panel-gold);
		background: var(--panel-surface-raised);
		box-shadow: 0 0 28px -6px var(--panel-gold-glow);
	}
	.drop-area.is-dragging {
		border-color: var(--panel-gold-bright);
		background: var(--panel-surface-raised);
		box-shadow: 0 0 40px -4px var(--panel-gold-glow);
	}
	.drop-area.is-busy {
		cursor: progress;
		border-color: var(--panel-gold);
	}
	.drop-area.is-error {
		border-color: rgba(225, 118, 118, 0.45);
		background: rgba(225, 118, 118, 0.04);
	}

	.drop-glow {
		position: absolute;
		inset: -30% -30% auto auto;
		width: 70%;
		height: 90%;
		background: radial-gradient(circle, var(--panel-gold-soft), transparent 60%);
		pointer-events: none;
	}

	.drop-icon {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 64px;
		height: 64px;
		margin-bottom: 10px;
		color: var(--panel-gold-bright);
		background: rgba(234, 188, 60, 0.08);
		border: 1px solid rgba(234, 188, 60, 0.24);
		border-radius: 18px;
		box-shadow: 0 0 28px -4px var(--panel-gold-glow);
	}
	.drop-area.is-busy .drop-icon :global(svg) {
		animation: spin 1.1s linear infinite;
	}
	.drop-area.is-error .drop-icon {
		color: var(--panel-danger);
		background: rgba(225, 118, 118, 0.08);
		border-color: rgba(225, 118, 118, 0.3);
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.drop-heading {
		position: relative;
		font-size: clamp(18px, 2.1vw, 22px);
		font-weight: 500;
		color: var(--panel-fg);
		letter-spacing: -0.005em;
	}
	.drop-sub {
		position: relative;
		font-size: 13.5px;
		line-height: 1.55;
		color: var(--panel-fg-muted);
		max-width: 46ch;
	}
	.drop-footnote {
		position: relative;
		margin-top: 8px;
		font-size: 11px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--panel-fg-faint);
	}
</style>
