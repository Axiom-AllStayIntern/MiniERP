import type { FinanceCapability } from '../types';
import {
	buildEvidence,
	pickFixture,
	type ExtractInvoiceFieldsInput,
	type ExtractInvoiceFieldsOutput
} from './mock';

export const extractInvoiceFieldsCapability: FinanceCapability<
	ExtractInvoiceFieldsInput,
	ExtractInvoiceFieldsOutput
> = {
	id: 'finance.extract-invoice-fields',
	description: 'Extract invoice fields (number, supplier, amount, GST, dates) from a document.',
	riskLevel: 'R2',

	async execute(input) {
		const fixture = pickFixture(input);
		return {
			fields: fixture.fields,
			confidence: fixture.confidence,
			evidence: buildEvidence(fixture.fields),
			provider: 'mock-v1'
		};
	}
};
