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

const SYSTEM_PROMPT = `You are an OCR engine for business and finance documents (invoices, contracts, POs, quotations).
Transcribe ALL visible text in natural reading order.
Rules:
- Output plain text only. No markdown, no preamble, no "Here is the text".
- Preserve line breaks where they separate distinct lines or table rows.
- Include numbers, dates, amounts, tax IDs, addresses, and table cells as they appear.
- If the image is unreadable or not a document, output a single line: [UNREADABLE]`;

const USER_PROMPT =
	'Transcribe every legible word, digit, and symbol from this document image. Use the same language(s) as printed on the page.';

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
		{ role: 'system' as const, content: SYSTEM_PROMPT },
		{
			role: 'user' as const,
			content: [
				{ type: 'text' as const, text: USER_PROMPT },
				{ type: 'image_url' as const, image_url: { url: dataUri } }
			]
		}
	];

	const runVision = async () =>
		env.AI!.run(model as Parameters<NonNullable<Env['AI']>['run']>[0], {
			messages,
			max_tokens: 2048,
			temperature: 0.2
		} as Parameters<NonNullable<Env['AI']>['run']>[1]);

	try {
		let raw: unknown;
		try {
			raw = await runVision();
		} catch {
			// Llama 3.2 Vision requires a one-time Meta license acknowledgement
			try {
				await env.AI!.run(model as Parameters<NonNullable<Env['AI']>['run']>[0], {
					prompt: 'agree'
				} as Parameters<NonNullable<Env['AI']>['run']>[1]);
			} catch { /* already agreed or unrelated */ }
			raw = await runVision();
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
