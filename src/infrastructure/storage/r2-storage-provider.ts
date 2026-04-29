import type {
	FileBlob,
	FileServiceContract,
	HeadResult,
	StoredFileRef
} from '../../platform/files/file.types';

function bytesToHex(buffer: ArrayBuffer): string {
	const view = new Uint8Array(buffer);
	let out = '';
	for (const byte of view) out += byte.toString(16).padStart(2, '0');
	return out;
}

/**
 * Concrete FileService implementation backed by Cloudflare R2.
 *
 * The platform-layer FileService factory holds an instance of this; module
 * code (Document Intake, future Tax/HR document flows) never imports this
 * file directly — they go through `createFileService(env)`.
 */
export function createR2FileService(r2: R2Bucket): FileServiceContract {
	function toRef(obj: R2Object, fallbackContentType: string): StoredFileRef {
		const meta = obj.httpMetadata ?? {};
		return {
			key: obj.key,
			contentType: meta.contentType ?? fallbackContentType,
			sizeBytes: obj.size,
			uploadedAt: obj.uploaded.toISOString(),
			checksum: obj.checksums?.md5 ? bytesToHex(obj.checksums.md5) : undefined,
			customMetadata: obj.customMetadata
		};
	}

	function toHead(obj: R2Object): HeadResult {
		const meta = obj.httpMetadata ?? {};
		return {
			key: obj.key,
			contentType: meta.contentType ?? 'application/octet-stream',
			sizeBytes: obj.size,
			uploadedAt: obj.uploaded.toISOString(),
			checksum: obj.checksums?.md5 ? bytesToHex(obj.checksums.md5) : undefined,
			customMetadata: obj.customMetadata
		};
	}

	return {
		async putBlob(blob: FileBlob): Promise<StoredFileRef> {
			const result = await r2.put(blob.key, blob.body, {
				httpMetadata: { contentType: blob.contentType },
				customMetadata: blob.customMetadata
			});
			if (!result) {
				throw new Error(`R2 put returned null for key=${blob.key}`);
			}
			return toRef(result, blob.contentType);
		},

		async head(key: string): Promise<HeadResult | null> {
			const obj = await r2.head(key);
			return obj ? toHead(obj) : null;
		},

		async getBytes(key: string): Promise<Uint8Array | null> {
			const obj = await r2.get(key);
			if (!obj) return null;
			const buf = await obj.arrayBuffer();
			return new Uint8Array(buf);
		},

		async delete(key: string): Promise<void> {
			await r2.delete(key);
		}
	};
}
