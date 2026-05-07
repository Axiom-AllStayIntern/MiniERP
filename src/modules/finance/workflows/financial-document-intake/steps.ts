/**
 * Step runners for the financial-document-intake workflow.
 *
 * The bucket / category / project selection steps are pure data-store steps
 * (the user makes a choice, the server records it). They do no I/O. The
 * field_extraction and matching steps mirror the Phase-2 vendor-invoice
 * implementations but read the user-selected category from workflow state to
 * pick the right extraction profile.
 */
import { detectDuplicateCapability } from '../../capabilities/detect-duplicate';
import type { DuplicateCandidatePayload } from '../../capabilities/detect-duplicate';
import { extractDocumentFieldsCapability } from '../../capabilities/extract-document-fields';
import { matchPurchaseOrderCapability } from '../../capabilities/match-purchase-order';
import { matchSupplierCapability } from '../../capabilities/match-supplier';
import type { FinanceCapabilityContext } from '../../capabilities/types';
import type {
	ConfirmationDraft,
	DocumentIntakeOutput,
	ExtractedInvoiceFields,
	FieldExtractionOutput,
	MatchingOutput
} from '../vendor-invoice-intake/schemas';
import {
	confirmationDraftSchema,
	fieldExtractionOutputSchema,
	matchingOutputSchema
} from '../vendor-invoice-intake/schemas';
import {
	findCategoryById,
	type Bucket,
	type CategoryDefinition
} from './categories';

export interface BucketSelectionInput {
	bucket: Bucket;
}

export interface BucketSelectionOutput {
	bucket: Bucket;
}

/** Pure: just records the user's bucket choice. */
export async function runBucketSelectionStep(
	input: BucketSelectionInput
): Promise<BucketSelectionOutput> {
	return { bucket: input.bucket };
}

export interface CategorySelectionInput {
	categoryId: string;
}

export interface CategorySelectionOutput {
	categoryId: string;
	category: CategoryDefinition;
}

/** Resolves the chosen category id against the canonical catalog. */
export async function runCategorySelectionStep(
	input: CategorySelectionInput
): Promise<CategorySelectionOutput> {
	const category = findCategoryById(input.categoryId);
	if (!category) {
		throw new Error(`Unknown category id: ${input.categoryId}`);
	}
	return { categoryId: input.categoryId, category };
}

export interface FieldExtractionStepInput extends DocumentIntakeOutput {
	categoryId?: string;
	text?: string;
	artifactConfidence?: number;
}

export async function runFieldExtractionStep(
	input: FieldExtractionStepInput,
	ctx: FinanceCapabilityContext
): Promise<FieldExtractionOutput> {
	const result = await extractDocumentFieldsCapability.execute(
		{
			documentId: input.documentId,
			fileName: input.fileName,
			text: input.text,
			artifactConfidence: input.artifactConfidence,
			categoryId: input.categoryId,
			outputShape: 'legacy'
		},
		ctx
	);
	return fieldExtractionOutputSchema.parse({
		fields: result.fields,
		confidence: result.confidence,
		evidence: result.evidence
	});
}

export interface MatchingStepInput {
	fields: ExtractedInvoiceFields;
	existingRecords?: DuplicateCandidatePayload[];
}

/** Same matching dispatch as vendor-invoice-intake — pulled here so the new
 * workflow doesn't have to import the v2 step file. */
export async function runMatchingStep(
	input: MatchingStepInput,
	ctx: FinanceCapabilityContext
): Promise<MatchingOutput> {
	const [supplier, po, duplicate] = await Promise.all([
		matchSupplierCapability.execute({ counterpartyName: input.fields.counterpartyName }, ctx),
		matchPurchaseOrderCapability.execute(
			{
				supplierName: input.fields.counterpartyName,
				totalAmount: input.fields.totalAmount,
				currency: input.fields.currency
			},
			ctx
		),
		detectDuplicateCapability.execute(
			{
				candidate: {
					documentNumber: input.fields.documentNumber,
					amount: input.fields.totalAmount,
					counterparty: input.fields.counterpartyName
				},
				existing: input.existingRecords ?? []
			},
			ctx
		)
	]);
	return matchingOutputSchema.parse({
		supplierCandidates: supplier.candidates,
		poCandidates: po.candidates,
		duplicate
	});
}

export interface ProjectSelectionInput {
	projectId: string | null;
}

export interface ProjectSelectionOutput {
	projectId: string | null;
}

/** Pure: records the project link choice (null = no project). */
export async function runProjectSelectionStep(
	input: ProjectSelectionInput
): Promise<ProjectSelectionOutput> {
	return { projectId: input.projectId };
}

export type FinancialDocumentConfirmationDraft = ConfirmationDraft;
export { confirmationDraftSchema };
