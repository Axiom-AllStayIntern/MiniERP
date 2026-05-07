<script lang="ts">
	import { panel } from '$app-layer/ai-panel/workflow/panel.svelte';
	import { getWorkflow } from '$app-layer/ai-panel/workflow/registry';
	// Generic doc-intake (legacy)
	import DropZone from './intake/DropZone.svelte';
	import LegacyClassifyingStage from './intake/ClassifyingStage.svelte';
	import LegacyBucketStep from './intake/BucketStep.svelte';
	import LegacyKindStep from './intake/KindStep.svelte';
	import LegacyProjectStep from './intake/ProjectStep.svelte';
	import LegacyReviewStep from './intake/ReviewStep.svelte';
	// Phase 1+2 vendor-invoice-intake
	import UploadStep from './finance-invoice/UploadStep.svelte';
	import ExtractingStage from './finance-invoice/ExtractingStage.svelte';
	import FieldsReviewStep from './finance-invoice/FieldsReviewStep.svelte';
	import MatchesStep from './finance-invoice/MatchesStep.svelte';
	import ConfirmStep from './finance-invoice/ConfirmStep.svelte';
	import DoneStep from './finance-invoice/DoneStep.svelte';
	// Phase 3 financial-document-intake (unified)
	import DocUploadStep from './finance-document-intake/UploadStep.svelte';
	import DocBucketStep from './finance-document-intake/BucketStep.svelte';
	import DocKindStep from './finance-document-intake/KindStep.svelte';
	import DocExtractingStage from './finance-document-intake/ExtractingStage.svelte';
	import DocMatchesStep from './finance-document-intake/MatchesStep.svelte';
	import DocProjectStep from './finance-document-intake/ProjectStep.svelte';
	import DocConfirmStep from './finance-document-intake/ConfirmStep.svelte';
	import FinanceInboxLayer from './finance-inbox/InboxLayer.svelte';
	// Phase 3 stage 5 allowance-recording (no document)
	import AllowanceFormStep from './finance-allowance/AllowanceFormStep.svelte';
	import AllowanceConfirmStep from './finance-allowance/AllowanceConfirmStep.svelte';

	const workflow = $derived(
		panel.activeWorkflow ? getWorkflow(panel.activeWorkflow.workflowId) : undefined
	);
	const workflowId = $derived(panel.activeWorkflow?.workflowId);
	const stepIndex = $derived(panel.activeWorkflow?.stepIndex ?? 0);

	// document-intake's review step takes the whole column at stepIndex 5;
	// vendor-invoice-intake hides the intro at the Done step; the unified
	// financial-document-intake hides the intro at its Done step (index 8).
	const showIntro = $derived.by(() => {
		if (!workflow) return false;
		if (workflowId === 'document-intake') return stepIndex < 5;
		if (workflowId === 'vendor-invoice-intake') return stepIndex < 5;
		if (workflowId === 'financial-document-intake') return stepIndex < 8;
		if (workflowId === 'finance-inbox') return false;
		if (workflowId === 'allowance-recording') return stepIndex < 2;
		return true;
	});
</script>

<section class="flow">
	{#if workflow}
		{#if showIntro}
			<div class="flow-intro">
				<div class="flow-eyebrow">
					<span class="flow-eyebrow-dot"></span>
					Quest in progress
				</div>
				<h2 class="flow-title">{workflow.title}</h2>
				<p class="flow-sub">{workflow.description}</p>
			</div>
		{/if}

		{#if workflowId === 'document-intake'}
			{#if stepIndex === 0}
				<DropZone />
			{:else if stepIndex === 1}
				<LegacyClassifyingStage />
			{:else if stepIndex === 2}
				<LegacyBucketStep />
			{:else if stepIndex === 3}
				<LegacyKindStep />
			{:else if stepIndex === 4}
				<LegacyProjectStep />
			{:else if stepIndex === 5}
				<LegacyReviewStep />
			{/if}
		{:else if workflowId === 'vendor-invoice-intake'}
			{#if stepIndex === 0}
				<UploadStep />
			{:else if stepIndex === 1}
				<ExtractingStage />
			{:else if stepIndex === 2}
				<FieldsReviewStep />
			{:else if stepIndex === 3}
				<MatchesStep />
			{:else if stepIndex === 4}
				<ConfirmStep />
			{:else if stepIndex === 5}
				<DoneStep />
			{/if}
		{:else if workflowId === 'financial-document-intake'}
			{#if stepIndex === 0}
				<DocUploadStep />
			{:else if stepIndex === 1}
				<DocBucketStep />
			{:else if stepIndex === 2}
				<DocKindStep />
			{:else if stepIndex === 3}
				<DocExtractingStage />
			{:else if stepIndex === 4}
				<FieldsReviewStep />
			{:else if stepIndex === 5}
				<DocMatchesStep />
			{:else if stepIndex === 6}
				<DocProjectStep />
			{:else if stepIndex === 7}
				<DocConfirmStep />
			{:else if stepIndex === 8}
				<DoneStep />
			{/if}
		{:else if workflowId === 'finance-inbox'}
			<FinanceInboxLayer />
		{:else if workflowId === 'allowance-recording'}
			{#if stepIndex === 0}
				<AllowanceFormStep />
			{:else if stepIndex === 1}
				<AllowanceConfirmStep />
			{:else if stepIndex === 2}
				<DoneStep />
			{/if}
		{/if}
	{/if}
</section>

<style>
	.flow {
		display: flex;
		flex-direction: column;
		gap: 22px;
		min-height: 0;
	}

	.flow-eyebrow {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-size: 11px;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--panel-gold);
		margin-bottom: 10px;
	}
	.flow-eyebrow-dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--panel-gold);
		box-shadow: 0 0 10px var(--panel-gold-glow);
	}

	.flow-title {
		font-size: clamp(22px, 2.6vw, 30px);
		font-weight: 500;
		line-height: 1.25;
		color: var(--panel-fg);
		margin: 0 0 8px 0;
		letter-spacing: -0.01em;
	}
	.flow-sub {
		font-size: 13.5px;
		line-height: 1.55;
		color: var(--panel-fg-muted);
		margin: 0;
		max-width: 52ch;
	}
</style>
