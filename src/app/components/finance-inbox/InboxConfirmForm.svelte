<script lang="ts">
	import { hashConfirmationPayload } from '$platform/workflow/payload-hash';
	import type { DocumentArtifactView } from '$modules/document-intake';

	export interface CategoryChoice {
		id: string;
		label: string;
		sublabel?: string;
		bucket: 'expense' | 'revenue' | 'document_only';
		persistTarget: string | null;
		llmFields: readonly string[];
		userFields: readonly string[];
		requiresProject?: boolean;
	}

	type FieldKind = 'text' | 'number' | 'date' | 'checkbox' | 'select' | 'textarea';
	type Draft = Record<string, string | boolean>;

	type ConfirmResult = {
		entityId: string;
		entityRoute: string;
		categoryId: string;
	};

	interface FieldMeta {
		label: string;
		kind: FieldKind;
		aliases?: string[];
		options?: Array<{ value: string; label: string }>;
		defaultValue?: string | boolean;
		span?: 'full';
	}

	let {
		artifact: initialArtifact,
		categories,
		cancelHref = '/finance/inbox',
		onConfirmed
	}: {
		artifact: DocumentArtifactView;
		categories: CategoryChoice[];
		cancelHref?: string | null;
		onConfirmed?: (result: ConfirmResult) => void | Promise<void>;
	} = $props();

	const FIELD_META: Record<string, FieldMeta> = {
		invoice_number: { label: 'Invoice number', kind: 'text', aliases: ['documentNumber', 'invoiceNumber'] },
		receipt_number: { label: 'Receipt number', kind: 'text', aliases: ['documentNumber', 'receiptNumber'] },
		po_number: { label: 'PO number', kind: 'text', aliases: ['documentNumber', 'poNumber'] },
		contract_number: { label: 'Contract number', kind: 'text', aliases: ['documentNumber', 'contractNumber'] },
		quotation_number: { label: 'Quotation number', kind: 'text', aliases: ['documentNumber', 'quotationNumber'] },
		supplier_name: { label: 'Supplier', kind: 'text', aliases: ['counterpartyName', 'supplierName'] },
		vendor: { label: 'Vendor', kind: 'text', aliases: ['counterpartyName', 'vendor'] },
		recipient_name: { label: 'Recipient', kind: 'text', aliases: ['recipientName', 'counterpartyName'] },
		recipient: { label: 'Recipient', kind: 'text', aliases: ['recipientName'] },
		staff_name: { label: 'Staff name', kind: 'text', aliases: ['staffName'] },
		customer_name: { label: 'Customer', kind: 'text', aliases: ['counterpartyName', 'customerName'] },
		client_name: { label: 'Client', kind: 'text', aliases: ['counterpartyName', 'clientName'] },
		date: { label: 'Date', kind: 'date', aliases: ['issueDate', 'date'] },
		due_date: { label: 'Due date', kind: 'date', aliases: ['dueDate'] },
		effective_date: { label: 'Effective date', kind: 'date', aliases: ['effectiveDate'] },
		expiry_date: { label: 'Expiry date', kind: 'date', aliases: ['expiryDate'] },
		valid_until: { label: 'Valid until', kind: 'date', aliases: ['validUntil'] },
		invoice_date: { label: 'Invoice date', kind: 'date', aliases: ['issueDate', 'invoiceDate'] },
		invoice_due_date: { label: 'Invoice due date', kind: 'date', aliases: ['dueDate', 'invoiceDueDate'] },
		amount: { label: 'Amount', kind: 'number', aliases: ['totalAmount', 'amount'] },
		total: { label: 'Total', kind: 'number', aliases: ['totalAmount', 'total'] },
		gst_amount: { label: 'GST amount', kind: 'number', aliases: ['gstAmount'] },
		invoice_amount: { label: 'Invoice amount', kind: 'number', aliases: ['totalAmount', 'invoiceAmount'] },
		invoice_gst_amount: { label: 'Invoice GST amount', kind: 'number', aliases: ['gstAmount', 'invoiceGstAmount'] },
		invoice_subtotal: { label: 'Invoice subtotal', kind: 'number', aliases: ['subtotal', 'invoiceSubtotal'] },
		currency: { label: 'Currency', kind: 'text', aliases: ['currency'], defaultValue: 'SGD' },
		invoice_currency: { label: 'Invoice currency', kind: 'text', aliases: ['currency', 'invoiceCurrency'], defaultValue: 'SGD' },
		destination: { label: 'Destination', kind: 'text' },
		service_name: { label: 'Service name', kind: 'text', aliases: ['serviceName'] },
		period: { label: 'Period', kind: 'text' },
		tracking_number: { label: 'Tracking number', kind: 'text', aliases: ['trackingNumber'] },
		description: { label: 'Description', kind: 'textarea', span: 'full' },
		scope: { label: 'Scope', kind: 'textarea', span: 'full' },
		payment_terms: { label: 'Payment terms', kind: 'textarea', aliases: ['paymentTerms'], span: 'full' },
		line_items: { label: 'Line items', kind: 'textarea', aliases: ['lineItems', 'invoiceLineItems'], span: 'full' },
		reimbursement: { label: 'Reimbursement', kind: 'checkbox', defaultValue: false },
		business_trip: { label: 'Business trip', kind: 'checkbox', aliases: ['businessTrip'], defaultValue: false },
		project_id: { label: 'Project ID', kind: 'text', aliases: ['projectId'] },
		date_start: { label: 'Start date', kind: 'date', aliases: ['dateStart'] },
		date_end: { label: 'End date', kind: 'date', aliases: ['dateEnd'] },
		days: { label: 'Days', kind: 'number' },
		daily_rate: { label: 'Daily rate', kind: 'number', aliases: ['dailyRate'] },
		invoice_type: {
			label: 'Invoice type',
			kind: 'select',
			defaultValue: 'standard',
			options: [
				{ value: 'standard', label: 'Standard' },
				{ value: 'zero_rate', label: 'Zero-rate' },
				{ value: 'tax_invoice', label: 'Tax invoice' }
			]
		},
		type: { label: 'Type', kind: 'text' },
		status: { label: 'Status', kind: 'text', defaultValue: 'active' },
		notes: { label: 'Notes', kind: 'textarea', span: 'full' }
	};

	const getInitialArtifact = () => initialArtifact;
	let artifact = $state<DocumentArtifactView>(getInitialArtifact());
	const getInitialCategoryId = () => artifact.suggestedCategoryId ?? categories[0]?.id ?? '';
	let selectedCategoryId = $state<string>(getInitialCategoryId());
	let isReclassifying = $state(false);
	let isConfirming = $state(false);
	let actionError = $state<string | null>(null);
	let successMsg = $state<string | null>(null);

	const selectedCategory = $derived(
		categories.find((c) => c.id === selectedCategoryId) ?? null
	);
	const fieldKeys = $derived(uniqueFields(selectedCategory));
	const persistTarget = $derived(selectedCategory?.persistTarget ?? null);
	const isArchiveOnly = $derived(
		Boolean(persistTarget && persistTarget !== 'expenses' && persistTarget !== 'revenue')
	);
	const isReady = $derived(
		artifact.processingStatus === 'ready_for_review' ||
			artifact.processingStatus === 'ready_for_workflow'
	);
	const canReclassify = $derived(artifact.processingStatus === 'ready_for_review');
	const isConfirmed = $derived(artifact.processingStatus === 'confirmed');

	function uniqueFields(category: CategoryChoice | null): string[] {
		if (!category) return [];
		return [...new Set([...category.llmFields, ...category.userFields])];
	}

	function metaFor(key: string): FieldMeta {
		return FIELD_META[key] ?? {
			label: key.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
			kind: 'text'
		};
	}

	function suggestedValue(a: DocumentArtifactView, key: string): unknown {
		const fields = (a.suggestedFields?.fields ?? {}) as Record<string, unknown>;
		const aliases = [key, ...(metaFor(key).aliases ?? [])];
		for (const alias of aliases) {
			if (fields[alias] !== undefined && fields[alias] !== null) return fields[alias];
		}
		return undefined;
	}

	function confidenceFor(a: DocumentArtifactView, key: string) {
		const confidence = a.suggestedFields?.confidence ?? {};
		const aliases = [key, ...(metaFor(key).aliases ?? [])];
		for (const alias of aliases) {
			if (confidence[alias] != null) return confidence[alias];
		}
		return undefined;
	}

	function defaultFor(key: string, category: CategoryChoice | null): string | boolean {
		if (key === 'reimbursement') {
			const id = category?.id ?? '';
			return id.includes('transport') || id.includes('meal') || id.includes('accommodation');
		}
		if (key === 'business_trip') return category?.id.includes('accommodation') ?? false;
		const meta = metaFor(key);
		if (meta.defaultValue !== undefined) return meta.defaultValue;
		return meta.kind === 'checkbox' ? false : '';
	}

	function initialDraftFor(a: DocumentArtifactView, category: CategoryChoice | null): Draft {
		const next: Draft = {};
		for (const key of uniqueFields(category)) {
			const meta = metaFor(key);
			const confidence = confidenceFor(a, key);
			const value = confidence != null && confidence < 0.5 ? undefined : suggestedValue(a, key);
			if (meta.kind === 'checkbox') {
				next[key] = typeof value === 'boolean' ? value : Boolean(defaultFor(key, category));
			} else if (Array.isArray(value)) {
				next[key] = value.map((item) => JSON.stringify(item)).join('\n');
			} else if (typeof value === 'number') {
				next[key] = String(value);
			} else if (typeof value === 'string') {
				next[key] = value;
			} else {
				next[key] = defaultFor(key, category) as string;
			}
		}
		return next;
	}

	const getInitialDraft = () => initialDraftFor(artifact, selectedCategory);
	let draft = $state<Draft>(getInitialDraft());

	function confidenceClass(key: string) {
		const c = confidenceFor(artifact, key);
		if (c == null) return 'border-slate-300';
		if (c >= 0.85) return 'border-emerald-300 bg-emerald-50/30';
		if (c >= 0.5) return 'border-amber-300 bg-amber-50/30';
		return 'border-slate-300';
	}

	function confidenceBadge(key: string) {
		const c = confidenceFor(artifact, key);
		if (c == null) return null;
		if (c >= 0.85) return { tone: 'text-emerald-700', label: 'high' };
		if (c >= 0.5) return { tone: 'text-amber-700', label: 'check' };
		return { tone: 'text-slate-400', label: 'low' };
	}

	function coerceValue(key: string, value: string | boolean): unknown {
		const meta = metaFor(key);
		if (meta.kind === 'checkbox') return Boolean(value);
		if (meta.kind === 'number') {
			const n = Number(value);
			return Number.isFinite(n) ? n : null;
		}
		return typeof value === 'string' ? value.trim() : value;
	}

	function payloadFields(): Record<string, unknown> {
		const fields: Record<string, unknown> = {};
		for (const key of fieldKeys) fields[key] = coerceValue(key, draft[key] ?? '');
		return fields;
	}

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
				selectedCategoryId = json.data.suggestedCategoryId ?? newId;
				const nextCategory = categories.find((c) => c.id === (json.data?.suggestedCategoryId ?? newId)) ?? null;
				draft = initialDraftFor(json.data, nextCategory);
			}
		} catch (err) {
			actionError = err instanceof Error ? err.message : 'Reclassify failed';
			selectedCategoryId = previousId;
			const previousCategory = categories.find((c) => c.id === previousId) ?? null;
			draft = initialDraftFor(artifact, previousCategory);
		} finally {
			isReclassifying = false;
		}
	}

	async function handleConfirm() {
		if (!selectedCategory) return;
		actionError = null;
		successMsg = null;
		isConfirming = true;

		const fields = payloadFields();
		const payload = {
			documentId: artifact.id,
			categoryId: selectedCategoryId,
			supplierId: null,
			poId: null,
			projectId: typeof fields.project_id === 'string' ? fields.project_id || null : null,
			fields
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
			const json = (await res.json()) as { data?: ConfirmResult };
			if (json.data) {
				successMsg = `Confirmed. Created ${json.data.categoryId} record.`;
				artifact = { ...artifact, processingStatus: 'confirmed' };
				await onConfirmed?.(json.data);
			}
		} catch (err) {
			actionError = err instanceof Error ? err.message : 'Confirm failed';
		} finally {
			isConfirming = false;
		}
	}
</script>

<div class="space-y-4">
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

	<div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
		<div class="flex items-center justify-between gap-3">
			<div>
				<h3 class="text-sm font-semibold text-slate-900">Category</h3>
				<p class="text-xs text-slate-500">
					Changing the category re-extracts fields from the same text.
				</p>
			</div>
			{#if isReclassifying}
				<span class="text-xs text-slate-500">Re-extracting...</span>
			{/if}
		</div>
		<select
			class="mt-3 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-[var(--sf-green)] focus:outline-none focus:ring-1 focus:ring-[var(--sf-green)]"
			style="--sf-green: #387234;"
			value={selectedCategoryId}
			onchange={(e) => handleCategoryChange((e.currentTarget as HTMLSelectElement).value)}
			disabled={isReclassifying || isConfirming || isConfirmed || !canReclassify}
		>
			{#each ['expense', 'revenue', 'document_only'] as bucket}
				<optgroup label={bucket === 'expense' ? 'Expense' : bucket === 'revenue' ? 'Revenue' : 'Archive only'}>
					{#each categories.filter((c) => c.bucket === bucket) as cat}
						<option value={cat.id}>{cat.label}{cat.sublabel ? ` - ${cat.sublabel}` : ''}</option>
					{/each}
				</optgroup>
			{/each}
		</select>
		{#if isArchiveOnly}
			<p class="mt-2 text-xs text-amber-700">
				Archive-only categories do not write to expenses/revenue yet.
			</p>
		{/if}
	</div>

	<form
		class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
		onsubmit={(e) => {
			e.preventDefault();
			void handleConfirm();
		}}
	>
		<h3 class="text-sm font-semibold text-slate-900">Suggested fields</h3>
		<p class="text-xs text-slate-500">
			Fields are driven by the selected category. Low-confidence values are left blank.
		</p>

		<div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
			{#each fieldKeys as key}
				{@const meta = metaFor(key)}
				<label class="block text-sm {meta.span === 'full' ? 'sm:col-span-2' : ''}">
					<span class="font-medium text-slate-700">{meta.label}</span>
					{#if confidenceBadge(key)}
						<span class="ml-1 text-[10px] {confidenceBadge(key)?.tone}">
							{confidenceBadge(key)?.label}
						</span>
					{/if}

					{#if meta.kind === 'checkbox'}
						<input
							type="checkbox"
							bind:checked={draft[key] as boolean}
							class="mt-2 h-4 w-4 rounded border-slate-300 text-[var(--sf-green)] focus:ring-[var(--sf-green)]"
							style="--sf-green: #387234;"
							disabled={isConfirming || isConfirmed}
						/>
					{:else if meta.kind === 'textarea'}
						<textarea
							bind:value={draft[key] as string}
							rows="3"
							class="mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:border-[var(--sf-green)] focus:outline-none focus:ring-1 focus:ring-[var(--sf-green)] {confidenceClass(key)}"
							style="--sf-green: #387234;"
							disabled={isConfirming || isConfirmed}
						></textarea>
					{:else if meta.kind === 'select'}
						<select
							bind:value={draft[key] as string}
							class="mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:border-[var(--sf-green)] focus:outline-none focus:ring-1 focus:ring-[var(--sf-green)] {confidenceClass(key)}"
							style="--sf-green: #387234;"
							disabled={isConfirming || isConfirmed}
						>
							{#each meta.options ?? [] as option}
								<option value={option.value}>{option.label}</option>
							{/each}
						</select>
					{:else}
						<input
							type={meta.kind === 'number' ? 'number' : meta.kind === 'date' ? 'date' : 'text'}
							step={meta.kind === 'number' ? '0.01' : undefined}
							bind:value={draft[key] as string}
							class="mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:border-[var(--sf-green)] focus:outline-none focus:ring-1 focus:ring-[var(--sf-green)] {confidenceClass(key)}"
							style="--sf-green: #387234;"
							disabled={isConfirming || isConfirmed}
						/>
					{/if}
				</label>
			{/each}
		</div>

		<div class="mt-6 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
			{#if cancelHref}
				<a
					href={cancelHref}
					class="inline-flex items-center rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
				>
					Cancel
				</a>
			{/if}
			<button
				type="submit"
				disabled={isConfirming || isReclassifying || !isReady || isConfirmed}
				class="inline-flex items-center gap-2 rounded-md bg-[var(--sf-green)] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[var(--sf-green-dark)] disabled:opacity-50"
				style="--sf-green: #387234; --sf-green-dark: #2e5d2a;"
			>
				{#if isConfirming}
					Confirming...
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
