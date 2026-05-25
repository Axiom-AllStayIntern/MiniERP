import { describe, it, expect } from 'vitest';
import { getQuarterRange, calcCorporateTax } from '$modules/finance/services/tax-service';

// ─── getQuarterRange ─────────────────────────────────────────────────────────

describe('getQuarterRange', () => {
	it('returns null for quarter 0 (below range)', () => {
		expect(getQuarterRange('2025', '0')).toBeNull();
	});

	it('returns null for quarter 5 (above range)', () => {
		expect(getQuarterRange('2025', '5')).toBeNull();
	});

	it('returns null for non-numeric quarter', () => {
		expect(getQuarterRange('2025', 'x')).toBeNull();
	});

	it('returns null for non-numeric year', () => {
		expect(getQuarterRange('abc', '1')).toBeNull();
	});

	it('Q1 spans 2025-01-01 to 2025-03-31', () => {
		const r = getQuarterRange('2025', '1')!;
		expect(r.start).toBe('2025-01-01');
		expect(r.end).toBe('2025-03-31');
	});

	it('Q2 spans 2025-04-01 to 2025-06-30', () => {
		const r = getQuarterRange('2025', '2')!;
		expect(r.start).toBe('2025-04-01');
		expect(r.end).toBe('2025-06-30');
	});

	it('Q3 spans 2025-07-01 to 2025-09-30', () => {
		const r = getQuarterRange('2025', '3')!;
		expect(r.start).toBe('2025-07-01');
		expect(r.end).toBe('2025-09-30');
	});

	it('Q4 spans 2025-10-01 to 2025-12-31', () => {
		const r = getQuarterRange('2025', '4')!;
		expect(r.start).toBe('2025-10-01');
		expect(r.end).toBe('2025-12-31');
	});

	it('handles a leap year Q1 end date correctly (Mar 31, not Feb 29)', () => {
		const r = getQuarterRange('2024', '1')!;
		expect(r.start).toBe('2024-01-01');
		expect(r.end).toBe('2024-03-31');
	});

	it('is deterministic for the same inputs', () => {
		expect(getQuarterRange('2025', '2')).toEqual(getQuarterRange('2025', '2'));
	});
});

// ─── calcCorporateTax ────────────────────────────────────────────────────────

describe('calcCorporateTax', () => {
	it('returns 0 for zero taxable income', () => {
		expect(calcCorporateTax(0)).toBe(0);
	});

	it('applies 4.25% on the first 10 000', () => {
		// 10000 × 4.25% = 425
		expect(calcCorporateTax(10000)).toBeCloseTo(425, 2);
	});

	it('applies 8.5% on the 10 001–200 000 tranche', () => {
		// 10000 × 4.25% + 190000 × 8.5% = 425 + 16150 = 16575
		expect(calcCorporateTax(200000)).toBeCloseTo(16575, 2);
	});

	it('applies 17% above 200 000', () => {
		// 16575 + 100000 × 17% = 16575 + 17000 = 33575
		expect(calcCorporateTax(300000)).toBeCloseTo(33575, 2);
	});

	it('partial first-band income: 5000 × 4.25%', () => {
		expect(calcCorporateTax(5000)).toBeCloseTo(5000 * 0.0425, 2);
	});

	it('income exactly at second-band boundary (200 000) matches known value', () => {
		expect(calcCorporateTax(200000)).toBeCloseTo(16575, 5);
	});
});
