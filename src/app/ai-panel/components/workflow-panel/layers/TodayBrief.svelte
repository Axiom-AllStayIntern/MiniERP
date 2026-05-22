<script lang="ts">
	import { ArrowRight, Clock, AlertCircle, CheckCircle2 } from 'lucide-svelte';
	import { panel } from '$app-layer/ai-panel/workflow/panel.svelte';
	import type { BriefItem } from '$app-layer/ai-panel/workflow/types';

	interface BriefApiResponse {
		items: BriefItem[];
		greeting: string;
	}

	async function fetchBriefItems(): Promise<BriefApiResponse> {
		const res = await fetch('/api/finance/today-brief');
		if (!res.ok) throw new Error('failed');
		return res.json() as Promise<BriefApiResponse>;
	}

	let briefPromise = $state(fetchBriefItems());

	function onItemClick(item: BriefItem) {
		if (item.workflowId) {
			panel.startWorkflow(item.workflowId, item.workflowHint);
		}
	}
</script>

{#await briefPromise}
	<section class="brief">
		<header class="brief-header">
			<div class="brief-eyebrow">
				<span class="brief-eyebrow-dot"></span>
				Today
			</div>
			<div class="skeleton skeleton-headline"></div>
			<div class="skeleton skeleton-subhead"></div>
		</header>
		<ul class="brief-list">
			{#each [0, 1, 2] as i (i)}
				<li>
					<div class="quest skeleton-quest"></div>
				</li>
			{/each}
		</ul>
	</section>
{:then brief}
	<section class="brief">
		<header class="brief-header">
			<div class="brief-eyebrow">
				<span class="brief-eyebrow-dot"></span>
				Today
			</div>
			<h2 class="brief-headline">{brief.greeting}</h2>
			{#if brief.items.length > 0}
				<p class="brief-subhead">I've done the boring parts. Tap a quest to pick up where I left off.</p>
			{/if}
		</header>

		{#if brief.items.length === 0}
			<p class="brief-empty">Nothing pending — enjoy the quiet.</p>
		{:else}
			<ul class="brief-list">
				{#each brief.items as item, i (item.id)}
					<li style={`--stagger: ${i * 60}ms;`}>
						<button
							type="button"
							class="quest"
							class:is-urgent={item.urgency === 'overdue'}
							class:is-duesoon={item.urgency === 'due-soon'}
							class:no-action={!item.workflowId}
							onclick={() => onItemClick(item)}
						>
							<span class="quest-glow" aria-hidden="true"></span>
							<span class="quest-icon">
								{#if item.urgency === 'overdue'}
									<AlertCircle size={18} strokeWidth={2} />
								{:else if item.urgency === 'due-soon'}
									<Clock size={18} strokeWidth={2} />
								{:else}
									<CheckCircle2 size={18} strokeWidth={2} />
								{/if}
							</span>
							<span class="quest-body">
								<span class="quest-title">{item.title}</span>
								<span class="quest-detail">{item.detail}</span>
							</span>
							{#if item.count !== undefined && item.count > 1}
								<span class="quest-count num">{item.count}</span>
							{/if}
							{#if item.workflowId}
								<span class="quest-chevron">
									<ArrowRight size={16} strokeWidth={2} />
								</span>
							{/if}
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
{:catch}
	<section class="brief">
		<header class="brief-header">
			<div class="brief-eyebrow">
				<span class="brief-eyebrow-dot"></span>
				Today
			</div>
		</header>
		<p class="brief-empty">Couldn't load today's tasks. Check your connection.</p>
	</section>
{/await}

<style>
	.brief {
		display: flex;
		flex-direction: column;
		gap: 28px;
	}

	.brief-eyebrow {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-size: 11px;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--panel-gold);
		margin-bottom: 10px;
	}
	.brief-eyebrow-dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--panel-gold);
		box-shadow: 0 0 10px var(--panel-gold-glow);
	}

	.brief-headline {
		font-size: clamp(22px, 2.6vw, 30px);
		font-weight: 500;
		line-height: 1.3;
		color: var(--panel-fg);
		margin: 0 0 10px 0;
		max-width: 22ch;
		letter-spacing: -0.01em;
	}
	.brief-subhead {
		font-size: 13.5px;
		line-height: 1.5;
		color: var(--panel-fg-muted);
		margin: 0;
		max-width: 52ch;
	}

	.brief-empty {
		font-size: 13.5px;
		color: var(--panel-fg-faint);
		margin: 0;
	}

	/* Loading skeletons */
	.skeleton {
		background: linear-gradient(
			90deg,
			rgba(255, 255, 255, 0.04) 25%,
			rgba(255, 255, 255, 0.08) 50%,
			rgba(255, 255, 255, 0.04) 75%
		);
		background-size: 200% 100%;
		animation: shimmer 1.4s infinite;
		border-radius: 6px;
	}
	.skeleton-headline {
		height: 28px;
		width: 70%;
		margin-bottom: 10px;
	}
	.skeleton-subhead {
		height: 14px;
		width: 55%;
	}
	.skeleton-quest {
		height: 76px;
		width: 100%;
		border-radius: 14px;
	}
	@keyframes shimmer {
		0% { background-position: 200% 0; }
		100% { background-position: -200% 0; }
	}

	.brief-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.brief-list li {
		animation: quest-in 420ms cubic-bezier(0.22, 1, 0.36, 1) backwards;
		animation-delay: var(--stagger);
	}
	@keyframes quest-in {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.quest {
		position: relative;
		width: 100%;
		display: grid;
		grid-template-columns: auto 1fr auto auto;
		align-items: center;
		gap: 16px;
		padding: 18px 20px;
		background:
			linear-gradient(135deg, rgba(234, 188, 60, 0.04), rgba(95, 181, 94, 0.03)),
			var(--panel-surface);
		border: 1px solid var(--panel-border);
		border-radius: 14px;
		color: var(--panel-fg);
		text-align: left;
		cursor: pointer;
		overflow: hidden;
		transition:
			transform var(--panel-dur-fast) var(--panel-ease),
			border-color var(--panel-dur-fast) var(--panel-ease),
			background var(--panel-dur-fast) var(--panel-ease);
	}
	.quest.no-action {
		cursor: default;
	}
	.quest::before {
		content: '';
		position: absolute;
		left: 0;
		top: 10%;
		bottom: 10%;
		width: 2px;
		background: linear-gradient(
			to bottom,
			transparent,
			var(--panel-gold) 50%,
			transparent
		);
		opacity: 0;
		transition: opacity var(--panel-dur-fast) var(--panel-ease);
	}
	.quest:not(.no-action):hover {
		transform: translateY(-2px);
		border-color: var(--panel-border-strong);
		background:
			linear-gradient(135deg, rgba(234, 188, 60, 0.08), rgba(95, 181, 94, 0.05)),
			var(--panel-surface-raised);
	}
	.quest:not(.no-action):hover::before {
		opacity: 1;
	}
	.quest:not(.no-action):active {
		transform: translateY(-1px);
	}

	.quest-glow {
		position: absolute;
		pointer-events: none;
		inset: -40%;
		background: radial-gradient(circle at 85% 50%, var(--panel-gold-soft), transparent 55%);
		opacity: 0;
		transition: opacity var(--panel-dur-base) var(--panel-ease);
	}
	.quest:not(.no-action):hover .quest-glow {
		opacity: 1;
	}

	.quest-icon {
		position: relative;
		width: 40px;
		height: 40px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 12px;
		background: rgba(234, 188, 60, 0.06);
		border: 1px solid rgba(234, 188, 60, 0.14);
		color: var(--panel-gold-bright);
	}
	.quest.is-duesoon .quest-icon {
		background: var(--panel-gold-soft);
		border-color: rgba(234, 188, 60, 0.28);
		color: var(--panel-gold-bright);
		box-shadow: 0 0 18px -4px var(--panel-gold-glow);
	}
	.quest.is-urgent .quest-icon {
		background: rgba(225, 118, 118, 0.14);
		border-color: rgba(225, 118, 118, 0.3);
		color: var(--panel-danger);
	}

	.quest-body {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}
	.quest-title {
		font-size: 15px;
		font-weight: 500;
		color: var(--panel-fg);
		letter-spacing: -0.005em;
	}
	.quest-detail {
		font-size: 12.5px;
		line-height: 1.55;
		color: var(--panel-fg-muted);
	}

	.quest-count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 26px;
		height: 24px;
		padding: 0 8px;
		border-radius: 999px;
		background: var(--panel-gold);
		color: #2d1f08;
		font-size: 12px;
		font-weight: 600;
		box-shadow: 0 0 14px -2px var(--panel-gold-glow);
	}

	.quest-chevron {
		color: var(--panel-fg-faint);
		transition:
			transform var(--panel-dur-fast) var(--panel-ease),
			color var(--panel-dur-fast) var(--panel-ease);
	}
	.quest:not(.no-action):hover .quest-chevron {
		color: var(--panel-gold-bright);
		transform: translateX(3px);
	}
</style>
