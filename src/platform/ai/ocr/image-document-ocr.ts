import { runGeminiVisionOcr } from './gemini-vision-ocr';
import { runWorkersVisionOcr } from './workers-vision-ocr';

export type ImageOcrProvider = 'gemini' | 'workers_ai';
type ImageOcrPreference = 'auto' | ImageOcrProvider;

export type ImageDocumentOcrResult =
	| { ok: true; text: string; provider: ImageOcrProvider }
	| { ok: false; error: string; provider: ImageOcrProvider };

function readEnv(platformEnv: Env, key: string): string {
	const processEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
	const fromPlatform = (platformEnv as unknown as Record<string, unknown>)[key];
	if (typeof fromPlatform === 'string' && fromPlatform.trim()) return fromPlatform.trim();
	const fromProcess = processEnv?.[key];
	return typeof fromProcess === 'string' ? fromProcess.trim() : '';
}

function readProviderPreference(env: Env): ImageOcrPreference {
	const value = readEnv(env, 'OCR_IMAGE_PROVIDER').toLowerCase();
	if (value === 'gemini' || value === 'workers_ai') return value;
	return 'auto';
}

/**
 * OCR an image document.
 * Uses Gemini Flash when GEMINI_API_KEY is set; falls back to Workers AI vision model
 * only in `auto` mode.
 */
export async function runImageDocumentOcr(
	env: Env,
	input: { imageBytes: Uint8Array; mimeType: string; fileName: string }
): Promise<ImageDocumentOcrResult> {
	const preference = readProviderPreference(env);
	const geminiKey = readEnv(env, 'GEMINI_API_KEY');

	if (preference !== 'workers_ai') {
		if (!geminiKey && preference === 'gemini') {
			return {
				ok: false,
				error: 'GEMINI_API_KEY is not configured for OCR_IMAGE_PROVIDER=gemini.',
				provider: 'gemini'
			};
		}
		if (!geminiKey) {
			return runWorkersFallback(env, input);
		}
		const result = await runGeminiVisionOcr(env, { imageBytes: input.imageBytes, mimeType: input.mimeType });
		if (result.ok) {
			return { ok: true, text: result.text, provider: 'gemini' };
		}
		if (preference === 'gemini') {
			return { ok: false, error: result.error, provider: 'gemini' };
		}
		console.warn(`[image-ocr] Gemini failed (${result.error}), falling back to Workers AI.`);
	}

	return runWorkersFallback(env, input);
}

async function runWorkersFallback(
	env: Env,
	input: { imageBytes: Uint8Array; mimeType: string }
): Promise<ImageDocumentOcrResult> {
	const visionResult = await runWorkersVisionOcr(env, { imageBytes: input.imageBytes, mimeType: input.mimeType });
	if (visionResult.ok) {
		return { ok: true, text: visionResult.text, provider: 'workers_ai' };
	}
	return { ok: false, error: visionResult.error, provider: 'workers_ai' };
}
