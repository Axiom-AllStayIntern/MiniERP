/**
 * Client-side image preprocessing for OCR.
 *
 * For vision LLMs (GPT-4o, Claude vision, etc.) the most useful preprocessing
 * is just sensible resizing. Aggressive grayscale / contrast / binarisation
 * was designed for classical OCR (Tesseract, Paddle) and tends to *hurt*
 * vision-LLM accuracy by clipping fine details and discarding the colour
 * channels the model uses to disambiguate stamps, highlights, and faint text.
 *
 * What this function does:
 *   1. Caps the longest side to 2048 px — matches OpenAI's high-detail input
 *      cap, so we don't waste bandwidth uploading larger images that the API
 *      would just downscale anyway.
 *   2. Re-encodes as JPEG at high quality.
 *
 * What it intentionally does NOT do:
 *   - Greyscale conversion (hurts colour-cue robustness).
 *   - Contrast stretching (can clip the lightest small digits to pure white).
 *   - Binarisation / thresholding (catastrophic for vision LLMs).
 *   - Sharpening (marginal at best; vision LLMs are robust to mild blur).
 *   - Perspective correction / rotation (worth adding later if your users
 *     upload severely skewed photos; GPT-4o tolerates ±15° on its own).
 */

/** Maximum size for the longest image edge, in pixels. Matches OpenAI vision's high-detail input cap. */
const OCR_MAX_LONG_SIDE = 2048;
/** JPEG quality for the preprocessed output (0–1). */
const JPEG_QUALITY = 0.92;

export async function preprocessImageForOcr(input: Blob, fileName?: string): Promise<File> {
	const sourceName = fileName ?? (input instanceof File ? input.name : 'image.jpg');
	const passthrough = (): File =>
		input instanceof File
			? input
			: new File([input], sourceName, { type: input.type || 'image/jpeg' });

	// Only process raster images; skip SVG / unknown types.
	if (!input.type.startsWith('image/') || input.type === 'image/svg+xml') {
		return passthrough();
	}

	return new Promise<File>((resolve) => {
		const img = new Image();
		const objectUrl = URL.createObjectURL(input);

		img.onload = () => {
			URL.revokeObjectURL(objectUrl);

			// Cap the longest edge to OCR_MAX_LONG_SIDE, preserving aspect ratio.
			let { width, height } = img;
			const longSide = Math.max(width, height);
			const scale = longSide > OCR_MAX_LONG_SIDE ? OCR_MAX_LONG_SIDE / longSide : 1;
			width = Math.round(width * scale);
			height = Math.round(height * scale);

			const canvas = document.createElement('canvas');
			canvas.width = width;
			canvas.height = height;
			const ctx = canvas.getContext('2d');
			if (!ctx) {
				resolve(passthrough());
				return;
			}
			ctx.drawImage(img, 0, 0, width, height);

			canvas.toBlob(
				(blob) => {
					if (!blob) {
						resolve(passthrough());
						return;
					}
					const outName = sourceName.replace(/\.[^.]+$/, '_ocr.jpg');
					resolve(new File([blob], outName, { type: 'image/jpeg' }));
				},
				'image/jpeg',
				JPEG_QUALITY
			);
		};

		img.onerror = () => {
			URL.revokeObjectURL(objectUrl);
			resolve(passthrough());
		};

		img.src = objectUrl;
	});
}
