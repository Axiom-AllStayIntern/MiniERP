import { and, eq } from 'drizzle-orm';

import { getDb, schema } from '$infrastructure/db';

/**
 * Backward-compatible helper kept for routes that already reference this symbol.
 * Hash records are currently stored in `upload_file_dedup`.
 */
export async function deleteUploadedFileHashForEntity(
	env: Env,
	input: { entityType: string; entityId: string }
): Promise<void> {
	const db = getDb(env);
	await db
		.delete(schema.uploadFileDedup)
		.where(
			and(
				eq(schema.uploadFileDedup.entityType, input.entityType),
				eq(schema.uploadFileDedup.entityId, input.entityId)
			)
		);
}
