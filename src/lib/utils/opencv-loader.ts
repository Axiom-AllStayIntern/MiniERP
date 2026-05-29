/**
 * Lazy-loader for OpenCV.js (~10 MB WASM bundle).
 *
 * Only the first preprocessImageForOcr call pays the load cost; subsequent
 * calls reuse the cached promise. Dynamic import lets Vite/SvelteKit split
 * OpenCV into its own chunk so it never bloats the initial page bundle.
 */

// OpenCV.js exposes its API as a single `cv` namespace populated after the
// WASM runtime initialises. The npm package's type bundle is partial, so we
// keep this loosely typed and let callers narrow as needed.
type OpenCv = Record<string, unknown> & {
	Mat: new (...args: unknown[]) => unknown;
	onRuntimeInitialized?: () => void;
};

let cvReady: Promise<OpenCv> | null = null;

export function loadOpenCv(): Promise<OpenCv> {
	if (cvReady) return cvReady;
	cvReady = (async () => {
		const mod = await import('@techstark/opencv-js');
		const cv = (mod.default ?? mod) as OpenCv;
		// If the runtime is already initialised (constructors exist), return now.
		// Otherwise wait for `onRuntimeInitialized` to fire.
		if (typeof cv.Mat === 'function') return cv;
		await new Promise<void>((resolve) => {
			cv.onRuntimeInitialized = () => resolve();
		});
		return cv;
	})();
	return cvReady;
}
