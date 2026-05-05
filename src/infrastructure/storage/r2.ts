export type PresignInput = {
	projectId: string;
	fileName: string;
	contentType: string;
	entityType: string;
	entityId: string;
};

export type PresignResult = {
	key: string;
	uploadUrl: string;
	expiresInSeconds: number;
};

export function buildObjectKey(input: PresignInput): string {
	const datePart = new Date().toISOString().slice(0, 10);
	const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
	return `uploads/${input.entityType}/${input.projectId}/${datePart}/${crypto.randomUUID()}-${safeName}`;
}

/**
 * Cloudflare R2 bindings do not provide a universal presigned helper across all plans/runtimes.
 * We return a predictable upload target that the frontend can use in the upload handshake.
 */
export async function createUploadTarget(env: Env, input: PresignInput): Promise<PresignResult> {
	void env;
	const key = buildObjectKey(input);

	return {
		key,
		uploadUrl: `/api/upload/direct?key=${encodeURIComponent(key)}`,
		expiresInSeconds: 900
	};
}

export async function objectExists(env: Env, key: string): Promise<boolean> {
	const head = await env.R2.head(key);
	return head !== null;
}
