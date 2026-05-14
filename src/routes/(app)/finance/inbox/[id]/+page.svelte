<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import DocumentIntakeDiagnostics from '$app-layer/components/document-intake/DocumentIntakeDiagnostics.svelte';
	import InboxConfirmForm from '$app-layer/components/finance-inbox/InboxConfirmForm.svelte';
	import PageShell from '$app-layer/components/PageShell.svelte';
	import type { DocumentArtifactView } from '$modules/document-intake';

	let { data } = $props();

	interface CategoryChoice {
		id: string;
		label: string;
		sublabel?: string;
		bucket: 'expense' | 'revenue' | 'document_only';
		persistTarget: string | null;
		llmFields: readonly string[];
		userFields: readonly string[];
		requiresProject?: boolean;
	}

	const getArtifact = () => data.artifact as DocumentArtifactView;
	const getCategories = () => data.categories as CategoryChoice[];
	const artifact = getArtifact();
	const categories = getCategories();

	async function handleConfirmed() {
		await invalidateAll();
		setTimeout(() => goto('/finance/inbox'), 800);
	}

	async function handleAbandoned() {
		await invalidateAll();
		setTimeout(() => goto('/finance/inbox'), 800);
	}

	const formatDate = (iso: string) => {
		try {
			return new Date(iso).toLocaleString('en-SG', {
				year: 'numeric',
				month: 'short',
				day: 'numeric',
				hour: '2-digit',
				minute: '2-digit'
			});
		} catch {
			return iso;
		}
	};

	const documentTypeLabel: Record<string, string> = {
		supplier_invoice: 'Supplier invoice',
		customer_invoice: 'Customer invoice',
		receipt: 'Receipt',
		purchase_order: 'Purchase order',
		contract: 'Contract',
		quotation: 'Quotation',
		bank_statement: 'Bank statement',
		tax_document: 'Tax document',
		logistics_document: 'Logistics doc',
		unknown: 'Unknown'
	};

	const isReady = $derived(
		artifact.processingStatus === 'ready_for_review' ||
			artifact.processingStatus === 'ready_for_workflow'
	);
	const isConfirmed = $derived(artifact.processingStatus === 'confirmed');
	const isAbandoned = $derived(artifact.processingStatus === 'abandoned');
</script>

<PageShell
	eyebrow="Finance · Inbox"
	title={artifact.originalFile.fileName}
	description="Review the AI-suggested fields below. Change the category to re-extract. Confirm to persist."
>
	{#snippet actions()}
		<a
			href="/finance/inbox"
			class="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
		>
			← Back to inbox
		</a>
	{/snippet}

	{#if isConfirmed}
		<div class="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
			This document was confirmed and persisted. It stays in the Recently
			Confirmed tab for 30 days.
		</div>
	{:else if isAbandoned}
		<div class="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
			This intake was abandoned. No expense, revenue, or archive record was created.
			The uploaded file is retained for audit cleanup.
		</div>
	{:else if !isReady}
		<div class="rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
			Status: <span class="font-mono">{artifact.processingStatus}</span>. The
			document is still being processed; refresh the page in a moment.
		</div>
	{/if}

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
		<aside class="space-y-3 lg:col-span-1">
			<div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
				<h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Document</h3>
				<dl class="mt-3 space-y-2 text-sm">
					<div class="flex justify-between gap-4">
						<dt class="text-slate-500">Detected type</dt>
						<dd class="font-medium text-slate-900">
							{documentTypeLabel[artifact.documentType ?? 'unknown'] ?? 'Unknown'}
						</dd>
					</div>
					{#if artifact.classification?.confidence != null}
						<div class="flex justify-between gap-4">
							<dt class="text-slate-500">Classifier confidence</dt>
							<dd class="font-mono text-slate-700">
								{(artifact.classification.confidence * 100).toFixed(0)}%
							</dd>
						</div>
					{/if}
					{#if artifact.textExtraction?.method}
						<div class="flex justify-between gap-4">
							<dt class="text-slate-500">Text extraction</dt>
							<dd class="text-slate-700">{artifact.textExtraction.method}</dd>
						</div>
					{/if}
					<div class="flex justify-between gap-4">
						<dt class="text-slate-500">Uploaded</dt>
						<dd class="text-slate-700">{formatDate(artifact.createdAt)}</dd>
					</div>
					<div class="flex justify-between gap-4">
						<dt class="text-slate-500">Last update</dt>
						<dd class="text-slate-700">{formatDate(artifact.updatedAt)}</dd>
					</div>
				</dl>
			</div>

			{#if artifact.securityFlags && artifact.securityFlags.length > 0}
				<div class="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
					<p class="font-semibold">Flags</p>
					<ul class="mt-1 list-inside list-disc">
						{#each artifact.securityFlags as flag}
							<li>{flag}</li>
						{/each}
					</ul>
				</div>
			{/if}
		</aside>

		<div class="lg:col-span-2">
			<div class="space-y-4">
				{#if data.canViewDiagnostics}
					<DocumentIntakeDiagnostics {artifact} />
				{/if}
				<InboxConfirmForm
					{artifact}
					{categories}
					cancelHref="/finance/inbox"
					onConfirmed={handleConfirmed}
					onAbandoned={handleAbandoned}
				/>
			</div>
		</div>
	</div>
</PageShell>
