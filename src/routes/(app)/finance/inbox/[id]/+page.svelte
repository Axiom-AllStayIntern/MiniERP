<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import PageShell from '$app-layer/components/PageShell.svelte';
	import { hashConfirmationPayload } from '$platform/workflow/payload-hash';
	import type { DocumentArtifactView } from '$modules/document-intake';

	let { data } = $props();

	interface CategoryChoice {
		id: string;
		label: string;
		sublabel: string;
		bucket: 'expense' | 'revenue' | 'document_only';
		persistTarget: string | null;
	}

	let artifact = $state<DocumentArtifactView>(data.artifact);
	const categories = data.categories as CategoryChoice[];

	let selectedCategoryId = $state<string>(
		artifact.suggestedCategoryId ?? categories[0]?.id ?? ''
	);

	// Editable field draft. Initialized from suggestedFields; user edits in
	// the form. Confirm posts the current draft.
	type Draft = {
		documentNumber: string;
		counterpartyName: string;
		currency: string;
		totalAmount: string; // string for input control; coerced on submit
		gstAmount: string;
		issueDate: string;
		dueDate: string;
	};

	const initialDraft = (a: DocumentArtifactView): Draft => {
		const f = (a.suggestedFields?.fields ?? {}) as Record<string, unknown>;
		const str = (k: string) => (typeof f[k] === 'string' ? (f[k] as string) : '');
		const num = (k: string) =>
			typeof f[k] === 'number' ? String(f[k]) : '';
		return {
			documentNumber: str('documentNumber'),
			counterpartyName: str('counterpartyName'),
			currency: str('currency') || 'SGD',
			totalAmount: num('totalAmount'),
			gstAmount: num('gstAmount'),
			issueDate: str('issueDate'),
			dueDate: str('dueDate')
		};
	};

	let draft = $state<Draft>(initialDraft(artifact));

	// Per-field confidence color hints (Option B from product decision):
	//   >0.85 → green check, 0.5-0.85 → amber warning, <0.5 → blank field
	const confidenceClass = (key: keyof Draft) => {
		const c = artifact.suggestedFields?.confidence?.[key];
		if (c == null) return 'border-slate-300';
		if (c >= 0.85) return 'border-emerald-300 bg-emerald-50/30';
		if (c >= 0.5) return 'border-amber-300 bg-amber-50/30';
		return 'border-slate-300';
	};

	const confidenceBadge = (key: keyof Draft) => {
		const c = artifact.suggestedFields?.confidence?.[key];
		if (c == null) return null;
		if (c >= 0.85) return { tone: 'text-emerald-700', label: '✓ high' };
		if (c >= 0.5) return { tone: 'text-amber-700', label: '⚠ check' };
		return { tone: 'text-slate-400', label: '· low' };
	};

	const selectedCategory = $derived(
		categories.find((c) => c.id === selectedCategoryId) ?? null
	);

	const persistTarget = $derived(selectedCategory?.persistTarget ?? null);
	const isArchiveOnly = $derived(persistTarget && persistTarget !== 'expenses' && persistTarget !== 'revenue');

	let isReclassifying = $state(false);
	let isConfirming = $state(false);
	let actionError = $state<string | null>(null);
	let successMsg = $state<string | null>(null);

	async function handleCategoryChange(newId: string) {
		if (newId === selectedCategoryId) return;
		const previousId = selectedCategoryId;
		selectedCategoryId = newId;
		isReclassifying = true;
		actionError = null;
		try {
			const res = await fetch(`/api/documents/${encodeURIComponent(artifact.id)}/reclassify`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ categoryId: newId })
			});
			if (!res.ok) {
				const err = (await res.json().catch(() => null)) as { error?: string } | null;
				throw new Error(err?.error ?? `Reclassify failed (${res.status})`);
			}
			const json = (await res.json()) as { data?: DocumentArtifactView };
			if (json.data) {
				artifact = json.data;
				draft = initialDraft(json.data);
			}
		} catch (err) {
			actionError = err instanceof Error ? err.message : 'Reclassify failed';
			selectedCategoryId = previousId; // revert dropdown on error
		} finally {
			isReclassifying = false;
		}
	}

	async function handleConfirm() {
		if (!selectedCategory) return;
		actionError = null;
		successMsg = null;
		isConfirming = true;

		const payload = {
			documentId: artifact.id,
			categoryId: selectedCategoryId,
			supplierId: null,
			poId: null,
			projectId: null,
			fields: {
				documentNumber: draft.documentNumber.trim(),
				counterpartyName: draft.counterpartyName.trim(),
				currency: (draft.currency || 'SGD').trim().toUpperCase(),
				totalAmount: Number(draft.totalAmount) || 0,
				gstAmount: Number(draft.gstAmount) || 0,
				issueDate: draft.issueDate.trim(),
				dueDate: (draft.dueDate || draft.issueDate).trim()
			}
		};

		try {
			const payloadHash = await hashConfirmationPayload(payload);
			const res = await fetch(`/api/documents/${encodeURIComponent(artifact.id)}/confirm`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ payload, payloadHash })
			});
			if (!res.ok) {
				const errBody = (await res.json().catch(() => null)) as
					| { error?: string; data?: { issues?: Array<{ field: string; message: string }> } }
					| null;
				const issues = errBody?.data?.issues
					?.map((i) => `${i.field}: ${i.message}`)
					.join('; ');
				throw new Error(errBody?.error ?? issues ?? `Confirm failed (${res.status})`);
			}
			const json = (await res.json()) as {
				data?: { entityId: string; entityRoute: string; categoryId: string };
			};
			if (json.data) {
				successMsg = `Confirmed. Created ${json.data.categoryId} record.`;
				// Brief pause so the user sees the confirmation, then route.
				await invalidateAll();
				setTimeout(() => goto('/finance/inbox'), 800);
			}
		} catch (err) {
			actionError = err instanceof Error ? err.message : 'Confirm failed';
		} finally {
			isConfirming = false;
		}
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

	const isReady = $derived(artifact.processingStatus === 'ready_for_review');
	const isConfirmed = $derived(artifact.processingStatus === 'confirmed');
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
	{:else if !isReady}
		<div class="rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
			Status: <span class="font-mono">{artifact.processingStatus}</span>. The
			document is still being processed; refresh the page in a moment.
		</div>
	{/if}

	{#if actionError}
		<div class="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
			{actionError}
		</div>
	{/if}
	{#if successMsg}
		<div class="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700" role="status">
			{successMsg}
		</div>
	{/if}

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
		<!-- Left: artifact metadata -->
		<aside class="space-y-3 lg:col-span-1">
			<div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
				<h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Document</h3>
				<dl class="mt-3 space-y-2 text-sm">
					<div class="flex justify-between">
						<dt class="text-slate-500">Detected type</dt>
						<dd class="font-medium text-slate-900">
							{documentTypeLabel[artifact.documentType ?? 'unknown'] ?? 'Unknown'}
						</dd>
					</div>
					{#if artifact.classification?.confidence != null}
						<div class="flex justify-between">
							<dt class="text-slate-500">Classifier confidence</dt>
							<dd class="font-mono text-slate-700">
								{(artifact.classification.confidence * 100).toFixed(0)}%
							</dd>
						</div>
					{/if}
					{#if artifact.textExtraction?.method}
						<div class="flex justify-between">
							<dt class="text-slate-500">Text extraction</dt>
							<dd class="text-slate-700">{artifact.textExtraction.method}</dd>
						</div>
					{/if}
					<div class="flex justify-between">
						<dt class="text-slate-500">Uploaded</dt>
						<dd class="text-slate-700">{formatDate(artifact.createdAt)}</dd>
					</div>
					<div class="flex justify-between">
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

		<!-- Right: confirmation form -->
		<div class="space-y-4 lg:col-span-2">
			<!-- Category picker -->
			<div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
				<div class="flex items-center justify-between">
					<div>
						<h3 class="text-sm font-semibold text-slate-900">Category</h3>
						<p class="text-xs text-slate-500">
							Changing the category re-extracts fields from the same text — no re-upload needed.
						</p>
					</div>
					{#if isReclassifying}
						<span class="text-xs text-slate-500">Re-extracting…</span>
					{/if}
				</div>
				<select
					class="mt-3 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-[var(--sf-green)] focus:outline-none focus:ring-1 focus:ring-[var(--sf-green)]"
					style="--sf-green: #387234;"
					value={selectedCategoryId}
					onchange={(e) => handleCategoryChange((e.currentTarget as HTMLSelectElement).value)}
					disabled={isReclassifying || isConfirming || isConfirmed}
				>
					{#each ['expense', 'revenue', 'document_only'] as bucket}
						<optgroup label={bucket === 'expense' ? 'Expense' : bucket === 'revenue' ? 'Revenue' : 'Archive only'}>
							{#each categories.filter((c) => c.bucket === bucket) as cat}
								<option value={cat.id}>{cat.label} — {cat.sublabel}</option>
							{/each}
						</optgroup>
					{/each}
				</select>
				{#if isArchiveOnly}
					<p class="mt-2 text-xs text-amber-700">
						Archive-only categories don't write to expenses/revenue yet — confirmation will be queued for the project-side flow (501 until shipped).
					</p>
				{/if}
			</div>

			<!-- Field form -->
			<form
				class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
				onsubmit={(e) => {
					e.preventDefault();
					void handleConfirm();
				}}
			>
				<h3 class="text-sm font-semibold text-slate-900">Suggested fields</h3>
				<p class="text-xs text-slate-500">
					Edit anything that looks wrong before confirming. Field colors hint at AI confidence.
				</p>

				<div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
					<label class="block text-sm">
						<span class="font-medium text-slate-700">Document number</span>
						{#if confidenceBadge('documentNumber')}
							<span class="ml-1 text-[10px] {confidenceBadge('documentNumber')?.tone}">
								{confidenceBadge('documentNumber')?.label}
							</span>
						{/if}
						<input
							type="text"
							bind:value={draft.documentNumber}
							class="mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:border-[var(--sf-green)] focus:outline-none focus:ring-1 focus:ring-[var(--sf-green)] {confidenceClass('documentNumber')}"
							style="--sf-green: #387234;"
							disabled={isConfirming || isConfirmed}
						/>
					</label>

					<label class="block text-sm">
						<span class="font-medium text-slate-700">Counterparty</span>
						{#if confidenceBadge('counterpartyName')}
							<span class="ml-1 text-[10px] {confidenceBadge('counterpartyName')?.tone}">
								{confidenceBadge('counterpartyName')?.label}
							</span>
						{/if}
						<input
							type="text"
							bind:value={draft.counterpartyName}
							class="mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:border-[var(--sf-green)] focus:outline-none focus:ring-1 focus:ring-[var(--sf-green)] {confidenceClass('counterpartyName')}"
							style="--sf-green: #387234;"
							disabled={isConfirming || isConfirmed}
						/>
					</label>

					<label class="block text-sm">
						<span class="font-medium text-slate-700">Currency</span>
						<input
							type="text"
							bind:value={draft.currency}
							maxlength="3"
							class="mt-1 w-full rounded-md border px-3 py-2 text-sm uppercase shadow-sm focus:border-[var(--sf-green)] focus:outline-none focus:ring-1 focus:ring-[var(--sf-green)] {confidenceClass('currency')}"
							style="--sf-green: #387234;"
							disabled={isConfirming || isConfirmed}
						/>
					</label>

					<label class="block text-sm">
						<span class="font-medium text-slate-700">Total amount</span>
						{#if confidenceBadge('totalAmount')}
							<span class="ml-1 text-[10px] {confidenceBadge('totalAmount')?.tone}">
								{confidenceBadge('totalAmount')?.label}
							</span>
						{/if}
						<input
							type="number"
							step="0.01"
							bind:value={draft.totalAmount}
							class="mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:border-[var(--sf-green)] focus:outline-none focus:ring-1 focus:ring-[var(--sf-green)] {confidenceClass('totalAmount')}"
							style="--sf-green: #387234;"
							disabled={isConfirming || isConfirmed}
						/>
					</label>

					<label class="block text-sm">
						<span class="font-medium text-slate-700">GST amount</span>
						<input
							type="number"
							step="0.01"
							bind:value={draft.gstAmount}
							class="mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:border-[var(--sf-green)] focus:outline-none focus:ring-1 focus:ring-[var(--sf-green)] {confidenceClass('gstAmount')}"
							style="--sf-green: #387234;"
							disabled={isConfirming || isConfirmed}
						/>
					</label>

					<label class="block text-sm">
						<span class="font-medium text-slate-700">Issue date</span>
						{#if confidenceBadge('issueDate')}
							<span class="ml-1 text-[10px] {confidenceBadge('issueDate')?.tone}">
								{confidenceBadge('issueDate')?.label}
							</span>
						{/if}
						<input
							type="date"
							bind:value={draft.issueDate}
							class="mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:border-[var(--sf-green)] focus:outline-none focus:ring-1 focus:ring-[var(--sf-green)] {confidenceClass('issueDate')}"
							style="--sf-green: #387234;"
							disabled={isConfirming || isConfirmed}
						/>
					</label>

					<label class="block text-sm">
						<span class="font-medium text-slate-700">Due date</span>
						<input
							type="date"
							bind:value={draft.dueDate}
							class="mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:border-[var(--sf-green)] focus:outline-none focus:ring-1 focus:ring-[var(--sf-green)] {confidenceClass('dueDate')}"
							style="--sf-green: #387234;"
							disabled={isConfirming || isConfirmed}
						/>
					</label>
				</div>

				<div class="mt-6 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
					<a
						href="/finance/inbox"
						class="inline-flex items-center rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
					>
						Cancel
					</a>
					<button
						type="submit"
						disabled={isConfirming || isReclassifying || !isReady || isConfirmed}
						class="inline-flex items-center gap-2 rounded-md bg-[var(--sf-green)] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[var(--sf-green-dark)] disabled:opacity-50"
						style="--sf-green: #387234; --sf-green-dark: #2e5d2a;"
					>
						{#if isConfirming}
							Confirming…
						{:else if persistTarget === 'expenses'}
							Confirm & create expense
						{:else if persistTarget === 'revenue'}
							Confirm & create revenue
						{:else}
							Confirm
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
</PageShell>
