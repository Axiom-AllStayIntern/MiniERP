import { describe, it, expect } from 'vitest';
import { sha256Hex, normalizeProjectScope } from '$platform/files/upload-guards';

describe('sha256Hex', () => {
	it('returns a 64-character lowercase hex string', async () => {
		const buf = new TextEncoder().encode('hello').buffer as ArrayBuffer;
		const result = await sha256Hex(buf);
		expect(result).toHaveLength(64);
		expect(result).toMatch(/^[0-9a-f]+$/);
	});

	it('matches the known SHA-256 digest of the empty input', async () => {
		// SHA-256('') = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
		const result = await sha256Hex(new ArrayBuffer(0));
		expect(result).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
	});

	it('is deterministic for the same input', async () => {
		const buf = new TextEncoder().encode('smartfin-payload').buffer as ArrayBuffer;
		const r1 = await sha256Hex(buf);
		const r2 = await sha256Hex(buf);
		expect(r1).toBe(r2);
	});

	it('produces different digests for different inputs', async () => {
		const a = await sha256Hex(new TextEncoder().encode('hello').buffer as ArrayBuffer);
		const b = await sha256Hex(new TextEncoder().encode('world').buffer as ArrayBuffer);
		expect(a).not.toBe(b);
	});

	it('output is lowercase (no uppercase hex digits)', async () => {
		const buf = new TextEncoder().encode('CaseSensitivityCheck').buffer as ArrayBuffer;
		const result = await sha256Hex(buf);
		expect(result).toBe(result.toLowerCase());
	});
});

describe('normalizeProjectScope', () => {
	it('returns the projectId as-is when provided', () => {
		expect(normalizeProjectScope('proj-abc-123')).toBe('proj-abc-123');
	});

	it('trims surrounding whitespace', () => {
		expect(normalizeProjectScope('  proj-456  ')).toBe('proj-456');
	});

	it('returns __company__ for null', () => {
		expect(normalizeProjectScope(null)).toBe('__company__');
	});

	it('returns __company__ for undefined', () => {
		expect(normalizeProjectScope(undefined)).toBe('__company__');
	});

	it('returns __company__ for an empty string', () => {
		expect(normalizeProjectScope('')).toBe('__company__');
	});

	it('returns __company__ for a whitespace-only string', () => {
		expect(normalizeProjectScope('   ')).toBe('__company__');
	});
});
