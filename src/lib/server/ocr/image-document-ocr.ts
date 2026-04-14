import type { WorkersVisionOcrResult } from './workers-vision-ocr';
import { runWorkersVisionOcr } from './workers-vision-ocr';
import { runPaddleOcrHttp } from './paddle-ocr-client';

function readEnv(platformEnv: Env, key: string): string {
	const processEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
	const fromPlatform = (platformEnv as unknown as Record<string, unknown>)[key];
	if (typeof fromPlatform === 'string' && fromPlatform.trim()) return fromPlatform.trim();
	const fromProcess = processEnv?.[key];
	return typeof fromProcess === 'string' ? fromProcess.trim() : '';
}

/**
 * Image → text for AR upload pipeline.
 * - If `PADDLE_OCR_URL` is set (e.g. http://127.0.0.1:8765), uses local Paddle HTTP service first.
 * - If `OCR_PADDLE_ONLY` is `true`, does not fall back to Workers AI.
 * - Otherwise falls back to Workers AI vision when Paddle is unset or fails.
 */
export async function runImageDocumentOcr(
	env: Env,
	input: { imageBytes: Uint8Array; mimeType: string; fileName: string }
): Promise<WorkersVisionOcrResult> {
	const paddleUrl = readEnv(env, 'PADDLE_OCR_URL');
	const paddleOnly = readEnv(env, 'OCR_PADDLE_ONLY').toLowerCase() === 'true';

	if (paddleUrl) {
		const paddle = await runPaddleOcrHttp(paddleUrl, input);
		if (paddle.ok) {
			return { ok: true, text: paddle.text, model: 'paddleocr-http' };
		}
		if (paddleOnly) {
			return { ok: false, error: paddle.error };
		}
	}

	return runWorkersVisionOcr(env, {
		imageBytes: input.imageBytes,
		mimeType: input.mimeType
	});
}
