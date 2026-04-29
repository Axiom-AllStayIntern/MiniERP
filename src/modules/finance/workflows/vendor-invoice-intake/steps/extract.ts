import { extractInvoiceFieldsCapability } from '../../../capabilities/extract-invoice-fields';
import type { FinanceCapabilityContext } from '../../../capabilities/types';
import {
	fieldExtractionOutputSchema,
	type DocumentIntakeOutput,
	type FieldExtractionOutput
} from '../schemas';

export interface RunFieldExtractionStepInput extends DocumentIntakeOutput {
	/** Real OCR text from a Document Artifact (Phase 2+). When omitted the
	 *  capability falls back to its fixture mock keyed by file name. */
	text?: string;
	/** Confidence reported by upstream OCR. */
	artifactConfidence?: number;
}

export async function runFieldExtractionStep(
	input: RunFieldExtractionStepInput,
	ctx: FinanceCapabilityContext
): Promise<FieldExtractionOutput> {
	const result = await extractInvoiceFieldsCapability.execute(
		{
			documentId: input.documentId,
			fileName: input.fileName,
			text: input.text,
			artifactConfidence: input.artifactConfidence
		},
		ctx
	);
	return fieldExtractionOutputSchema.parse({
		fields: result.fields,
		confidence: result.confidence,
		evidence: result.evidence
	});
}
