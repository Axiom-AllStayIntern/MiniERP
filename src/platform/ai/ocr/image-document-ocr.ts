import { runGeminiVisionOcr } from './gemini-vision-ocr';
import { runWorkersVisionOcr } from './workers-vision-ocr';

export type ImageOcrProvider = 'gemini' | 'workers_ai';

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

/**
 * OCR an image document.
 * Uses Gemini Flash when GEMINI_API_KEY is set; falls back to Workers AI vision model.
 */
export async function runImageDocumentOcr(
	env: Env,
	input: { imageBytes: Uint8Array; mimeType: string; fileName: string }
): Promise<ImageDocumentOcrResult> {
	const geminiKey = readEnv(env, 'GEMINI_API_KEY');

	if (geminiKey) {
		const result = await runGeminiVisionOcr(env, { imageBytes: input.imageBytes, mimeType: input.mimeType });
		if (result.ok) {
			return { ok: true, text: result.text, provider: 'gemini' };
		}
		console.warn(`[image-ocr] Gemini failed (${result.error}), falling back to Workers AI.`);
	}

	const visionResult = await runWorkersVisionOcr(env, { imageBytes: input.imageBytes, mimeType: input.mimeType });
	if (visionResult.ok) {
		return { ok: true, text: visionResult.text, provider: 'workers_ai' };
	}
	return { ok: false, error: visionResult.error, provider: 'workers_ai' };
}
