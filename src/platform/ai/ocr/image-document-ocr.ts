import { runWorkersVisionOcr, type WorkersVisionOcrResult } from './workers-vision-ocr';

export async function runImageDocumentOcr(
	env: Env,
	input: { imageBytes: Uint8Array; mimeType: string; fileName: string }
): Promise<WorkersVisionOcrResult> {
	return runWorkersVisionOcr(env, { imageBytes: input.imageBytes, mimeType: input.mimeType });
}
