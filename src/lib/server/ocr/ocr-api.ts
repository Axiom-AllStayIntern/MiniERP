type ExternalOcrResponse = {
	text: string;
	confidence?: number;
};

export async function extractWithExternalOcr(imageBytes: ArrayBuffer): Promise<ExternalOcrResponse> {
	void imageBytes;
	// Architecture-first stub: external OCR provider can be wired with env vars later.
	return {
		text: '',
		confidence: 0
	};
}
