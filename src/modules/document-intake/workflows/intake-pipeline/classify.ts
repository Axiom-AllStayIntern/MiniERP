/**
 * Classify layer â€?decides the (bucket, docType, category) triple that
 * drives which extractor runs next.
 *
 * Two sequential LLM passes:
 *   1. classifyDocType         â†?7-way docType
 *   2. classifyExpenseCategory â†?(expense only) refines to 11-way category
 *
 * The classifier is imperfect (see user feedback on sales_cost.invoice
 * being mis-classified as opex.logistics) â€?the ReviewStep's Re-check
 * button and the user-pill overrides exist precisely to recover from that.
 */

import { classifyDocType, type DocType } from '$platform/ai/ocr/classify';
import { classifyExpenseCategory } from '$platform/ai/ocr/classify-expense-category';
import type { Bucket, CategoryDocType, ExpenseTypeT } from './types';

export { classifyDocType };

export function mapDocTypeToBucket(docType: DocType): Bucket {
	if (docType === 'invoice_out') return 'revenue';
	if (docType === 'invoice_in' || docType === 'expense') return 'expense';
	return 'document_only';
}

export interface ClassifyIntakeResult {
	bucket: Bucket;
	docType: DocType;
	expenseType: ExpenseTypeT | null;
	category: string | null;
	categoryDocType: CategoryDocType | null;
	confidence: number;
	provider: string;
}

/**
 * Combined classify â€?runs docType classifier, then (for expense bucket)
 * the category classifier. Returns everything downstream layers need to
 * route to the right extractor.
 */
export async function classifyIntake(
	rawText: string,
	hint: DocType | undefined,
	env: Env
): Promise<ClassifyIntakeResult> {
	const doc = await classifyDocType(rawText, hint, env);
	const bucket = mapDocTypeToBucket(doc.result.docType);

	if (bucket !== 'expense') {
		return {
			bucket,
			docType: doc.result.docType,
			expenseType: null,
			category: null,
			categoryDocType: null,
			confidence: doc.result.confidence,
			provider: doc.provider
		};
	}

	const cat = await classifyExpenseCategory(
		rawText,
		doc.result.docType as 'invoice_in' | 'expense',
		env
	);
	return {
		bucket,
		docType: doc.result.docType,
		expenseType: cat.expenseType,
		category: cat.category,
		categoryDocType: cat.docType,
		confidence: doc.result.confidence,
		provider: doc.provider
	};
}
