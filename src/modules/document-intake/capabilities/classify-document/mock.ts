import type {
	DocumentClassificationResult,
	DocumentType
} from '../../schemas/document-artifact.schema';

/**
 * Phase 2 mock classifier — keyword-weighted scoring over the extracted
 * text + filename. Real LLM-driven classification is out of scope for
 * Phase 2; we just need useful enough document-type inference to drive the
 * status transitions.
 */

interface ClassifierRule {
	type: DocumentType;
	patterns: Array<{ pattern: RegExp; weight: number }>;
}

const RULES: ClassifierRule[] = [
	{
		type: 'supplier_invoice',
		patterns: [
			{ pattern: /\bsupplier\s*invoice\b/i, weight: 1.0 },
			{ pattern: /\bvendor\s*(invoice|bill)\b/i, weight: 0.9 },
			{ pattern: /\bbill\s*from\b/i, weight: 0.6 },
			{ pattern: /\binvoice\b/i, weight: 0.45 },
			{ pattern: /\binv[-_\s]?\d/i, weight: 0.4 },
			{ pattern: /\bdue\s*date\b/i, weight: 0.25 },
			{ pattern: /\bpayable\s*to\b/i, weight: 0.4 },
			{ pattern: /\bpte\.?\s*ltd\b/i, weight: 0.15 },
			{ pattern: /\bgst\s*(\d|\(|amount)/i, weight: 0.2 }
		]
	},
	{
		type: 'customer_invoice',
		patterns: [
			{ pattern: /\bcustomer\s*invoice\b/i, weight: 1.0 },
			{ pattern: /\bsales\s*invoice\b/i, weight: 0.9 },
			{ pattern: /\binvoice\s*to\b/i, weight: 0.7 },
			{ pattern: /\bbill\s*to\b/i, weight: 0.5 }
		]
	},
	{
		type: 'receipt',
		patterns: [
			{ pattern: /\breceipt\b/i, weight: 0.9 },
			{ pattern: /\bthank\s*you\s*for\s*your\s*(purchase|payment)\b/i, weight: 0.7 },
			{ pattern: /\btill\s*no\b/i, weight: 0.6 },
			{ pattern: /\btransaction\s*ref\b/i, weight: 0.4 }
		]
	},
	{
		type: 'purchase_order',
		patterns: [
			{ pattern: /\bpurchase\s*order\b/i, weight: 1.0 },
			{ pattern: /\bp\.?o\.?\s*number\b/i, weight: 0.8 },
			{ pattern: /\bpo[-_\s]?\d/i, weight: 0.5 }
		]
	},
	{
		type: 'contract',
		patterns: [
			{ pattern: /\bcontract\s*number\b/i, weight: 0.9 },
			{ pattern: /\bservice\s*agreement\b/i, weight: 0.9 },
			{ pattern: /\bagreement\s*made\b/i, weight: 0.7 },
			{ pattern: /\bbetween\s+\S+\s+and\b/i, weight: 0.4 }
		]
	},
	{
		type: 'quotation',
		patterns: [
			{ pattern: /\bquotation\b/i, weight: 1.0 },
			{ pattern: /\bquote\s*number\b/i, weight: 0.8 },
			{ pattern: /\bvalid\s*until\b/i, weight: 0.4 }
		]
	},
	{
		type: 'bank_statement',
		patterns: [
			{ pattern: /\bbank\s*statement\b/i, weight: 1.0 },
			{ pattern: /\bstatement\s*of\s*account\b/i, weight: 0.9 },
			{ pattern: /\bopening\s*balance\b/i, weight: 0.6 }
		]
	},
	{
		type: 'tax_document',
		patterns: [
			{ pattern: /\bgst\s*return\b/i, weight: 1.0 },
			{ pattern: /\btax\s*return\b/i, weight: 0.9 },
			{ pattern: /\biras\b/i, weight: 0.5 }
		]
	},
	{
		type: 'logistics_document',
		patterns: [
			{ pattern: /\bbill\s*of\s*lading\b/i, weight: 1.0 },
			{ pattern: /\bdelivery\s*note\b/i, weight: 0.9 },
			{ pattern: /\bairway\s*bill\b/i, weight: 0.9 },
			{ pattern: /\btracking\s*number\b/i, weight: 0.4 }
		]
	}
];

const FILENAME_HINTS: Array<{ pattern: RegExp; type: DocumentType; weight: number }> = [
	{ pattern: /invoice/i, type: 'supplier_invoice', weight: 0.3 },
	{ pattern: /receipt/i, type: 'receipt', weight: 0.3 },
	{ pattern: /quote|quotation/i, type: 'quotation', weight: 0.4 },
	{ pattern: /\bpo[-_]/i, type: 'purchase_order', weight: 0.4 },
	{ pattern: /contract/i, type: 'contract', weight: 0.4 },
	{ pattern: /statement/i, type: 'bank_statement', weight: 0.3 }
];

const MIN_CONFIDENCE_FOR_KNOWN = 0.4;

export function scoreClassification(input: { text: string; fileName?: string }): {
	scores: Map<DocumentType, number>;
	bestMatches: Array<{ documentType: DocumentType; confidence: number }>;
} {
	const scores = new Map<DocumentType, number>();
	const sample = input.text.slice(0, 4000);

	for (const rule of RULES) {
		let total = 0;
		for (const { pattern, weight } of rule.patterns) {
			if (pattern.test(sample)) total += weight;
		}
		if (total > 0) scores.set(rule.type, total);
	}

	if (input.fileName) {
		for (const hint of FILENAME_HINTS) {
			if (hint.pattern.test(input.fileName)) {
				scores.set(hint.type, (scores.get(hint.type) ?? 0) + hint.weight);
			}
		}
	}

	const ranked = [...scores.entries()]
		.map(([documentType, score]) => ({
			documentType,
			confidence: Math.min(1, score / 1.5)
		}))
		.sort((a, b) => b.confidence - a.confidence);

	return { scores, bestMatches: ranked };
}

export function buildClassification(input: {
	text: string;
	fileName?: string;
}): DocumentClassificationResult {
	const { bestMatches } = scoreClassification(input);
	const top = bestMatches[0];
	if (!top || top.confidence < MIN_CONFIDENCE_FOR_KNOWN) {
		return {
			documentType: 'unknown',
			confidence: top?.confidence ?? 0,
			possibleTypes: bestMatches.slice(0, 3),
			reason: 'No keyword match crossed the confidence threshold.',
			modelId: 'mock-keyword-v1',
			promptVersion: 'v1',
			schemaVersion: 'v1'
		};
	}
	return {
		documentType: top.documentType,
		confidence: top.confidence,
		possibleTypes: bestMatches.slice(0, 3),
		reason: 'Keyword/filename heuristic match.',
		modelId: 'mock-keyword-v1',
		promptVersion: 'v1',
		schemaVersion: 'v1'
	};
}
