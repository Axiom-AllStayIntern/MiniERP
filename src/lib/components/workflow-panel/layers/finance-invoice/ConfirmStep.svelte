<script lang="ts">
	import { ShieldCheck, AlertTriangle, Loader2 } from 'lucide-svelte';
	import { panel } from '$lib/workflow/panel.svelte';
	import {
		confirmWorkflow,
		type ConfirmedPayload,
		type ExtractionResult,
		type MatchingResult,
		type PurchaseOrderCandidate,
		type SupplierCandidate
	} from '$lib/workflow/finance-invoice-api';
	import { hashConfirmationPayload } from '$lib/workflow/payload-hash';

	const wfState = $derived((panel.activeWorkflow?.state as Record<string, unknown>) ?? {});
	const extraction = $derived(wfState.extraction as ExtractionResult | undefined);
	const matching = $derived(wfState.matching as MatchingResult | undefined);
	const documentId = $derived(wfState.documentId as string | undefined);
	const serverWorkflowId = $derived(wfState.serverWorkflowId as string | undefined);
	const selectedSupplierId = $derived<string | null>(
		(wfState.selectedSupplierId as string | null | undefined) ?? null
	);
	const selectedPoId = $derived<string | null>(
		(wfState.selectedPoId as string | null | undefined) ?? null
	);

	const supplier = $derived<SupplierCandidate | null>(
		matching?.supplierCandidates.find((c) => c.id === selectedSupplierId) ?? null
	);
	const po = $derived<PurchaseOrderCandidate | null>(
		matching?.poCandidates.find((c) => c.id === selectedPoId) ?? null
	);

	let stage = $state<'idle' | 'submitting' | 'error'>('idle');
	let errorMessage = $state('');
	let errorIssues = $state<Array<{ field: string; message: string }>>([]);

	function formatAmount(value: number, currency: string): string {
		return `${currency} ${value.toLocaleString('en-SG', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		})}`;
	}

	function buildPayload(): ConfirmedPayload | null {
		if (!extraction || !documentId) return null;
		return {
			documentId,
			supplierId: selectedSupplierId,
			poId: selectedPoId,
			projectId: null,
			fields: extraction.fields
		};
	}

	async function onConfirm() {
		const payload = buildPayload();
		if (!payload || !serverWorkflowId) {
			errorMessage = 'Missing data — go back to the upload step.';
			stage = 'error';
			return;
		}

		stage = 'submitting';
		errorMessage = '';
		errorIssues = [];

		try {
			const payloadHash = await hashConfirmationPayload(payload);
			const result = await confirmWorkflow(serverWorkflowId, { payload, payloadHash });
			panel.patchState({
				entityId: result.entityId,
				auditRef: result.auditRef,
				entityRoute: result.entityRoute,
				nextTask: result.nextTask,
				serverStep: 'completion'
			});
			panel.advanceStep();
		} catch (e) {
			errorMessage = e instanceof Error ? e.message : 'Could not record the invoice.';
			stage = 'error';
		}
	}

	function onEdit() {
		panel.setStep(2);
	}

	function onCancel() {
		panel.endWorkflow();
		panel.close();
	}
</script>

{#if extraction && matching}
	<div class="step">
		<div class="lede">
			<span class="lede-eyebrow">
				<ShieldCheck size={11} strokeWidth={2} /> Final review
			</span>
			<span class="lede-text">
				About to record this supplier invoice. Confirmation locks it into
				<b>{formatAmount(extraction.fields.totalAmount, extraction.fields.currency)}</b>
				with audit trail.
			</span>
		</div>

		<div class="summary-card">
			<dl class="summary">
				<div class="row">
					<dt>Supplier</dt>
					<dd>{supplier?.name ?? extraction.fields.counterpartyName}</dd>
				</div>
				<div class="row">
					<dt>Invoice no.</dt>
					<dd class="num">{extraction.fields.documentNumber}</dd>
				</div>
				<div class="row">
					<dt>Issue date</dt>
					<dd class="num">{extraction.fields.issueDate}</dd>
				</div>
				<div class="row">
					<dt>Due date</dt>
					<dd class="num">{extraction.fields.dueDate}</dd>
				</div>
				<div class="row emphasis">
					<dt>Total</dt>
					<dd class="num">
						{formatAmount(extraction.fields.totalAmount, extraction.fields.currency)}
					</dd>
				</div>
				<div class="row">
					<dt>GST</dt>
					<dd class="num">
						{formatAmount(extraction.fields.gstAmount, extraction.fields.currency)}
					</dd>
				</div>
				<div class="row">
					<dt>Matched PO</dt>
					<dd>{po?.poNumber ?? '— no PO link'}</dd>
				</div>
				<div class="row">
					<dt>Project</dt>
					<dd>— set when the project lookup ships</dd>
				</div>
			</dl>

			{#if matching.duplicate.isDuplicate}
				<div class="warn">
					<span class="warn-icon"><AlertTriangle size={14} strokeWidth={2} /></span>
					{matching.duplicate.reason ?? 'Possible duplicate detected.'}
				</div>
			{/if}
		</div>

		{#if stage === 'error'}
			<div class="err-card">
				<div class="err-title">Couldn't record</div>
				<p class="err-sub">{errorMessage}</p>
				{#if errorIssues.length}
					<ul class="err-issues">
						{#each errorIssues as issue, i (i)}
							<li><b>{issue.field}</b> — {issue.message}</li>
						{/each}
					</ul>
				{/if}
			</div>
		{/if}

		<div class="actions">
			<button type="button" class="btn-ghost" onclick={onCancel} disabled={stage === 'submitting'}>
				Cancel
			</button>
			<button type="button" class="btn-ghost" onclick={onEdit} disabled={stage === 'submitting'}>
				← Edit fields
			</button>
			<button
				type="button"
				class="btn-primary"
				onclick={onConfirm}
				disabled={stage === 'submitting'}
			>
				{#if stage === 'submitting'}
					<Loader2 size={14} strokeWidth={2} class="spin" /> Recording…
				{:else}
					Confirm and record
				{/if}
			</button>
		</div>
	</div>
{:else}
	<div class="empty">Missing extraction or matching data. Step back through the flow.</div>
{/if}

<style>
	.step {
		display: flex;
		flex-direction: column;
		gap: 18px;
	}

	.lede {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px 18px;
		background: var(--panel-surface);
		border: 1px solid var(--panel-border);
		border-radius: 14px;
		font-size: 13.5px;
		color: var(--panel-fg);
	}
	.lede-eyebrow {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
		font-size: 10px;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--panel-gold);
	}
	.lede-text {
		flex: 1;
		color: var(--panel-fg-muted);
		line-height: 1.5;
	}
	.lede-text :global(b) {
		color: var(--panel-fg);
		font-weight: 500;
	}

	.summary-card {
		padding: 18px 22px 22px;
		background: var(--panel-surface);
		border: 1px solid var(--panel-border);
		border-radius: 16px;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.summary {
		display: grid;
		grid-template-columns: 130px 1fr;
		row-gap: 11px;
		column-gap: 14px;
		margin: 0;
	}
	.row {
		display: contents;
	}
	.row dt {
		font-size: 11.5px;
		letter-spacing: 0.04em;
		color: var(--panel-fg-faint);
		text-transform: uppercase;
		align-self: center;
	}
	.row dd {
		font-size: 13.5px;
		color: var(--panel-fg);
		margin: 0;
	}
	.row dd.num {
		font-variant-numeric: tabular-nums;
	}
	.row.emphasis dd {
		font-size: 16px;
		font-weight: 500;
		color: var(--panel-gold-bright);
	}

	.warn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		font-size: 12.5px;
		color: var(--panel-fg);
		background: rgba(225, 118, 118, 0.08);
		border: 1px solid rgba(225, 118, 118, 0.32);
		border-radius: 10px;
		align-self: flex-start;
	}
	.warn-icon {
		display: inline-flex;
		color: var(--panel-danger);
	}

	.err-card {
		padding: 14px 16px;
		background: rgba(225, 118, 118, 0.06);
		border: 1px solid rgba(225, 118, 118, 0.32);
		border-radius: 12px;
	}
	.err-title {
		font-size: 13.5px;
		font-weight: 500;
		color: var(--panel-fg);
		margin-bottom: 4px;
	}
	.err-sub {
		font-size: 12.5px;
		color: var(--panel-fg-muted);
		margin: 0;
	}
	.err-issues {
		list-style: disc;
		padding-left: 22px;
		margin: 8px 0 0;
		font-size: 12px;
		color: var(--panel-fg-muted);
	}
	.err-issues :global(b) {
		color: var(--panel-fg);
		font-weight: 500;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
	}
	.btn-ghost,
	.btn-primary {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 9px 18px;
		border-radius: 10px;
		font-family: inherit;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		transition: all var(--panel-dur-fast) var(--panel-ease);
	}
	.btn-ghost {
		background: transparent;
		border: 1px solid var(--panel-border-strong);
		color: var(--panel-fg-muted);
	}
	.btn-ghost:hover:not(:disabled) {
		color: var(--panel-fg);
		border-color: var(--panel-gold);
	}
	.btn-ghost:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.btn-primary {
		background: var(--panel-gold);
		border: 1px solid var(--panel-gold-bright);
		color: #2d1f08;
		box-shadow: 0 0 14px -3px var(--panel-gold-glow);
	}
	.btn-primary:hover:not(:disabled) {
		background: var(--panel-gold-bright);
	}
	.btn-primary:disabled {
		opacity: 0.7;
		cursor: progress;
	}
	.btn-primary :global(svg.spin) {
		animation: spin 1.1s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.empty {
		padding: 32px;
		text-align: center;
		font-size: 13.5px;
		color: var(--panel-fg-muted);
	}
</style>
