<script lang="ts">
	import { FileText, Sparkles } from 'lucide-svelte';
	import { panel } from '$lib/workflow/panel.svelte';
	import type { ExtractionResult } from '$lib/workflow/finance-invoice-api';

	const wfState = $derived((panel.activeWorkflow?.state as Record<string, unknown>) ?? {});
	const extraction = $derived(wfState.extraction as ExtractionResult | undefined);
	const fileName = $derived(wfState.fileName as string | undefined);

	const confidencePct = $derived(
		extraction ? Math.round(extraction.confidence * 100) : 0
	);
	const confidenceTone = $derived(
		confidencePct >= 90 ? 'high' : confidencePct >= 70 ? 'medium' : 'low'
	);

	function formatAmount(value: number, currency: string): string {
		const formatted = value.toLocaleString('en-SG', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		});
		return `${currency} ${formatted}`;
	}

	function onLooksRight() {
		panel.advanceStep();
	}
</script>

{#if extraction}
	<div class="step">
		<div class="narration">
			<span class="narration-eyebrow">
				<Sparkles size={11} strokeWidth={2} /> I found
			</span>
			<span class="narration-text">
				<b>{extraction.fields.counterpartyName}</b>, invoice
				<b>{extraction.fields.documentNumber}</b>, total
				<b>{formatAmount(extraction.fields.totalAmount, extraction.fields.currency)}</b>.
			</span>
			<span class="conf-pill conf-{confidenceTone}" title="Extraction confidence">
				{confidencePct}%
			</span>
		</div>

		<div class="grid">
			<div class="fields-card">
				<div class="card-header">
					<h3 class="card-title">Extracted fields</h3>
					<span class="card-sub">From mock fixture · {extraction.evidence.length} signals</span>
				</div>

				<dl class="fields">
					<div class="field">
						<dt>Supplier</dt>
						<dd>{extraction.fields.counterpartyName}</dd>
					</div>
					<div class="field">
						<dt>Invoice no.</dt>
						<dd class="num">{extraction.fields.documentNumber}</dd>
					</div>
					<div class="field">
						<dt>Issue date</dt>
						<dd class="num">{extraction.fields.issueDate}</dd>
					</div>
					<div class="field">
						<dt>Due date</dt>
						<dd class="num">{extraction.fields.dueDate}</dd>
					</div>
					<div class="field">
						<dt>Currency</dt>
						<dd class="num">{extraction.fields.currency}</dd>
					</div>
					<div class="field amount">
						<dt>Total</dt>
						<dd class="num">{formatAmount(extraction.fields.totalAmount, extraction.fields.currency)}</dd>
					</div>
					<div class="field amount">
						<dt>GST</dt>
						<dd class="num">{formatAmount(extraction.fields.gstAmount, extraction.fields.currency)}</dd>
					</div>
				</dl>
			</div>

			<div class="preview-card">
				<div class="preview-icon">
					<FileText size={28} strokeWidth={1.6} />
				</div>
				<div class="preview-name">{fileName ?? 'document'}</div>
				<div class="preview-sub">
					Phase 1: file preview lands when real OCR ships in Phase 2.
				</div>
			</div>
		</div>

		<div class="actions">
			<button type="button" class="btn-ghost" disabled title="Inline editing comes in Stage 5">
				Edit fields
			</button>
			<button type="button" class="btn-primary" onclick={onLooksRight}>Looks right →</button>
		</div>
	</div>
{:else}
	<div class="empty">No extraction result yet. Drop a file first.</div>
{/if}

<style>
	.step {
		display: flex;
		flex-direction: column;
		gap: 18px;
	}

	.narration {
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
	.narration-eyebrow {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
		font-size: 10px;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--panel-gold);
	}
	.narration-text {
		flex: 1;
		color: var(--panel-fg-muted);
		line-height: 1.5;
	}
	.narration-text :global(b) {
		color: var(--panel-fg);
		font-weight: 500;
	}

	.conf-pill {
		flex-shrink: 0;
		padding: 3px 10px;
		border-radius: 999px;
		font-size: 11px;
		font-weight: 500;
		font-variant-numeric: tabular-nums;
		border: 1px solid;
	}
	.conf-high {
		color: var(--panel-green-bright);
		border-color: rgba(95, 181, 94, 0.4);
		background: rgba(95, 181, 94, 0.08);
	}
	.conf-medium {
		color: var(--panel-gold-bright);
		border-color: rgba(234, 188, 60, 0.4);
		background: rgba(234, 188, 60, 0.08);
	}
	.conf-low {
		color: var(--panel-danger);
		border-color: rgba(225, 118, 118, 0.4);
		background: rgba(225, 118, 118, 0.06);
	}

	.grid {
		display: grid;
		grid-template-columns: 1.4fr 1fr;
		gap: 18px;
	}
	@media (max-width: 880px) {
		.grid {
			grid-template-columns: 1fr;
		}
	}

	.fields-card,
	.preview-card {
		padding: 18px 20px;
		background: var(--panel-surface);
		border: 1px solid var(--panel-border);
		border-radius: 16px;
	}

	.card-header {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding-bottom: 12px;
		margin-bottom: 12px;
		border-bottom: 1px solid var(--panel-divider);
	}
	.card-title {
		font-size: 14px;
		font-weight: 500;
		color: var(--panel-fg);
		margin: 0;
	}
	.card-sub {
		font-size: 11px;
		color: var(--panel-fg-faint);
		letter-spacing: 0.04em;
	}

	.fields {
		display: grid;
		grid-template-columns: 110px 1fr;
		row-gap: 9px;
		column-gap: 14px;
		margin: 0;
	}
	.field {
		display: contents;
	}
	.field dt {
		font-size: 11.5px;
		letter-spacing: 0.04em;
		color: var(--panel-fg-faint);
		text-transform: uppercase;
		align-self: center;
	}
	.field dd {
		font-size: 13.5px;
		color: var(--panel-fg);
		margin: 0;
	}
	.field dd.num {
		font-variant-numeric: tabular-nums;
	}
	.field.amount dd {
		text-align: right;
		font-weight: 500;
	}

	.preview-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 10px;
		text-align: center;
	}
	.preview-icon {
		display: inline-flex;
		width: 48px;
		height: 48px;
		align-items: center;
		justify-content: center;
		border-radius: 14px;
		background: rgba(234, 188, 60, 0.08);
		border: 1px solid rgba(234, 188, 60, 0.24);
		color: var(--panel-gold-bright);
	}
	.preview-name {
		font-size: 13.5px;
		color: var(--panel-fg);
		font-weight: 500;
		max-width: 28ch;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.preview-sub {
		font-size: 12px;
		color: var(--panel-fg-faint);
		max-width: 28ch;
		line-height: 1.5;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
	}
	.btn-ghost,
	.btn-primary {
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
	.btn-primary:hover {
		background: var(--panel-gold-bright);
	}

	.empty {
		padding: 32px;
		text-align: center;
		font-size: 13.5px;
		color: var(--panel-fg-muted);
	}
</style>
