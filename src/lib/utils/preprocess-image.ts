/**
 * Client-side image preprocessing for OCR.
 *
 * Phone photos of documents often have colour noise, uneven lighting, and
 * excessive resolution. This function:
 *   1. Resizes to a width that balances OCR quality vs. payload size.
 *   2. Converts to greyscale (removes colour noise, reduces file size).
 *   3. Applies a contrast stretch so that faint text becomes sharper.
 *
 * Intentionally kept simple — no perspective correction or binarisation —
 * because Gemini Flash handles natural photos well, and heavy thresholding
 * can actually hurt LLM-based vision models.
 */

/** Maximum width (pixels) sent to the OCR service. */
const OCR_MAX_WIDTH = 2000;
/** Maximum height (pixels). Portrait invoices can be tall. */
const OCR_MAX_HEIGHT = 3000;
/** JPEG quality for the preprocessed output (0–1). */
const JPEG_QUALITY = 0.92;
/** Contrast multiplier. 1.0 = unchanged, >1 = more contrast. */
const CONTRAST = 1.4;

export async function preprocessImageForOcr(file: File): Promise<File> {
	// Only process raster images; skip SVG / unknown types.
	if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
		return file;
	}

	return new Promise<File>((resolve) => {
		const img = new Image();
		const objectUrl = URL.createObjectURL(file);

		img.onload = () => {
			URL.revokeObjectURL(objectUrl);

			// ── 1. Compute output dimensions ────────────────────────────────
			let { width, height } = img;
			const scaleW = width > OCR_MAX_WIDTH ? OCR_MAX_WIDTH / width : 1;
			const scaleH = height > OCR_MAX_HEIGHT ? OCR_MAX_HEIGHT / height : 1;
			const scale = Math.min(scaleW, scaleH);
			width = Math.round(width * scale);
			height = Math.round(height * scale);

			// ── 2. Draw onto canvas ──────────────────────────────────────────
			const canvas = document.createElement('canvas');
			canvas.width = width;
			canvas.height = height;
			const ctx = canvas.getContext('2d');
			if (!ctx) {
				resolve(file);
				return;
			}
			ctx.drawImage(img, 0, 0, width, height);

			// ── 3. Greyscale + contrast stretch ──────────────────────────────
			const imageData = ctx.getImageData(0, 0, width, height);
			const d = imageData.data;

			for (let i = 0; i < d.length; i += 4) {
				// Luminance-weighted greyscale
				const gray = 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!;
				// Contrast stretch around mid-grey (128)
				const stretched = Math.min(255, Math.max(0, (gray - 128) * CONTRAST + 128));
				d[i] = d[i + 1] = d[i + 2] = stretched;
				// alpha channel (d[i+3]) is left unchanged
			}

			ctx.putImageData(imageData, 0, 0);

			// ── 4. Export as JPEG ─────────────────────────────────────────────
			canvas.toBlob(
				(blob) => {
					if (!blob) {
						resolve(file);
						return;
					}
					const outName = file.name.replace(/\.[^.]+$/, '_ocr.jpg');
					resolve(new File([blob], outName, { type: 'image/jpeg' }));
				},
				'image/jpeg',
				JPEG_QUALITY
			);
		};

		img.onerror = () => {
			URL.revokeObjectURL(objectUrl);
			resolve(file); // fallback: send original
		};

		img.src = objectUrl;
	});
}
