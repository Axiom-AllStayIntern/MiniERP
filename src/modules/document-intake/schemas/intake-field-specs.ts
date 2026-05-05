/**
 * Field specs for the step-4 review form. Given the classify result's
 * (bucket, docType, category, expenseType), decide which inputs to render
 * and their pre-fill keys.
 *
 * Field ids mirror the keys returned by /api/intake/classify so pre-fill
 * works without any renaming. Extra fields (staffName, reimbursement, etc.)
 * start empty; user fills when relevant.
 *
 * Kept in its own file because the table is long and noisy and would bury
 * the component's UI logic.
 */

export type FieldType = 'text' | 'number' | 'date' | 'boolean' | 'select' | 'textarea';

// ---------------------------------------------------------------------------
// Chip option catalogues â€?surfaced to the step components for bucket / kind /
// project chip rendering. Labels are user-facing; ids are DB/LLM-facing.
// ---------------------------------------------------------------------------

export type Bucket = 'revenue' | 'expense' | 'document_only';

export type BucketOption = { id: Bucket; label: string; sublabel: string };

export const BUCKET_OPTIONS: BucketOption[] = [
	{ id: 'revenue', label: 'Revenue', sublabel: 'Customer paid us' },
	{ id: 'expense', label: 'Expense', sublabel: 'We paid out' },
	{ id: 'document_only', label: 'Archive', sublabel: 'Just file it' }
];

export type KindOption = {
	id: string;
	label: string;
	sub?: string;
	/** For expense kinds only â€?the expense_type column value. */
	expenseType?: 'opex' | 'sales_cost';
	/** For expense kinds â€?the doc_type column value. */
	docType?: 'invoice' | 'receipt' | 'po' | null;
	/** Visual grouping label (rendered as a section header). */
	group?: string;
};

export const REVENUE_KIND_OPTIONS: KindOption[] = [
	{ id: 'invoice_out', label: 'Customer invoice', sub: 'Standard / GST / zero-rate' }
];

export const EXPENSE_KIND_OPTIONS: KindOption[] = [
	// Sales cost (project-linked direct costs)
	{
		id: 'invoice',
		label: 'Supplier invoice',
		sub: 'Vendor bill for project work',
		expenseType: 'sales_cost',
		docType: 'invoice',
		group: 'Project cost'
	},
	{
		id: 'receipt',
		label: 'Payment receipt',
		sub: 'Confirmation of payment',
		expenseType: 'sales_cost',
		docType: 'receipt',
		group: 'Project cost'
	},
	// OPEX â€?overhead
	{
		id: 'transport',
		label: 'Transport',
		sub: 'Grab, taxi, MRT',
		expenseType: 'opex',
		docType: 'receipt',
		group: 'Operating cost'
	},
	{
		id: 'meal',
		label: 'Meal',
		sub: 'Food & drinks',
		expenseType: 'opex',
		docType: 'receipt',
		group: 'Operating cost'
	},
	{
		id: 'accommodation',
		label: 'Accommodation',
		sub: 'Hotel / lodging',
		expenseType: 'opex',
		docType: 'receipt',
		group: 'Operating cost'
	},
	{
		id: 'gift',
		label: 'Gift',
		sub: 'Client / staff gift',
		expenseType: 'opex',
		docType: 'receipt',
		group: 'Operating cost'
	},
	{
		id: 'allowance',
		label: 'Allowance',
		sub: 'Per-diem, no file',
		expenseType: 'opex',
		docType: null,
		group: 'Operating cost'
	},
	{
		id: 'ai_subscription',
		label: 'SaaS / AI sub',
		sub: 'ChatGPT, Cursor, etc.',
		expenseType: 'opex',
		docType: 'invoice',
		group: 'Operating cost'
	},
	{
		id: 'logistics',
		label: 'Logistics',
		sub: 'Courier, shipping',
		expenseType: 'opex',
		docType: 'receipt',
		group: 'Operating cost'
	},
	{
		id: 'purchase',
		label: 'Procurement',
		sub: 'BOM / PO purchase',
		expenseType: 'opex',
		docType: 'po',
		group: 'Operating cost'
	},
	{
		id: 'others',
		label: 'Others',
		sub: '',
		expenseType: 'opex',
		docType: 'receipt',
		group: 'Operating cost'
	}
];

export const ARCHIVE_KIND_OPTIONS: KindOption[] = [
	{ id: 'contract', label: 'Contract', sub: 'Agreement doc' },
	{ id: 'quotation', label: 'Quotation', sub: 'Quote / proposal' },
	{ id: 'purchase_order', label: 'Purchase order', sub: 'PO doc' },
	{ id: 'other', label: 'Other', sub: 'Just archive the file' }
];

export function getKindOptions(bucket: Bucket): KindOption[] {
	if (bucket === 'revenue') return REVENUE_KIND_OPTIONS;
	if (bucket === 'expense') return EXPENSE_KIND_OPTIONS;
	return ARCHIVE_KIND_OPTIONS;
}

/**
 * Given a Kind chip id (could be a category for expense, or docType for
 * archive/revenue), produce the canonical (docType, category, expenseType)
 * triple that the rest of the pipeline uses.
 */
export function resolveKindSelection(
	bucket: Bucket,
	kindId: string
): { docType: string; category: string | null; expenseType: 'opex' | 'sales_cost' | null; docTypeForDocs: 'invoice' | 'receipt' | 'po' | null } {
	if (bucket === 'revenue') {
		return { docType: 'invoice_out', category: null, expenseType: null, docTypeForDocs: 'invoice' };
	}
	if (bucket === 'expense') {
		const opt = EXPENSE_KIND_OPTIONS.find((o) => o.id === kindId);
		if (!opt) {
			return {
				docType: 'expense',
				category: 'others',
				expenseType: 'opex',
				docTypeForDocs: 'receipt'
			};
		}
		// kindId IS the category for expense bucket
		const firstPassDocType =
			opt.expenseType === 'sales_cost' && opt.docType === 'invoice' ? 'invoice_in' : 'expense';
		return {
			docType: firstPassDocType,
			category: opt.id,
			expenseType: opt.expenseType ?? 'opex',
			docTypeForDocs: opt.docType ?? 'receipt'
		};
	}
	// bucket === 'document_only'
	return { docType: kindId, category: null, expenseType: null, docTypeForDocs: null };
}

export type FieldSpec = {
	id: string;
	label: string;
	type: FieldType;
	options?: string[];
	placeholder?: string;
	required?: boolean;
	defaultValue?: string | number | boolean;
	/** Show with a subtle "derived from OCR" badge. Phase 1B decorator. */
	hint?: string;
};

type Ctx = {
	bucket: 'revenue' | 'expense' | 'document_only';
	docType: string;
	category: string | null;
	expenseType: string | null;
};

const CURRENCIES = ['SGD', 'USD', 'CNY', 'MYR', 'EUR'];

const EXPENSE_COMMON: FieldSpec[] = [
	{ id: 'supplierName', label: 'Vendor', type: 'text', required: true },
	{ id: 'documentDate', label: 'Date', type: 'date', required: true },
	{ id: 'totalAmount', label: 'Amount', type: 'number', required: true },
	{ id: 'currency', label: 'Currency', type: 'select', options: CURRENCIES, defaultValue: 'SGD' },
	{ id: 'gstAmount', label: 'GST', type: 'number' }
];

export function getFieldSpecs(ctx: Ctx): FieldSpec[] {
	const { bucket, docType, category, expenseType } = ctx;

	// --- Revenue ---------------------------------------------------------
	if (bucket === 'revenue') {
		return [
			{
				id: 'invoiceType',
				label: 'Invoice type',
				type: 'select',
				options: ['standard', 'zero_rate', 'tax_invoice'],
				defaultValue: 'standard'
			},
			{ id: 'invoiceNumber', label: 'Invoice #', type: 'text' },
			{ id: 'clientName', label: 'Client', type: 'text', required: true },
			{ id: 'documentDate', label: 'Date', type: 'date', required: true },
			{ id: 'totalAmount', label: 'Amount', type: 'number', required: true },
			{
				id: 'currency',
				label: 'Currency',
				type: 'select',
				options: CURRENCIES,
				defaultValue: 'SGD'
			},
			{ id: 'gstAmount', label: 'GST', type: 'number' }
		];
	}

	// --- Expense ---------------------------------------------------------
	if (bucket === 'expense') {
		// Sales cost â€?supplier invoice/receipt tied to a project deliverable
		if (expenseType === 'sales_cost') {
			const isInvoice = category === 'invoice';
			return [
				{ id: 'invoiceNumber', label: isInvoice ? 'Invoice #' : 'Receipt #', type: 'text' },
				{ id: 'supplierName', label: 'Supplier', type: 'text', required: true },
				{ id: 'documentDate', label: 'Date', type: 'date', required: true },
				...(isInvoice
					? [{ id: 'dueDate', label: 'Due date', type: 'date' as const }]
					: []),
				{ id: 'totalAmount', label: 'Amount', type: 'number', required: true },
				{
					id: 'currency',
					label: 'Currency',
					type: 'select',
					options: CURRENCIES,
					defaultValue: 'SGD'
				},
				{ id: 'gstAmount', label: 'GST', type: 'number' }
			];
		}

		// OPEX subtypes
		if (category === 'ai_subscription') {
			return [
				{ id: 'invoiceNumber', label: 'Invoice #', type: 'text' },
				{ id: 'supplierName', label: 'Service', type: 'text', required: true },
				{ id: 'documentDate', label: 'Date', type: 'date', required: true },
				{ id: 'dueDate', label: 'Next billing', type: 'date' },
				{ id: 'totalAmount', label: 'Amount', type: 'number', required: true },
				{
					id: 'currency',
					label: 'Currency',
					type: 'select',
					options: CURRENCIES,
					defaultValue: 'SGD'
				},
				{ id: 'gstAmount', label: 'GST', type: 'number' }
			];
		}

		if (category === 'transport' || category === 'meal' || category === 'gift') {
			return [
				...EXPENSE_COMMON,
				{ id: 'staffName', label: 'Staff', type: 'text' },
				{
					id: 'reimbursement',
					label: 'Employee reimbursement',
					type: 'boolean',
					defaultValue: true
				},
				{ id: 'businessTrip', label: 'Business trip', type: 'boolean' }
			];
		}

		if (category === 'accommodation') {
			return [
				...EXPENSE_COMMON,
				{ id: 'staffName', label: 'Staff', type: 'text' },
				{ id: 'destination', label: 'Destination', type: 'text' },
				{ id: 'businessTrip', label: 'Business trip', type: 'boolean', defaultValue: true },
				{ id: 'reimbursement', label: 'Employee reimbursement', type: 'boolean' }
			];
		}

		if (category === 'logistics') {
			return [
				...EXPENSE_COMMON,
				{ id: 'trackingNumber', label: 'Tracking #', type: 'text' }
			];
		}

		if (category === 'purchase') {
			return [
				{ id: 'poNumber', label: 'PO #', type: 'text' },
				{ id: 'supplierName', label: 'Supplier', type: 'text', required: true },
				{ id: 'documentDate', label: 'Date', type: 'date', required: true },
				{ id: 'totalAmount', label: 'Amount', type: 'number', required: true },
				{
					id: 'currency',
					label: 'Currency',
					type: 'select',
					options: CURRENCIES,
					defaultValue: 'SGD'
				},
				{ id: 'description', label: 'Description', type: 'textarea' }
			];
		}

		if (category === 'allowance') {
			// Pure manual â€?no file. Still goes through intake so the staff UX is uniform.
			return [
				{ id: 'staffName', label: 'Staff', type: 'text', required: true },
				{ id: 'destination', label: 'Destination', type: 'text', required: true },
				{ id: 'dateStart', label: 'From', type: 'date', required: true },
				{ id: 'dateEnd', label: 'To', type: 'date', required: true },
				{ id: 'totalAmount', label: 'Total amount', type: 'number', required: true },
				{
					id: 'currency',
					label: 'Currency',
					type: 'select',
					options: CURRENCIES,
					defaultValue: 'SGD'
				}
			];
		}

		// others / unknown â€?stick to the common fields
		return EXPENSE_COMMON;
	}

	// --- Document Only ---------------------------------------------------
	// Field ids use camelCase to match the kitchen-sink extractor (see
	// $platform/ai/ocr/extract-intake.ts). The save endpoint translates to
	// DB snake_case columns at write time.
	if (docType === 'contract') {
		return [
			{ id: 'contractNumber', label: 'Contract #', type: 'text' },
			{ id: 'clientName', label: 'Counterparty', type: 'text', required: true },
			{ id: 'effectiveDate', label: 'Effective from', type: 'date' },
			{ id: 'expiryDate', label: 'Expires', type: 'date' },
			{ id: 'totalAmount', label: 'Amount', type: 'number' },
			{
				id: 'currency',
				label: 'Currency',
				type: 'select',
				options: CURRENCIES,
				defaultValue: 'SGD'
			},
			{ id: 'paymentTerms', label: 'Payment terms', type: 'text' },
			{ id: 'scope', label: 'Scope', type: 'textarea' }
		];
	}

	if (docType === 'quotation') {
		return [
			{ id: 'quotationNumber', label: 'Quotation #', type: 'text' },
			{ id: 'clientName', label: 'Client', type: 'text', required: true },
			{ id: 'documentDate', label: 'Date', type: 'date' },
			{ id: 'validUntil', label: 'Valid until', type: 'date' },
			{ id: 'totalAmount', label: 'Amount', type: 'number' },
			{
				id: 'currency',
				label: 'Currency',
				type: 'select',
				options: CURRENCIES,
				defaultValue: 'SGD'
			}
		];
	}

	if (docType === 'purchase_order') {
		return [
			{ id: 'poNumber', label: 'PO #', type: 'text' },
			{ id: 'supplierName', label: 'Supplier', type: 'text' },
			{ id: 'clientName', label: 'Buyer', type: 'text' },
			{ id: 'documentDate', label: 'Date', type: 'date' },
			{ id: 'totalAmount', label: 'Amount', type: 'number' },
			{
				id: 'currency',
				label: 'Currency',
				type: 'select',
				options: CURRENCIES,
				defaultValue: 'SGD'
			},
			{ id: 'description', label: 'Description', type: 'textarea' }
		];
	}

	// other â†?archive only with notes
	return [{ id: 'notes', label: 'Notes', type: 'textarea' }];
}
