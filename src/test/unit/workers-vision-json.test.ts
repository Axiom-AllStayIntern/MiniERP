import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { parseVisionJsonResponse } from '$platform/ai/ocr/workers-vision-ocr';

const schema = z.object({
	categoryId: z.string().nullable(),
	confidence: z.number()
});

describe('parseVisionJsonResponse', () => {
	it('parses Workers AI response text containing JSON', () => {
		const parsed = parseVisionJsonResponse({
			response: '```json\n{"categoryId":"expense.opex.others","confidence":0.72}\n```'
		});

		expect(schema.safeParse(parsed).success).toBe(true);
	});

	it('parses nested result response JSON', () => {
		const parsed = parseVisionJsonResponse({
			result: {
				response: 'Result: {"categoryId":null,"confidence":0}'
			}
		});

		expect(parsed).toEqual({ categoryId: null, confidence: 0 });
	});
});
