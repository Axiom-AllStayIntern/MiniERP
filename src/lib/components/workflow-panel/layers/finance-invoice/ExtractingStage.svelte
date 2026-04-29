<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { AlertTriangle } from 'lucide-svelte';
	import { panel } from '$lib/workflow/panel.svelte';
	import {
		advanceWorkflow,
		getDocumentStatus,
		READY_DOCUMENT_STATUSES,
		TERMINAL_DOCUMENT_STATUSES,
		type DocumentProcessingStatus
	} from '$lib/workflow/finance-invoice-api';

	const PHASES = [
		'Extracting invoice fields…',
		'Cross-checking supplier directory…',
		'Computing confidence…'
	];

	const POLL_INTERVAL_MS = 1000;
	const MAX_POLL_ATTEMPTS = 20;

	let phaseIndex = $state(0);
	let error = $state('');
	let phaseTimer: ReturnType<typeof setInterval> | null = null;
	let started = false;

	function readState() {
		return (panel.activeWorkflow?.state as Record<string, unknown> | undefined) ?? {};
	}

	function isTerminalGood(status: DocumentProcessingStatus | undefined): boolean {
		return status !== undefined && READY_DOCUMENT_STATUSES.includes(status);
	}
	function isTerminalBad(status: DocumentProcessingStatus | undefined): boolean {
		return (
			status === 'needs_manual_review' || status === 'failed'
		);
	}
	function isTerminal(status: DocumentProcessingStatus | undefined): boolean {
		return status !== undefined && TERMINAL_DOCUMENT_STATUSES.includes(status);
	}

	function delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	async function waitForArtifactReady(documentId: string): Promise<DocumentProcessingStatus> {
		// Phase 2's POST /api/documents runs OCR + classify synchronously, so
		// in practice the first poll already returns a terminal status. The
		// loop is in place so that the future async pipeline (Phase 4) doesn't
		// require a UI rewrite.
		for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
			const status = await getDocumentStatus(documentId);
			panel.patchState({ documentArtifactStatus: status.processingStatus });
			if (isTerminal(status.processingStatus)) return status.processingStatus;
			await delay(POLL_INTERVAL_MS);
		}
		throw new Error('Document processing timed out. Try uploading again.');
	}

	async function runFinanceExtract() {
		const wfState = readState();
		const serverWorkflowId = wfState.serverWorkflowId as string | undefined;
		if (!serverWorkflowId) {
			error = 'Workflow lost its server id. Drop the file again.';
			return;
		}

		const advance = await advanceWorkflow(serverWorkflowId, {
			targetStep: 'invoice_field_extraction'
		});
		panel.patchState({
			serverStep: advance.currentStep,
			extraction: advance.state.data.extraction
		});
		panel.advanceStep();
	}

	async function run() {
		const wfState = readState();
		const documentId = wfState.documentArtifactId as string | undefined;
		const knownStatus = wfState.documentArtifactStatus as DocumentProcessingStatus | undefined;

		try {
			// Phase 2 path with a real artifact id — make sure OCR/classify finished.
			if (documentId) {
				let status = knownStatus;
				if (!isTerminalGood(status)) {
					if (isTerminalBad(status)) {
						error =
							status === 'needs_manual_review'
								? "I couldn't confidently read the file. Drop a clearer scan or PDF."
								: 'The document could not be processed.';
						return;
					}
					status = await waitForArtifactReady(documentId);
					if (isTerminalBad(status)) {
						error =
							status === 'needs_manual_review'
								? "I couldn't confidently read the file. Drop a clearer scan or PDF."
								: 'The document could not be processed.';
						return;
					}
				}
			}

			// Either we have a ready artifact, or we're on the Phase 1 mock-id path.
			await runFinanceExtract();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Extraction failed.';
		}
	}

	onMount(() => {
		if (started) return;
		started = true;

		phaseTimer = setInterval(() => {
			phaseIndex = (phaseIndex + 1) % PHASES.length;
		}, 1100);

		untrack(() => {
			void run().finally(() => {
				if (phaseTimer) clearInterval(phaseTimer);
				phaseTimer = null;
			});
		});

		return () => {
			if (phaseTimer) clearInterval(phaseTimer);
		};
	});

	function onBack() {
		panel.setStep(0);
	}

	function onRetry() {
		error = '';
		phaseIndex = 0;
		started = false;
		void run();
	}
</script>

<div class="extract">
	{#if error}
		<div class="extract-error">
			<span class="err-icon">
				<AlertTriangle size={24} strokeWidth={1.8} />
			</span>
			<div class="err-title">I hit a snag</div>
			<p class="err-sub">{error}</p>
			<div class="err-actions">
				<button type="button" class="btn-secondary" onclick={onBack}>Drop another file</button>
				<button type="button" class="btn-primary" onclick={onRetry}>Try again</button>
			</div>
		</div>
	{:else}
		<div class="reading-card">
			<div class="ripple" aria-hidden="true">
				<span class="ripple-dot"></span>
				<span class="ripple-dot"></span>
				<span class="ripple-dot"></span>
			</div>
			<div class="reading-title">Extracting fields.</div>
			<div class="reading-phase" aria-live="polite">
				{PHASES[phaseIndex]}
			</div>
			<div class="progress-track" aria-hidden="true">
				<span class="progress-glow"></span>
			</div>
			<div class="reading-footnote">Real OCR · finance agent extraction</div>
		</div>
	{/if}
</div>

<style>
	.extract {
		display: flex;
		flex-direction: column;
		gap: 18px;
	}

	.reading-card {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 14px;
		padding: 56px 28px 48px;
		background: var(--panel-surface);
		border: 1px solid var(--panel-border);
		border-radius: 20px;
		overflow: hidden;
	}

	.ripple {
		display: inline-flex;
		gap: 10px;
		margin-bottom: 6px;
	}
	.ripple-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--panel-gold);
		box-shadow: 0 0 14px -2px var(--panel-gold-glow);
		animation: breathe 1.4s ease-in-out infinite;
	}
	.ripple-dot:nth-child(2) {
		animation-delay: 0.18s;
	}
	.ripple-dot:nth-child(3) {
		animation-delay: 0.36s;
	}
	@keyframes breathe {
		0%,
		100% {
			opacity: 0.3;
			transform: scale(0.85);
		}
		50% {
			opacity: 1;
			transform: scale(1.1);
		}
	}

	.reading-title {
		font-size: clamp(20px, 2.3vw, 24px);
		font-weight: 500;
		color: var(--panel-fg);
		letter-spacing: -0.005em;
	}
	.reading-phase {
		font-size: 13.5px;
		color: var(--panel-fg-muted);
		min-height: 1.4em;
	}

	.progress-track {
		position: relative;
		width: min(60%, 260px);
		height: 1px;
		background: var(--panel-divider);
		overflow: hidden;
		margin-top: 10px;
	}
	.progress-glow {
		position: absolute;
		top: 0;
		bottom: 0;
		left: -30%;
		width: 30%;
		background: linear-gradient(to right, transparent, var(--panel-gold) 50%, transparent);
		animation: progress-sweep 1.6s cubic-bezier(0.45, 0, 0.55, 1) infinite;
	}
	@keyframes progress-sweep {
		0% {
			left: -30%;
		}
		100% {
			left: 100%;
		}
	}

	.reading-footnote {
		margin-top: 8px;
		font-size: 11px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--panel-fg-faint);
	}

	.extract-error {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		padding: 40px 28px 32px;
		text-align: center;
		background: rgba(225, 118, 118, 0.04);
		border: 1px solid rgba(225, 118, 118, 0.3);
		border-radius: 18px;
	}
	.err-icon {
		display: inline-flex;
		width: 48px;
		height: 48px;
		align-items: center;
		justify-content: center;
		border-radius: 14px;
		background: rgba(225, 118, 118, 0.12);
		color: var(--panel-danger);
	}
	.err-title {
		font-size: 17px;
		font-weight: 500;
		color: var(--panel-fg);
	}
	.err-sub {
		font-size: 13px;
		line-height: 1.55;
		color: var(--panel-fg-muted);
		max-width: 44ch;
		margin: 0;
	}
	.err-actions {
		display: inline-flex;
		gap: 10px;
		margin-top: 12px;
	}
	.btn-secondary,
	.btn-primary {
		padding: 8px 16px;
		border-radius: 10px;
		font-family: inherit;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		transition: all var(--panel-dur-fast) var(--panel-ease);
	}
	.btn-secondary {
		background: transparent;
		border: 1px solid var(--panel-border-strong);
		color: var(--panel-fg-muted);
	}
	.btn-secondary:hover {
		color: var(--panel-fg);
		border-color: var(--panel-gold);
	}
	.btn-primary {
		background: var(--panel-gold);
		border: 1px solid var(--panel-gold-bright);
		color: #2d1f08;
		box-shadow: 0 0 14px -3px var(--panel-gold-glow);
	}
	.btn-primary:hover {
		background: var(--panel-gold-bright);
	}
</style>
