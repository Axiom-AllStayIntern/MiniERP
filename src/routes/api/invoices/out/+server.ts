import type { RequestHandler } from './$types';

import { getDb, schema } from '$lib/server/db';
import { fail, ok } from '$lib/server/http';

export const POST: RequestHandler = async ({ request, platform }) => {
	if (!platform) {
		return fail('Cloudflare platform bindings are required', 500);
	}

	const body = (await request.json()) as {
		projectId?: string;
		customerId?: string;
		date?: string;
		dueDate?: string;
		currency?: string;
		gstType?: 'standard' | 'zero' | 'exempt';
		lineItems?: Array<{ desc: string; qty: number; price: number }>;
	};

	if (!body.projectId || !body.customerId || !body.date) {
		return fail('Missing required fields: projectId, customerId, date');
	}

	const lineItems = body.lineItems ?? [];
	const subtotal = lineItems.reduce((sum, item) => sum + item.qty * item.price, 0);
	const gstRate = body.gstType === 'standard' || !body.gstType ? 0.09 : 0;
	const gstAmount = subtotal * gstRate;
	const total = subtotal + gstAmount;
	const id = crypto.randomUUID();
	const invoiceNo = `INV-${new Date().getUTCFullYear()}-${Date.now().toString().slice(-6)}`;

	const db = getDb(platform.env);
	await db.insert(schema.invoicesOut).values({
		id,
		projectId: body.projectId,
		customerId: body.customerId,
		invoiceNo,
		date: body.date,
		dueDate: body.dueDate,
		currency: body.currency ?? 'SGD',
		subtotal,
		gstType: body.gstType ?? 'standard',
		gstAmount,
		total,
		status: 'draft',
		lineItems: JSON.stringify(lineItems),
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString()
	});

	return ok({ id, invoiceNo }, 201);
};
