/**
 * Mock OCR text fixtures keyed by filename keyword. Used by the
 * text-extraction primitive when no AI binding is available (local dev) or
 * when the caller explicitly opts into mock mode.
 *
 * The text is realistic enough that the Phase 1 finance fixture extraction
 * (Stage 4) can recognize the same suppliers (Axiom Tech, Cloudfactor SG,
 * Neon Robotics) once it's reading from the artifact text instead of from
 * filename keywords directly.
 */

interface Fixture {
	keywords: string[];
	text: string;
	confidence: number;
}

const FIXTURES: Fixture[] = [
	{
		keywords: ['axiom'],
		text: [
			'Axiom Tech Pte Ltd',
			'31 Industrial Park Road #04-12',
			'Singapore 619901',
			'',
			'INVOICE  INV-2026-0148',
			'Issue date: 2026-04-22',
			'Due date:   2026-05-22',
			'',
			'Description           Amount (SGD)',
			'Engineering services       11,421.56',
			'',
			'Subtotal:   11,421.56',
			'GST (9%):    1,028.44',
			'Total:      12,450.00 SGD'
		].join('\n'),
		confidence: 0.94
	},
	{
		keywords: ['cloudfactor', 'cloud'],
		text: [
			'Cloudfactor SG',
			'88 Robinson Road #18-02',
			'Singapore 068898',
			'',
			'Tax Invoice CF-2026-Q2-0072',
			'Issue: 2026-04-18   Due: 2026-05-18',
			'',
			'Cloud platform usage        4,458.35',
			'GST 9%                        401.65',
			'Total                       4,860.00 SGD'
		].join('\n'),
		confidence: 0.91
	},
	{
		keywords: ['neon', 'robotics'],
		text: [
			'Neon Robotics',
			'120 Tuas South Avenue 8',
			'Singapore 637057',
			'',
			'INVOICE NR-2026-1140',
			'Date issued 2026-04-15',
			'Payment due 2026-05-30',
			'',
			'Robotics integration        25,503.67',
			'GST 9%                       2,296.33',
			'Total payable               27,800.00 SGD'
		].join('\n'),
		confidence: 0.88
	}
];

const DEFAULT_FIXTURE = FIXTURES[0];

export function pickMockFixtureText(input: { fileName?: string; key?: string }): {
	text: string;
	confidence: number;
} {
	const haystack = `${input.fileName ?? ''} ${input.key ?? ''}`.toLowerCase();
	const matched = FIXTURES.find((f) => f.keywords.some((k) => haystack.includes(k)));
	const fixture = matched ?? DEFAULT_FIXTURE;
	return { text: fixture.text, confidence: fixture.confidence };
}
