<script lang="ts">
	import { CheckCircle2, ArrowUpRight } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { panel } from '$lib/workflow/panel.svelte';
	import type { SuggestedTask } from '$lib/workflow/finance-invoice-api';

	const wfState = $derived((panel.activeWorkflow?.state as Record<string, unknown>) ?? {});
	const entityId = $derived(wfState.entityId as string | undefined);
	const auditRef = $derived(wfState.auditRef as string | undefined);
	const entityRoute = $derived((wfState.entityRoute as string | undefined) ?? '/expenses');
	const nextTask = $derived(wfState.nextTask as SuggestedTask | null | undefined);
	const supplierName = $derived(
		(wfState.extraction as { fields: { counterpartyName: string } } | undefined)?.fields
			?.counterpartyName
	);

	function onClose() {
		panel.endWorkflow();
		panel.close();
	}

	function onOpenRecord() {
		panel.endWorkflow();
		panel.close();
		void goto(entityRoute);
	}

	function onStartNext() {
		if (!nextTask?.workflowId) return;
		panel.startWorkflow(nextTask.workflowId, { docType: 'invoice_in' });
	}
</script>

<div class="done">
	<div class="done-icon">
		<CheckCircle2 size={36} strokeWidth={1.6} />
	</div>
	<div class="done-title">Recorded.</div>
	<div class="done-sub">
		{#if supplierName}
			{supplierName} invoice is in your finance records.
		{:else}
			The invoice is in your finance records.
		{/if}
	</div>

	{#if entityId}
		<div class="meta">
			<div class="meta-row">
				<span class="meta-label">Record ID</span>
				<span class="meta-val">{entityId}</span>
			</div>
			{#if auditRef}
				<div class="meta-row">
					<span class="meta-label">Audit ref</span>
					<span class="meta-val">{auditRef}</span>
				</div>
			{/if}
		</div>
	{/if}

	<div class="primary-actions">
		<button type="button" class="btn-ghost" onclick={onClose}>Back to Today</button>
		<button type="button" class="btn-primary" onclick={onOpenRecord}>
			Open in Finance <ArrowUpRight size={13} strokeWidth={2} />
		</button>
	</div>

	{#if nextTask}
		<div class="next-card">
			<span class="next-eyebrow">Next up</span>
			<div class="next-title">{nextTask.title}</div>
			<div class="next-detail">{nextTask.detail}</div>
			{#if nextTask.workflowId}
				<button type="button" class="btn-link" onclick={onStartNext}>
					Take it now →
				</button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.done {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 14px;
		padding: 48px 28px 40px;
		text-align: center;
		background: var(--panel-surface);
		border: 1px solid var(--panel-border);
		border-radius: 20px;
	}
	.done-icon {
		display: inline-flex;
		width: 64px;
		height: 64px;
		align-items: center;
		justify-content: center;
		border-radius: 18px;
		background: rgba(95, 181, 94, 0.08);
		border: 1px solid rgba(95, 181, 94, 0.4);
		color: var(--panel-green-bright);
		box-shadow: 0 0 24px -6px rgba(95, 181, 94, 0.3);
	}
	.done-title {
		font-size: 22px;
		font-weight: 500;
		color: var(--panel-fg);
		letter-spacing: -0.005em;
	}
	.done-sub {
		font-size: 13.5px;
		color: var(--panel-fg-muted);
		max-width: 44ch;
		line-height: 1.55;
	}

	.meta {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 12px 16px;
		background: var(--panel-surface-raised);
		border: 1px solid var(--panel-border);
		border-radius: 10px;
		font-variant-numeric: tabular-nums;
		min-width: min(360px, 80%);
	}
	.meta-row {
		display: flex;
		justify-content: space-between;
		gap: 14px;
		font-size: 11.5px;
	}
	.meta-label {
		color: var(--panel-fg-faint);
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	.meta-val {
		color: var(--panel-fg);
		font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
		font-size: 11px;
	}

	.primary-actions {
		display: inline-flex;
		gap: 10px;
		margin-top: 6px;
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
	.btn-ghost:hover {
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

	.next-card {
		margin-top: 14px;
		padding: 14px 18px;
		background: var(--panel-surface-raised);
		border: 1px solid var(--panel-border);
		border-radius: 14px;
		text-align: left;
		max-width: 420px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.next-eyebrow {
		font-size: 10px;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--panel-gold);
	}
	.next-title {
		font-size: 14px;
		font-weight: 500;
		color: var(--panel-fg);
		margin-top: 4px;
	}
	.next-detail {
		font-size: 12.5px;
		color: var(--panel-fg-muted);
		line-height: 1.5;
	}
	.btn-link {
		align-self: flex-start;
		margin-top: 6px;
		background: none;
		border: none;
		padding: 0;
		font-family: inherit;
		font-size: 12.5px;
		font-weight: 500;
		color: var(--panel-gold-bright);
		cursor: pointer;
	}
	.btn-link:hover {
		text-decoration: underline;
	}
</style>
