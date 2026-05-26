export type WorkersVisionOcrResult =
	| { ok: true; text: string; model: string }
	| { ok: false; error: string };

function readEnv(platformEnv: Env, key: string): string {
	const processEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
	const fromPlatform = (platformEnv as unknown as Record<string, unknown>)[key];
	if (typeof fromPlatform === 'string' && fromPlatform.trim()) return fromPlatform.trim();
	const fromProcess = processEnv?.[key];
	return typeof fromProcess === 'string' ? fromProcess.trim() : '';
}

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

function uint8ToBase64(bytes: Uint8Array): string {
	const chunk = 8192;
	let binary = '';
	for (let i = 0; i < bytes.length; i += chunk) {
		const sub = bytes.subarray(i, i + chunk);
		for (let j = 0; j < sub.length; j += 1) {
			binary += String.fromCharCode(sub[j]!);
		}
	}
	return btoa(binary);
}

function normalizeMime(mime: string): string {
	const m = mime.toLowerCase().trim();
	if (m === 'image/jpg') return 'image/jpeg';
	if (m.startsWith('image/')) return m;
	return 'image/jpeg';
}

function extractVisionText(raw: unknown): string {
	if (raw === null || raw === undefined) return '';
	if (typeof raw === 'string') return raw;
	if (typeof raw !== 'object') return '';

	const o = raw as Record<string, unknown>;
	if (typeof o.response === 'string') return o.response;
	if (typeof o.result === 'string') return o.result;
	if (typeof o.output === 'string') return o.output;
	if (typeof o.output_text === 'string') return o.output_text;
	if (typeof o.text === 'string') return o.text;

	if (o.result && typeof o.result === 'object' && !Array.isArray(o.result)) {
		const r = o.result as Record<string, unknown>;
		if (typeof r.response === 'string') return r.response;
		if (typeof r.text === 'string') return r.text;
	}

	const choices = o.choices as Array<{ message?: { content?: unknown } }> | undefined;
	const content = choices?.[0]?.message?.content;
	if (typeof content === 'string') return content;
	if (Array.isArray(content)) {
		return content
			.map((p) => (typeof p === 'object' && p && 'text' in p ? String((p as { text?: string }).text ?? '') : ''))
			.filter(Boolean)
			.join('\n');
	}

	return '';
}

// Prompt designed to force literal copying, not interpretation.
// Key: no system prompt (Llama Vision responds better to a single direct
// user instruction), explicit "copy exactly", forbid describing/summarizing.
const OCR_PROMPT = `Look at this document image. Copy every word, number, and symbol you see, exactly as printed.

Rules:
- Copy text exactly as it appears. Do not rephrase, summarize, or describe.
- Keep the original layout: one line per printed line, preserve spacing for columns and tables.
- Include all: headers, addresses, dates, amounts, item codes, table rows, footers.
- Do NOT add any words that are not visible in the image.
- Do NOT write sentences like "The invoice is..." or "This document contains...".
- Output only the copied text, nothing else.`;

export async function runWorkersVisionOcr(
	env: Env,
	input: { imageBytes: Uint8Array; mimeType: string }
): Promise<WorkersVisionOcrResult> {
	if (!env.AI) {
		return { ok: false, error: 'Workers AI is not available (missing AI binding).' };
	}
	if (input.imageBytes.length === 0) {
		return { ok: false, error: 'Empty image payload.' };
	}
	if (input.imageBytes.length > MAX_IMAGE_BYTES) {
		return { ok: false, error: `Image too large (${input.imageBytes.length} bytes, max ${MAX_IMAGE_BYTES}).` };
	}

	const model = readEnv(env, 'WORKERS_AI_VISION_MODEL') || '@cf/meta/llama-3.2-11b-vision-instruct';
	const mime = normalizeMime(input.mimeType);
	const dataUri = `data:${mime};base64,${uint8ToBase64(input.imageBytes)}`;

	const messages = [
		{
			role: 'user' as const,
			content: [
				{ type: 'text' as const, text: OCR_PROMPT },
				{ type: 'image_url' as const, image_url: { url: dataUri } }
			]
		}
	];

	const runVision = async () =>
		env.AI!.run(model as Parameters<NonNullable<Env['AI']>['run']>[0], {
			messages,
			max_tokens: 4096,
			temperature: 0
		} as Parameters<NonNullable<Env['AI']>['run']>[1]);

	try {
		let raw: unknown;
		try {
			raw = await runVision();
		} catch {
			if (model.includes('llama')) {
				try {
					await env.AI!.run(model as Parameters<NonNullable<Env['AI']>['run']>[0], {
						prompt: 'agree'
					} as Parameters<NonNullable<Env['AI']>['run']>[1]);
				} catch { /* already agreed or unrelated */ }
				raw = await runVision();
			} else {
				throw new Error(`Vision model ${model} call failed.`);
			}
		}

		const text = extractVisionText(raw).trim();
		if (!text || text === '[UNREADABLE]') {
			return { ok: false, error: 'Vision model returned no usable text.' };
		}
		return { ok: true, text, model };
	} catch (e) {
		return { ok: false, error: e instanceof Error ? e.message : 'Workers AI vision call failed.' };
	}
}
