<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { AlertTriangle, AlertOctagon, Sparkles, Check } from 'lucide-svelte';
	import { panel } from '$lib/workflow/panel.svelte';
	import { advanceWorkflow, type MatchingResult } from '$lib/workflow/finance-invoice-api';

	const wfState = $derived((panel.activeWorkflow?.state as Record<string, unknown>) ?? {});
	const matching = $derived(wfState.matching as MatchingResult | undefined);
	const selectedSupplierId = $derived<string | null>(
		(wfState.selectedSupplierId as string | null | undefined) ?? null
	);
	const selectedPoId = $derived<string | null>(
		(wfState.selectedPoId as string | null | undefined) ?? null
	);

	let stage = $state<'loading' | 'ready' | 'error'>('loading');
	let error = $state('');
	let started = false;
	let advancing = $state(false);

	function autoSeedSelections(result: MatchingResult) {
		const patch: Record<string, unknown> = {};
		if (!selectedSupplierId && result.supplierCandidates[0]) {
			patch.selectedSupplierId = result.supplierCandidates[0].id;
		}
		if (!selectedPoId && result.poCandidates[0]) {
			patch.selectedPoId = result.poCandidates[0].id;
		}
		if (Object.keys(patch).length) panel.patchState(patch);
	}

	async function loadMatches() {
		const serverWorkflowId = wfState.serverWorkflowId as string | undefined;
		if (!serverWorkflowId) {
			error = 'Workflow lost its server id.';
			stage = 'error';
			return;
		}

		try {
			const advance = await advanceWorkflow(serverWorkflowId, { targetStep: 'matching' });
			panel.patchState({
				serverStep: advance.currentStep,
				matching: advance.state.data.matching
			});
			const result = advance.state.data.matching as MatchingResult | undefined;
			if (result) autoSeedSelections(result);
			stage = 'ready';
		} catch (e) {
			error = e instanceof Error ? e.message : 'Match lookup failed';
			stage = 'error';
		}
	}

	onMount(() => {
		if (started) return;
		started = true;
		// Skip if we already have matching data (user hopped back via TaskLine)
		if (matching) {
			stage = 'ready';
			autoSeedSelections(matching);
			return;
		}
		untrack(() => {
			void loadMatches();
		});
	});

	function pickSupplier(id: string) {
		panel.patchState({ selectedSupplierId: id });
	}
	function pickPo(id: string) {
		panel.patchState({ selectedPoId: id });
	}
	function clearPo() {
		panel.patchState({ selectedPoId: null });
	}

	async function onContinue() {
		const serverWorkflowId = wfState.serverWorkflowId as string | undefined;
		if (!serverWorkflowId) return;
		advancing = true;
		try {
			const advance = await advanceWorkflow(serverWorkflowId, {
				targetStep: 'user_confirmation'
			});
			panel.patchState({ serverStep: advance.currentStep });
			panel.advanceStep();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Could not advance';
			stage = 'error';
		} finally {
			advancing = false;
		}
	}

	function onBack() {
		panel.setStep(2);
	}

	function pct(score: number): number {
		return Math.round(score * 100);
	}

	function formatAmount(value: number, currency: string): string {
		return `${currency} ${value.toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
	}
</script>

{#if stage === 'loading'}
	<div class="loading">
		<div class="ripple" aria-hidden="true">
			<span class="ripple-dot"></span>
			<span class="ripple-dot"></span>
			<span class="ripple-dot"></span>
		</div>
		<div class="loading-title">Looking for matches…</div>
		<div class="loading-sub">Supplier directory · open POs · duplicate check</div>
	</div>
{:else if stage === 'error'}
	<div class="match-error">
		<span class="err-icon"><AlertTriangle size={24} strokeWidth={1.8} /></span>
		<div class="err-title">I hit a snag</div>
		<p class="err-sub">{error}</p>
		<button type="button" class="btn-secondary" onclick={onBack}>Back to fields</button>
	</div>
{:else if matching}
	<div class="step">
		{#if matching.duplicate.isDuplicate}
			<div class="dup-banner" role="alert">
				<span class="dup-icon"><AlertOctagon size={16} strokeWidth={2} /></span>
				<div class="dup-body">
					<div class="dup-title">Possible duplicate</div>
					<div class="dup-sub">{matching.duplicate.reason ?? 'A similar record is already on file.'}</div>
				</div>
			</div>
		{/if}

		<section class="block">
			<header class="block-header">
				<h3 class="block-title">Supplier</h3>
				<span class="block-sub">Top {matching.supplierCandidates.length} candidates</span>
			</header>

			{#if matching.supplierCandidates.length === 0}
				<div class="empty">No matching supplier in directory. The Stage 5 confirm step will treat this as a new supplier.</div>
			{:else}
				<ul class="cards">
					{#each matching.supplierCandidates as candidate, idx (candidate.id)}
						{@const isSelected = selectedSupplierId === candidate.id}
						<li>
							<button
								type="button"
								class="row"
								class:is-selected={isSelected}
								onclick={() => pickSupplier(candidate.id)}
							>
								<span class="row-main">
									<span class="row-name">{candidate.name}</span>
									<span class="row-meta">{candidate.recentInvoiceCount} recent invoices</span>
								</span>
								<span class="row-aside">
									<span class="score">{pct(candidate.matchScore)}%</span>
									{#if idx === 0}
										<span class="ai-pick" title="AI's pick"><Sparkles size={11} strokeWidth={2} /></span>
									{/if}
									{#if isSelected}
										<span class="check"><Check size={13} strokeWidth={2.5} /></span>
									{/if}
								</span>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<section class="block">
			<header class="block-header">
				<h3 class="block-title">Purchase order</h3>
				<span class="block-sub">
					{#if matching.poCandidates.length}
						Top {matching.poCandidates.length} candidates
					{:else}
						None found · invoice will be standalone
					{/if}
				</span>
			</header>

			{#if matching.poCandidates.length === 0}
				<div class="empty">No PO candidates. Continue without one.</div>
			{:else}
				<ul class="cards">
					{#each matching.poCandidates as candidate, idx (candidate.id)}
						{@const isSelected = selectedPoId === candidate.id}
						<li>
							<button
								type="button"
								class="row"
								class:is-selected={isSelected}
								onclick={() => pickPo(candidate.id)}
							>
								<span class="row-main">
									<span class="row-name">{candidate.poNumber}</span>
									<span class="row-meta">
										{candidate.supplierName} · {formatAmount(candidate.totalAmount, candidate.currency)}
									</span>
								</span>
								<span class="row-aside">
									<span class="score">{pct(candidate.matchScore)}%</span>
									{#if idx === 0}
										<span class="ai-pick" title="AI's pick"><Sparkles size={11} strokeWidth={2} /></span>
									{/if}
									{#if isSelected}
										<span class="check"><Check size={13} strokeWidth={2.5} /></span>
									{/if}
								</span>
							</button>
						</li>
					{/each}
				</ul>
				{#if selectedPoId}
					<button type="button" class="link-btn" onclick={clearPo}>No PO for this invoice</button>
				{/if}
			{/if}
		</section>

		<div class="actions">
			<button type="button" class="btn-ghost" onclick={onBack}>← Fields</button>
			<button
				type="button"
				class="btn-primary"
				onclick={onContinue}
				disabled={advancing || !selectedSupplierId}
			>
				{advancing ? 'Going…' : 'Continue →'}
			</button>
		</div>
	</div>
{/if}

<style>
	.loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		padding: 56px 28px;
		background: var(--panel-surface);
		border: 1px solid var(--panel-border);
		border-radius: 18px;
	}
	.ripple {
		display: inline-flex;
		gap: 10px;
	}
	.ripple-dot {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: var(--panel-gold);
		box-shadow: 0 0 12px -2px var(--panel-gold-glow);
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
	.loading-title {
		font-size: 16px;
		font-weight: 500;
		color: var(--panel-fg);
	}
	.loading-sub {
		font-size: 11.5px;
		color: var(--panel-fg-faint);
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.step {
		display: flex;
		flex-direction: column;
		gap: 18px;
	}

	.dup-banner {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		padding: 12px 14px;
		background: rgba(225, 118, 118, 0.06);
		border: 1px solid rgba(225, 118, 118, 0.32);
		border-radius: 12px;
		color: var(--panel-fg);
	}
	.dup-icon {
		flex-shrink: 0;
		display: inline-flex;
		width: 28px;
		height: 28px;
		align-items: center;
		justify-content: center;
		border-radius: 8px;
		background: rgba(225, 118, 118, 0.12);
		color: var(--panel-danger);
	}
	.dup-title {
		font-size: 13px;
		font-weight: 500;
		color: var(--panel-fg);
	}
	.dup-sub {
		font-size: 12.5px;
		color: var(--panel-fg-muted);
		line-height: 1.5;
	}

	.block {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.block-header {
		display: flex;
		align-items: baseline;
		gap: 10px;
	}
	.block-title {
		font-size: 14px;
		font-weight: 500;
		color: var(--panel-fg);
		margin: 0;
	}
	.block-sub {
		font-size: 11px;
		color: var(--panel-fg-faint);
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.cards {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		width: 100%;
		padding: 12px 16px;
		background: var(--panel-surface);
		border: 1px solid var(--panel-border);
		border-radius: 12px;
		font-family: inherit;
		text-align: left;
		cursor: pointer;
		transition: all var(--panel-dur-fast) var(--panel-ease);
	}
	.row:hover {
		border-color: var(--panel-gold);
		background: var(--panel-surface-raised);
	}
	.row.is-selected {
		border-color: var(--panel-gold-bright);
		background: var(--panel-surface-raised);
		box-shadow: 0 0 18px -6px var(--panel-gold-glow);
	}

	.row-main {
		display: flex;
		flex-direction: column;
		gap: 3px;
		min-width: 0;
		flex: 1;
	}
	.row-name {
		font-size: 13.5px;
		font-weight: 500;
		color: var(--panel-fg);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.row-meta {
		font-size: 11.5px;
		color: var(--panel-fg-faint);
		font-variant-numeric: tabular-nums;
	}

	.row-aside {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		flex-shrink: 0;
	}
	.score {
		font-size: 11.5px;
		font-variant-numeric: tabular-nums;
		color: var(--panel-fg-muted);
		padding: 2px 8px;
		border: 1px solid var(--panel-border-strong);
		border-radius: 999px;
	}
	.row.is-selected .score {
		color: var(--panel-gold-bright);
		border-color: rgba(234, 188, 60, 0.5);
	}
	.ai-pick {
		display: inline-flex;
		width: 18px;
		height: 18px;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		background: rgba(234, 188, 60, 0.12);
		color: var(--panel-gold-bright);
	}
	.check {
		display: inline-flex;
		width: 20px;
		height: 20px;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		background: var(--panel-gold);
		color: #2d1f08;
	}

	.empty {
		padding: 14px 16px;
		font-size: 13px;
		color: var(--panel-fg-muted);
		background: var(--panel-surface);
		border: 1px dashed var(--panel-border);
		border-radius: 12px;
	}

	.link-btn {
		align-self: flex-start;
		background: none;
		border: none;
		padding: 6px 0;
		font-family: inherit;
		font-size: 12px;
		color: var(--panel-fg-muted);
		cursor: pointer;
		text-decoration: underline;
	}
	.link-btn:hover {
		color: var(--panel-gold-bright);
	}

	.actions {
		display: flex;
		justify-content: space-between;
		gap: 10px;
	}
	.btn-ghost,
	.btn-primary,
	.btn-secondary {
		padding: 9px 18px;
		border-radius: 10px;
		font-family: inherit;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		transition: all var(--panel-dur-fast) var(--panel-ease);
	}
	.btn-ghost,
	.btn-secondary {
		background: transparent;
		border: 1px solid var(--panel-border-strong);
		color: var(--panel-fg-muted);
	}
	.btn-ghost:hover,
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
	.btn-primary:hover:not(:disabled) {
		background: var(--panel-gold-bright);
	}
	.btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.match-error {
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
</style>
