import { detectDuplicateCapability } from '../../../capabilities/detect-duplicate';
import type { DuplicateCandidatePayload } from '../../../capabilities/detect-duplicate';
import { matchPurchaseOrderCapability } from '../../../capabilities/match-purchase-order';
import { matchSupplierCapability } from '../../../capabilities/match-supplier';
import type { FinanceCapabilityContext } from '../../../capabilities/types';
import {
	matchingOutputSchema,
	type ExtractedInvoiceFields,
	type MatchingOutput
} from '../schemas';

export interface MatchStepInput {
	fields: ExtractedInvoiceFields;
	existingRecords?: DuplicateCandidatePayload[];
}

export async function runMatchingStep(
	input: MatchStepInput,
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
