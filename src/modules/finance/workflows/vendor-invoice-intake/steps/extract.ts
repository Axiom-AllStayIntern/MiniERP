import { extractInvoiceFieldsCapability } from '../../../capabilities/extract-invoice-fields';
import type { FinanceCapabilityContext } from '../../../capabilities/types';
import {
	fieldExtractionOutputSchema,
	type DocumentIntakeOutput,
	type FieldExtractionOutput
} from '../schemas';

export async function runFieldExtractionStep(
	input: DocumentIntakeOutput,
	ctx: FinanceCapabilityContext
): Promise<FieldExtractionOutput> {
	const result = await extractInvoiceFieldsCapability.execute(
		{ documentId: input.documentId, fileName: input.fileName },
		ctx
	);
	return fieldExtractionOutputSchema.parse({
		fields: result.fields,
		confidence: result.confidence,
		evidence: result.evidence
	});
}
