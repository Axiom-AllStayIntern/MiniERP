/**
 * File-service contracts.
 *
 * Document Intake (and any future module that handles files) talks to this
 * surface instead of `env.R2` directly so the storage backend can swap
 * cleanly in the future.
 */

export interface FileBlob {
	key: string;
	body: ArrayBuffer | Uint8Array | ReadableStream<Uint8Array>;
	contentType: string;
	contentLength?: number;
	customMetadata?: Record<string, string>;
}

export interface StoredFileRef {
	key: string;
	contentType: string;
	sizeBytes: number;
	uploadedAt: string;
	checksum?: string;
	customMetadata?: Record<string, string>;
}

export interface HeadResult {
	key: string;
	contentType: string;
	sizeBytes: number;
	uploadedAt: string;
	checksum?: string;
	customMetadata?: Record<string, string>;
}

export interface FileServiceContract {
	putBlob(blob: FileBlob): Promise<StoredFileRef>;
	head(key: string): Promise<HeadResult | null>;
	getBytes(key: string): Promise<Uint8Array | null>;
	delete(key: string): Promise<void>;
}
