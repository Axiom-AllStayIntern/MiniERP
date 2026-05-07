<script lang="ts">
	import { Receipt, Wallet, FileText, LineChart, Sparkles, CornerDownLeft, Inbox } from 'lucide-svelte';
	import { panel } from '$app-layer/ai-panel/workflow/panel.svelte';
	import { mockQuickActions } from '$app-layer/ai-panel/workflow/mock/today-brief';
	import type { QuickAction } from '$app-layer/ai-panel/workflow/types';

	let input = $state('');
	let inputEl: HTMLInputElement | null = $state(null);

	const iconFor = (name: string) => {
		switch (name) {
			case 'receipt':
				return Receipt;
			case 'wallet':
				return Wallet;
			case 'file-text':
				return FileText;
			case 'line-chart':
				return LineChart;
			case 'inbox':
				return Inbox;
			default:
				return Sparkles;
		}
	};

	function onActionClick(action: QuickAction) {
		if (action.workflowId) {
			panel.startWorkflow(action.workflowId, action.workflowHint);
		}
	}

	function onSubmit(e: Event) {
		e.preventDefault();
		input = '';
	}
</script>

<div class="quick">
	<div class="quick-row">
		{#each mockQuickActions as action (action.id)}
			{@const Icon = iconFor(action.icon)}
			<button type="button" class="quick-chip" onclick={() => onActionClick(action)}>
				<span class="quick-chip-icon"><Icon size={14} strokeWidth={2} /></span>
				<span>{action.label}</span>
			</button>
		{/each}
	</div>

	<form class="quick-input" onsubmit={onSubmit}>
		<span class="quick-input-icon">
			<Sparkles size={15} strokeWidth={2} />
		</span>
		<input
			bind:this={inputEl}
			bind:value={input}
			type="text"
			placeholder="Tell me what you want to do..."
			autocomplete="off"
			spellcheck="false"
		/>
		{#if input.trim().length > 0}
			<span class="quick-input-enter">
				<CornerDownLeft size={12} strokeWidth={2} />
			</span>
		{/if}
	</form>
</div>

<style>
	.quick {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.quick-row {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.quick-chip {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 7px 13px 7px 11px;
		font-family: inherit;
		font-size: 12.5px;
		font-weight: 500;
		color: var(--panel-gold-bright);
		background: rgba(234, 188, 60, 0.04);
		border: 1px solid rgba(234, 188, 60, 0.2);
		border-radius: 999px;
		cursor: pointer;
		transition: all var(--panel-dur-fast) var(--panel-ease);
	}
	.quick-chip-icon {
		display: inline-flex;
		color: var(--panel-gold);
	}
	.quick-chip:hover {
		color: #2d1f08;
		background: var(--panel-gold);
		border-color: var(--panel-gold-bright);
		box-shadow: 0 0 18px -2px var(--panel-gold-glow);
	}
	.quick-chip:hover .quick-chip-icon {
		color: #2d1f08;
	}
	.quick-chip:active {
		transform: translateY(1px);
	}

	.quick-input {
		position: relative;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 0 12px;
		background: var(--panel-surface-deep);
		border: 1px solid var(--panel-border);
		border-radius: 12px;
		transition:
			border-color var(--panel-dur-fast) var(--panel-ease),
			box-shadow var(--panel-dur-fast) var(--panel-ease);
	}
	.quick-input:focus-within {
		border-color: var(--panel-border-strong);
		box-shadow: 0 0 0 3px rgba(234, 188, 60, 0.08);
	}
	.quick-input-icon {
		display: inline-flex;
		color: var(--panel-gold);
		flex-shrink: 0;
	}
	.quick-input input {
		flex: 1;
		border: 0;
		outline: none;
		background: transparent;
		padding: 11px 0;
		color: var(--panel-fg);
		font-size: 13.5px;
		font-family: inherit;
	}
	.quick-input input::placeholder {
		color: var(--panel-fg-faint);
	}
	.quick-input-enter {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		border-radius: 6px;
		background: var(--panel-gold);
		color: #2d1f08;
		box-shadow: 0 0 12px -2px var(--panel-gold-glow);
	}
</style>
