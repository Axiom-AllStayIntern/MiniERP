import type { ZodType } from 'zod';

export type WorkersVisionOcrResult =
	| { ok: true; text: string; model: string }
	| { ok: false; error: string };

export type WorkersVisionJsonResult<T> =
	| { ok: true; value: T; model: string; rawJson: unknown }
	| { ok: false; error: string; model?: string; rawJson?: unknown };

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

function tryParseJson(raw: string): unknown | null {
	const trimmed = raw.trim();
	if (!trimmed) return null;
	try {
		return JSON.parse(trimmed) as unknown;
	} catch {
		return null;
	}
}

function extractBalancedJsonObject(s: string): string | null {
	const start = s.indexOf('{');
	if (start < 0) return null;
	let depth = 0;
	let inString = false;
	let escape = false;
	for (let i = start; i < s.length; i += 1) {
		const c = s[i];
		if (escape) {
			escape = false;
			continue;
		}
		if (c === '\\' && inString) {
			escape = true;
			continue;
		}
		if (c === '"') {
			inString = !inString;
			continue;
		}
		if (inString) continue;
		if (c === '{') depth += 1;
		else if (c === '}') {
			depth -= 1;
			if (depth === 0) return s.slice(start, i + 1);
		}
	}
	return null;
}

function parseLooseJson(text: string): unknown | null {
	const direct = tryParseJson(text);
	if (direct !== null) return direct;
	const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
	if (fenced?.[1]) {
		const inner = tryParseJson(fenced[1].trim());
		if (inner !== null) return inner;
		const balanced = extractBalancedJsonObject(fenced[1]);
		if (balanced) return tryParseJson(balanced);
	}
	const balanced = extractBalancedJsonObject(text);
	return balanced ? tryParseJson(balanced) : null;
}

export function parseVisionJsonResponse(raw: unknown): unknown | null {
	if (raw === null || raw === undefined) return null;
	if (typeof raw === 'string') return parseLooseJson(raw);
	if (typeof raw !== 'object') return null;

	const obj = raw as Record<string, unknown>;
	for (const key of ['response', 'result', 'output', 'output_text', 'text']) {
		const value = obj[key];
		if (typeof value === 'string') {
			const parsed = parseLooseJson(value);
			if (parsed !== null) return parsed;
		}
	}

	if (obj.result && typeof obj.result === 'object' && !Array.isArray(obj.result)) {
		const parsed = parseVisionJsonResponse(obj.result);
		if (parsed !== null) return parsed;
	}

	const choices = obj.choices as Array<{ message?: { content?: unknown } }> | undefined;
	const content = choices?.[0]?.message?.content;
	if (typeof content === 'string') return parseLooseJson(content);
	if (Array.isArray(content)) {
		const text = content
			.map((p) => (typeof p === 'object' && p && 'text' in p ? String((p as { text?: string }).text ?? '') : ''))
			.filter(Boolean)
			.join('\n');
		return parseLooseJson(text);
	}

	return obj;
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

async function runExternalVisionText(
	env: Env,
	input: { imageBytes: Uint8Array; mimeType: string; prompt: string; maxTokens?: number }
): Promise<{ ok: true; text: string; model: string } | { ok: false; error: string }> {
	const apiUrl = readEnv(env, 'VISION_API_URL');
	const apiKey = readEnv(env, 'VISION_API_KEY') || readEnv(env, 'LLM_API_KEY');
	if (!apiUrl || !apiKey) return { ok: false, error: 'External vision API not configured.' };
	const model = readEnv(env, 'VISION_API_MODEL') || 'gpt-4o';

	const mime = normalizeMime(input.mimeType);
	const b64 = uint8ToBase64(input.imageBytes);
	const body = {
		model,
		messages: [
			{
				role: 'user',
				content: [
					{ type: 'text', text: input.prompt },
					{ type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } }
				]
			}
		],
		max_tokens: input.maxTokens ?? 4096,
		temperature: 0
	};

	const resp = await fetch(apiUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
		body: JSON.stringify(body)
	});
	if (!resp.ok) return { ok: false, error: `External vision API ${resp.status}: ${await resp.text().catch(() => '')}` };
	const json = (await resp.json()) as Record<string, unknown>;
	const text = extractVisionText(json).trim();
	if (!text) return { ok: false, error: 'External vision API returned empty text.' };
	return { ok: true, text, model };
}

async function runExternalVisionJson<T>(
	env: Env,
	input: {
		imageBytes: Uint8Array;
		mimeType: string;
		prompt: string;
		schema: ZodType<T>;
		maxTokens?: number;
	}
): Promise<WorkersVisionJsonResult<T>> {
	const apiUrl = readEnv(env, 'VISION_API_URL');
	const apiKey = readEnv(env, 'VISION_API_KEY') || readEnv(env, 'LLM_API_KEY');
	if (!apiUrl || !apiKey) return { ok: false, error: 'External vision API not configured.' };
	const model = readEnv(env, 'VISION_API_MODEL') || 'gpt-4o';

	const mime = normalizeMime(input.mimeType);
	const b64 = uint8ToBase64(input.imageBytes);
	const body = {
		model,
		messages: [
			{
				role: 'user',
				content: [
					{ type: 'text', text: input.prompt },
					{ type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } }
				]
			}
		],
		max_tokens: input.maxTokens ?? 2048,
		temperature: 0,
		response_format: { type: 'json_object' }
	};

	try {
		const resp = await fetch(apiUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
			body: JSON.stringify(body)
		});
		if (!resp.ok) return { ok: false, error: `External vision API ${resp.status}`, model };
		const raw = (await resp.json()) as Record<string, unknown>;
		const json = parseVisionJsonResponse(raw);
		const parsed = input.schema.safeParse(json);
		if (!parsed.success) {
			return {
				ok: false,
				error: parsed.error.issues.map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`).join('; '),
				model,
				rawJson: json ?? undefined
			};
		}
		return { ok: true, value: parsed.data, model, rawJson: json };
	} catch (e) {
		return { ok: false, error: e instanceof Error ? e.message : 'External vision JSON call failed.', model };
	}
}

export async function runWorkersVisionOcr(
	env: Env,
	input: { imageBytes: Uint8Array; mimeType: string }
): Promise<WorkersVisionOcrResult> {
	if (input.imageBytes.length === 0) {
		return { ok: false, error: 'Empty image payload.' };
	}
	if (input.imageBytes.length > MAX_IMAGE_BYTES) {
		return { ok: false, error: `Image too large (${input.imageBytes.length} bytes, max ${MAX_IMAGE_BYTES}).` };
	}

	const skipWorkers = readEnv(env, 'VISION_SKIP_WORKERS') === 'true';

	if (!skipWorkers && env.AI) {
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
			if (text && text !== '[UNREADABLE]') {
				return { ok: true, text, model };
			}
			console.warn('[runWorkersVisionOcr] Workers AI returned no usable text, trying external fallback.');
		} catch (e) {
			console.warn(`[runWorkersVisionOcr] Workers AI failed: ${e instanceof Error ? e.message : e}, trying external fallback.`);
		}
	}

	const external = await runExternalVisionText(env, {
		imageBytes: input.imageBytes,
		mimeType: input.mimeType,
		prompt: OCR_PROMPT
	});
	return external;
}

export async function runWorkersVisionJson<T>(
	env: Env,
	input: {
		imageBytes: Uint8Array;
		mimeType: string;
		systemPrompt: string;
		userPrompt: string;
		schema: ZodType<T>;
		maxTokens?: number;
	}
): Promise<WorkersVisionJsonResult<T>> {
	if (input.imageBytes.length === 0) {
		return { ok: false, error: 'Empty image payload.' };
	}
	if (input.imageBytes.length > MAX_IMAGE_BYTES) {
		return { ok: false, error: `Image too large (${input.imageBytes.length} bytes, max ${MAX_IMAGE_BYTES}).` };
	}

	const combinedPrompt = `${input.systemPrompt.trim()}

${input.userPrompt.trim()}

Return only one valid JSON object. No markdown, no preamble, no commentary.`;

	const skipWorkers = readEnv(env, 'VISION_SKIP_WORKERS') === 'true';

	if (!skipWorkers && env.AI) {
		const model = readEnv(env, 'WORKERS_AI_VISION_MODEL') || '@cf/meta/llama-3.2-11b-vision-instruct';
		const mime = normalizeMime(input.mimeType);
		const dataUri = `data:${mime};base64,${uint8ToBase64(input.imageBytes)}`;

		const messages = [
			{
				role: 'user' as const,
				content: [
					{ type: 'text' as const, text: combinedPrompt },
					{ type: 'image_url' as const, image_url: { url: dataUri } }
				]
			}
		];

		const runVision = async () =>
			env.AI!.run(model as Parameters<NonNullable<Env['AI']>['run']>[0], {
				messages,
				max_tokens: input.maxTokens ?? 2048,
				temperature: 0,
				response_format: { type: 'json_object' }
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

			const json = parseVisionJsonResponse(raw);
			const parsed = input.schema.safeParse(json);
			if (parsed.success) {
				return { ok: true, value: parsed.data, model, rawJson: json };
			}
			console.warn(`[runWorkersVisionJson] Workers AI schema validation failed, trying external fallback: ${parsed.error.issues.map((i) => i.message).join('; ')}`);
		} catch (e) {
			console.warn(`[runWorkersVisionJson] Workers AI failed: ${e instanceof Error ? e.message : e}, trying external fallback.`);
		}
	}

	const external = await runExternalVisionJson<T>(env, {
		imageBytes: input.imageBytes,
		mimeType: input.mimeType,
		prompt: combinedPrompt,
		schema: input.schema,
		maxTokens: input.maxTokens
	});
	return external;
}
