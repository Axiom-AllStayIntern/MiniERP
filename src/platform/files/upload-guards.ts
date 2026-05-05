import { and, eq, isNull } from 'drizzle-orm';

import { schema, type DBClient } from '$infrastructure/db';

const COMPANY_SCOPE = '__company__';

function nowIso(): string {
	return new Date().toISOString();
}

function errorChainText(e: unknown): string {
	if (e instanceof Error) {
		const parts = [e.message];
		let c: unknown = e.cause;
		let depth = 0;
		while (c instanceof Error && depth < 6) {
			parts.push(c.message);
			c = c.cause;
			depth += 1;
		}
		return parts.join(' | ');
	}
	return String(e);
}

function isUniqueError(e: unknown): boolean {
	const t = errorChainText(e).toLowerCase();
	return (
		t.includes('unique') ||
		t.includes('sqlite_constraint_unique') ||
		t.includes('sqlite_constraint') ||
		(t.includes('constraint failed') && t.includes('upload_file_dedup'))
	);
}

function isMissingSchemaError(e: unknown): boolean {
	const t = errorChainText(e).toLowerCase();
	return t.includes('no such table') || t.includes('no such column');
}

export class UploadGuardSchemaError extends Error {}

export function normalizeProjectScope(projectId: string | null | undefined): string {
	const v = typeof projectId === 'string' ? projectId.trim() : '';
	return v || COMPANY_SCOPE;
}

export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	return Array.from(new Uint8Array(digest))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

export async function getObjectSha256(env: Env, key: string): Promise<string | null> {
	const obj = await env.R2.get(key);
	if (!obj) return null;
	const bytes = await obj.arrayBuffer();
	return sha256Hex(bytes);
}

export async function beginIdempotentRequest(
	db: DBClient,
	input: {
		idempotencyKey: string;
		endpoint: string;
		userId: string | null;
		projectScope: string;
	}
): Promise<
	| { state: 'started' }
	| { state: 'in_progress' }
	| { state: 'completed'; responseBody: string | null }
> {
	const now = nowIso();
	try {
		await db.insert(schema.uploadIdempotency).values({
			id: crypto.randomUUID(),
			idempotencyKey: input.idempotencyKey,
			endpoint: input.endpoint,
			userId: input.userId,
			projectScope: input.projectScope,
			status: 'processing',
			createdAt: now,
			updatedAt: now
		});
		return { state: 'started' };
	} catch (e) {
		if (isMissingSchemaError(e)) {
			throw new UploadGuardSchemaError('Upload guard tables are not migrated yet.');
		}
		if (!isUniqueError(e)) throw e;
		const [row] = await db
			.select({
				status: schema.uploadIdempotency.status,
				responseBody: schema.uploadIdempotency.responseBody
			})
			.from(schema.uploadIdempotency)
			.where(eq(schema.uploadIdempotency.idempotencyKey, input.idempotencyKey))
			.limit(1);
		if (!row) return { state: 'in_progress' };
		if (row.status === 'completed') {
			return { state: 'completed', responseBody: row.responseBody };
		}
		return { state: 'in_progress' };
	}
}

export async function completeIdempotentRequest(
	db: DBClient,
	idempotencyKey: string,
	responseBody: string
): Promise<void> {
	await db
		.update(schema.uploadIdempotency)
		.set({ status: 'completed', responseBody, updatedAt: nowIso() })
		.where(eq(schema.uploadIdempotency.idempotencyKey, idempotencyKey));
}

export async function failIdempotentRequest(
	db: DBClient,
	idempotencyKey: string,
	errorMessage: string
): Promise<void> {
	await db
		.update(schema.uploadIdempotency)
		.set({ status: 'failed', errorMessage, updatedAt: nowIso() })
		.where(eq(schema.uploadIdempotency.idempotencyKey, idempotencyKey));
}

export async function claimFileHash(
	db: DBClient,
	input: {
		domain: 'expense' | 'revenue';
		projectScope: string;
		fileHash: string;
		entityType: string;
		entityId: string;
		createdBy: string | null;
	}
): Promise<{ ok: true } | { ok: false; duplicateEntityId: string | null }> {
	const now = nowIso();
	const insertClaim = async () =>
		db.insert(schema.uploadFileDedup).values({
			id: crypto.randomUUID(),
			domain: input.domain,
			projectScope: input.projectScope,
			fileHash: input.fileHash,
			entityType: input.entityType,
			entityId: input.entityId,
			createdBy: input.createdBy,
			createdAt: now,
			updatedAt: now
		});

	const dedupEntityStillExists = async (entityType: string, entityId: string): Promise<boolean> => {
		if (!entityId) return false;
		if (entityType === 'expense') {
			const [row] = await db
				.select({ id: schema.expenses.id })
				.from(schema.expenses)
				.where(and(eq(schema.expenses.id, entityId), isNull(schema.expenses.deletedAt)))
				.limit(1);
			return !!row;
		}
		if (entityType === 'invoice_out' || entityType === 'revenue') {
			const [row] = await db
				.select({ id: schema.revenue.id })
				.from(schema.revenue)
				.where(and(eq(schema.revenue.id, entityId), isNull(schema.revenue.deletedAt)))
				.limit(1);
			return !!row;
		}
		return true;
	};
	try {
		await insertClaim();
		return { ok: true };
	} catch (e) {
		if (isMissingSchemaError(e)) {
			throw new UploadGuardSchemaError('Upload guard tables are not migrated yet.');
		}
		if (!isUniqueError(e)) throw e;
		const [row] = await db
			.select({ entityId: schema.uploadFileDedup.entityId })
			.from(schema.uploadFileDedup)
			.where(
				and(
					eq(schema.uploadFileDedup.domain, input.domain),
					eq(schema.uploadFileDedup.projectScope, input.projectScope),
					eq(schema.uploadFileDedup.fileHash, input.fileHash)
				)
			)
			.limit(1);
		const duplicateEntityId = row?.entityId ?? null;
		if (duplicateEntityId) {
			const isLive = await dedupEntityStillExists(input.entityType, duplicateEntityId);
			if (!isLive) {
				// stale dedupe record (entity deleted/missing): reclaim and retry once
				await releaseFileHashClaim(db, {
					domain: input.domain,
					projectScope: input.projectScope,
					fileHash: input.fileHash
				});
				try {
					await insertClaim();
					return { ok: true };
				} catch (retryErr) {
					if (!isUniqueError(retryErr)) throw retryErr;
				}
			}
		}
		return { ok: false, duplicateEntityId };
	}
}

export async function releaseFileHashClaim(
	db: DBClient,
	input: { domain: 'expense' | 'revenue'; projectScope: string; fileHash: string }
): Promise<void> {
	await db
		.delete(schema.uploadFileDedup)
		.where(
			and(
				eq(schema.uploadFileDedup.domain, input.domain),
				eq(schema.uploadFileDedup.projectScope, input.projectScope),
				eq(schema.uploadFileDedup.fileHash, input.fileHash)
			)
		);
}
