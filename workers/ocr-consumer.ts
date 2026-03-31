import { eq } from 'drizzle-orm';

import { getDb, schema } from '../src/lib/server/db';
import { runOcrPipeline } from '../src/lib/server/ocr/pipeline';
import type { OcrQueueMessage } from '../src/lib/server/ocr/types';

type ConsumerEnv = {
	DB: D1Database;
	R2: R2Bucket;
};

export default {
	async queue(batch: MessageBatch<unknown>, env: ConsumerEnv): Promise<void> {
		for (const message of batch.messages) {
			const payload = message.body as OcrQueueMessage;
			try {
				await processMessage(env, payload);
				message.ack();
			} catch (error) {
				console.error('OCR consumer failed', { error, payload });
				message.retry();
			}
		}
	}
};

async function processMessage(env: ConsumerEnv, payload: OcrQueueMessage): Promise<void> {
	const obj = await env.R2.get(payload.fileKey);
	if (!obj) {
		throw new Error(`R2 object not found: ${payload.fileKey}`);
	}

	const bytes = await obj.arrayBuffer();
	const extracted = await runOcrPipeline(payload.fileType, bytes);
	const db = getDb(env as Env);

	if (payload.entityType === 'invoice_in') {
		await db
			.update(schema.invoicesIn)
			.set({
				invoiceDate: extracted.invoiceDate,
				amount: extracted.totalAmount ?? 0,
				currency: extracted.currency ?? 'SGD',
				supplierName: extracted.supplierName,
				gstAmount: extracted.gstAmount ?? 0,
				dueDate: extracted.dueDate,
				poNumber: extracted.poNumber,
				status: 'pending_review',
				ocrConfidence: extracted.confidence,
				rawOcr: JSON.stringify(extracted),
				updatedAt: new Date().toISOString()
			})
			.where(eq(schema.invoicesIn.id, payload.entityId));
	}
}
