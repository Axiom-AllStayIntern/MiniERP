import type { DocumentClassificationResult } from '../../schemas/document-artifact.schema';
import { buildClassification } from './mock';

export interface ClassifyDocumentInput {
	text: string;
	fileName?: string;
	mimeType?: string;
}

export type ClassifyDocumentOutput = DocumentClassificationResult;

export interface ClassifyDocumentContext {
	tenantId?: string;
	userId?: string;
	useMock?: boolean;
}

export const classifyDocumentCapability = {
	id: 'document-intake.classify-document',
	description:
		'Classify a document into supplier_invoice / receipt / purchase_order / contract / etc. based on extracted text + filename heuristics.',
	riskLevel: 'R1' as const,

	async execute(
		input: ClassifyDocumentInput,
		_ctx: ClassifyDocumentContext
	): Promise<ClassifyDocumentOutput> {
		return buildClassification(input);
	}
};
