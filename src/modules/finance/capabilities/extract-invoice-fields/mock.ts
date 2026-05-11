import type { FinanceEvidence } from '../../agent/types';

export interface ExtractInvoiceFieldsInput {
	documentId: string;
	fileName?: string;
	/**
	 * Real OCR text from a Document Artifact. When present the capability runs
	 * heuristic-then-LLM extraction; when absent it falls back to the Phase 1
	 * filename-keyword fixture so the local demo without an AI binding still
	 * works.
	 */
	text?: string;
	/** Confidence reported by upstream OCR/text-extraction. */
	artifactConfidence?: number;
}

export interface ExtractedInvoiceFields {
	documentNumber: string;
	counterpartyName: string;
	currency: string;
	totalAmount: number;
	gstAmount: number;
	issueDate: string;
	dueDate: string;
}

export type ExtractionProvider = 'mock-v1' | 'heuristic' | 'workers_ai' | 'external_api' | 'none';

export interface ExtractInvoiceFieldsOutput {
	fields: ExtractedInvoiceFields;
	confidence: number;
	evidence: FinanceEvidence[];
	provider: ExtractionProvider;
}

interface Fixture {
	keywords: string[];
	fields: ExtractedInvoiceFields;
	confidence: number;
}

const FIXTURES: Fixture[] = [
	{
		keywords: ['axiom'],
		fields: {
			documentNumber: 'INV-2026-0148',
			counterpartyName: 'Axiom Tech',
			currency: 'SGD',
			totalAmount: 12450,
			gstAmount: 1028.44,
			issueDate: '2026-04-22',
			dueDate: '2026-05-22'
		},
		confidence: 0.94
	},
	{
		keywords: ['cloudfactor', 'cloud'],
		fields: {
			documentNumber: 'CF-2026-Q2-0072',
			counterpartyName: 'Cloudfactor SG',
			currency: 'SGD',
			totalAmount: 4860,
			gstAmount: 401.65,
			issueDate: '2026-04-18',
			dueDate: '2026-05-18'
		},
		confidence: 0.91
	},
	{
		keywords: ['neon', 'robotics'],
		fields: {
			documentNumber: 'NR-2026-1140',
			counterpartyName: 'Neon Robotics',
			currency: 'SGD',
			totalAmount: 27800,
			gstAmount: 2296.33,
			issueDate: '2026-04-15',
			dueDate: '2026-05-30'
		},
		confidence: 0.88
	}
];

const DEFAULT_FIXTURE = FIXTURES[0];

export function pickFixture(input: ExtractInvoiceFieldsInput): Fixture {
	const haystack = `${input.fileName ?? ''} ${input.documentId}`.toLowerCase();
	const matched = FIXTURES.find((f) => f.keywords.some((k) => haystack.includes(k)));
	return matched ?? DEFAULT_FIXTURE;
}

export function buildEvidence(fields: ExtractedInvoiceFields): FinanceEvidence[] {
	return Object.keys(fields).map((field) => ({
		type: 'extracted_field' as const,
		refId: `mock://${field}`,
		summary: `Extracted ${field} from invoice text`
	}));
}
