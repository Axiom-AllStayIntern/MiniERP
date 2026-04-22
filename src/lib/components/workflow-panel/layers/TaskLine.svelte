<script lang="ts">
	import { Home, Check } from 'lucide-svelte';
	import { panel } from '$lib/workflow/panel.svelte';
	import { getWorkflow } from '$lib/workflow/registry';

	const workflow = $derived(
		panel.activeWorkflow ? getWorkflow(panel.activeWorkflow.workflowId) : undefined
	);
	const stepIndex = $derived(panel.activeWorkflow?.stepIndex ?? 0);
	const steps = $derived(workflow?.steps ?? []);

	function onToday() {
		panel.endWorkflow();
	}
	function onStepClick(i: number) {
		panel.setStep(i);
	}
	function stateOf(i: number): 'done' | 'current' | 'pending' {
		if (i < stepIndex) return 'done';
		if (i === stepIndex) return 'current';
		return 'pending';
	}
</script>

<aside class="taskline" aria-label="Quest progress">
	<div class="rail" aria-hidden="true"></div>

	<ol class="bubbles">
		<li class="bubble-item">
			<button
				type="button"
				class="bubble home"
				class:is-active={!workflow}
				onclick={onToday}
				title="Back to Today"
				aria-label="Back to Today"
			>
				<Home size={13} strokeWidth={2} />
			</button>
			<span class="label">Today</span>
		</li>

		{#if workflow && steps.length}
			{#each steps as step, i (step.id)}
				{@const s = stateOf(i)}
				<li class="bubble-item" style={`--bob-delay: ${(i % 3) * 0.8}s;`}>
					<button
						type="button"
						class="bubble"
						class:is-done={s === 'done'}
						class:is-current={s === 'current'}
						class:is-pending={s === 'pending'}
						onclick={() => onStepClick(i)}
						title={step.label}
						aria-label={step.label}
						aria-current={s === 'current' ? 'step' : undefined}
					>
						{#if s === 'current'}
							<span class="halo" aria-hidden="true"></span>
						{/if}
						{#if s === 'done'}
							<Check size={13} strokeWidth={2.5} />
						{:else}
							<span class="num">{i + 1}</span>
						{/if}
					</button>
					<span class="label" class:dim={s === 'pending'}>{step.label}</span>
				</li>
			{/each}
		{/if}
	</ol>
</aside>

<style>
	.taskline {
		position: relative;
		flex: 0 0 auto;
		width: 96px;
		padding: 28px 6px 28px;
		display: flex;
		justify-content: center;
	}

	/* The vertical line that bubbles float along. */
	.rail {
		position: absolute;
		top: 28px;
		bottom: 28px;
		left: 50%;
		width: 1px;
		transform: translateX(-0.5px);
		background: linear-gradient(
			to bottom,
			transparent 0%,
			rgba(234, 188, 60, 0.35) 12%,
			rgba(95, 181, 94, 0.22) 55%,
			rgba(234, 188, 60, 0.12) 100%
		);
		pointer-events: none;
	}

	.bubbles {
		position: relative;
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 26px;
		z-index: 1;
	}

	.bubble-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		animation: bubble-bob 4.4s ease-in-out infinite;
		animation-delay: var(--bob-delay, 0s);
	}
	@keyframes bubble-bob {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-1.5px);
		}
	}

	.bubble {
		position: relative;
		width: 32px;
		height: 32px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		border: 1px solid var(--panel-border-strong);
		background: var(--panel-surface);
		color: var(--panel-fg-muted);
		font-family: inherit;
		cursor: pointer;
		padding: 0;
		transition:
			transform var(--panel-dur-fast) var(--panel-ease),
			border-color var(--panel-dur-fast) var(--panel-ease),
			background var(--panel-dur-fast) var(--panel-ease),
			color var(--panel-dur-fast) var(--panel-ease),
			box-shadow var(--panel-dur-fast) var(--panel-ease);
	}
	.bubble .num {
		font-size: 11.5px;
		font-weight: 500;
		font-variant-numeric: tabular-nums;
		line-height: 1;
	}
	.bubble:hover {
		transform: translateY(-1px);
		border-color: var(--panel-gold);
		color: var(--panel-gold-bright);
	}

	/* Home / Today bubble */
	.bubble.home {
		background: var(--panel-surface-raised);
		color: var(--panel-fg);
	}
	.bubble.home.is-active {
		border-color: var(--panel-gold);
		color: var(--panel-gold-bright);
		box-shadow: 0 0 14px -2px var(--panel-gold-glow);
	}

	/* Done — has floated up, warm gold outline + green check glow */
	.bubble.is-done {
		width: 28px;
		height: 28px;
		border-color: rgba(234, 188, 60, 0.5);
		background: rgba(95, 181, 94, 0.1);
		color: var(--panel-green-bright);
		box-shadow: 0 0 10px -3px var(--panel-gold-glow);
	}

	/* Current — large, luminous, breathing */
	.bubble.is-current {
		width: 44px;
		height: 44px;
		background: radial-gradient(circle at 32% 28%, #fbe38e 0%, #eabc3c 55%, #b9881a 100%);
		border-color: rgba(234, 188, 60, 0.8);
		color: #2d1f08;
		box-shadow:
			0 0 22px -2px var(--panel-gold-glow),
			inset 0 1px 0 rgba(255, 255, 255, 0.55),
			inset 0 -3px 8px rgba(120, 78, 6, 0.4);
	}
	.bubble.is-current .num {
		font-weight: 600;
		font-size: 13px;
		color: #2d1f08;
	}
	.bubble.is-current .halo {
		position: absolute;
		inset: -6px;
		border-radius: 50%;
		border: 1px solid var(--panel-gold);
		opacity: 0.55;
		animation: halo-pulse 2.4s cubic-bezier(0.2, 0.6, 0.2, 1) infinite;
		pointer-events: none;
	}
	@keyframes halo-pulse {
		0% {
			transform: scale(1);
			opacity: 0.55;
		}
		80% {
			opacity: 0.04;
		}
		100% {
			transform: scale(1.6);
			opacity: 0;
		}
	}

	/* Pending — dim, waiting under the surface */
	.bubble.is-pending {
		width: 26px;
		height: 26px;
		border-color: var(--panel-border);
		background: transparent;
		color: var(--panel-fg-faint);
	}
	.bubble.is-pending .num {
		font-size: 10.5px;
	}

	.label {
		font-size: 10px;
		letter-spacing: 0.02em;
		color: var(--panel-fg-muted);
		text-align: center;
		max-width: 88px;
		line-height: 1.25;
	}
	.label.dim {
		color: var(--panel-fg-faint);
	}
</style>
