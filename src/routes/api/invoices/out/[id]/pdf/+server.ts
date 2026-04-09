import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

import { getDb, schema } from '$lib/server/modules/legacy-db';
import { fail, ok } from '$lib/server/http';
import { parseStoredInvoiceLineItems } from '$lib/invoice-line-items';
import { objectExists } from '$lib/server/r2';

function esc(s: string): string {
	return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function buildSimpleInvoicePdf(params: {
	invoiceNo: string;
	date: string;
	dueDate: string | null;
	currency: string;
	customerName: string;
	total: number;
	lines: Array<{ desc: string; qty: number; price: number }>;
}): Uint8Array {
	const rows = params.lines.slice(0, 18);
	const textLines = [
		`SmartFin Invoice`,
		`Invoice No: ${params.invoiceNo}`,
		`Date: ${params.date}`,
		`Due: ${params.dueDate ?? '-'}`,
		`Customer: ${params.customerName}`,
		'',
		'Description | Qty | Unit | Amount'
	];
	for (const r of rows) {
		const amount = r.qty * r.price;
		textLines.push(`${r.desc || '-'} | ${r.qty} | ${params.currency} ${r.price.toFixed(2)} | ${params.currency} ${amount.toFixed(2)}`);
	}
	textLines.push('', `Total: ${params.currency} ${params.total.toFixed(2)}`);

	const streamParts: string[] = ['BT', '/F1 12 Tf', '50 790 Td', '14 TL'];
	textLines.forEach((line, i) => {
		if (i > 0) streamParts.push('T*');
		streamParts.push(`(${esc(line)}) Tj`);
	});
	streamParts.push('ET');
	const stream = streamParts.join('\n');

	const objects: string[] = [];
	objects.push('1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj');
	objects.push('2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj');
	objects.push('3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj');
	objects.push('4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj');
	objects.push(`5 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`);

	let pdf = '%PDF-1.4\n';
	const xref: number[] = [0];
	for (const obj of objects) {
		xref.push(pdf.length);
		pdf += `${obj}\n`;
	}
	const xrefStart = pdf.length;
	pdf += `xref\n0 ${objects.length + 1}\n`;
	pdf += '0000000000 65535 f \n';
	for (let i = 1; i <= objects.length; i++) {
		pdf += `${String(xref[i]).padStart(10, '0')} 00000 n \n`;
	}
	pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

	return new TextEncoder().encode(pdf);
}

export const POST: RequestHandler = async ({ params, platform, request }) => {
	if (!platform) {
		return fail('Cloudflare platform bindings are required', 500);
	}

	let uploadedKey = '';
	try {
		const body = (await requestJsonSafe(request)) as { key?: string };
		uploadedKey = typeof body?.key === 'string' ? body.key.trim() : '';
	} catch {
		uploadedKey = '';
	}

	const db = getDb(platform.env);
	const [invoice] = await db
		.select({
			id: schema.invoicesOut.id,
			invoiceNo: schema.invoicesOut.invoiceNo,
			date: schema.invoicesOut.date,
			dueDate: schema.invoicesOut.dueDate,
			currency: schema.invoicesOut.currency,
			total: schema.invoicesOut.total,
			lineItems: schema.invoicesOut.lineItems,
			customerName: schema.customers.name,
			customerId: schema.invoicesOut.customerId
		})
		.from(schema.invoicesOut)
		.leftJoin(schema.customers, eq(schema.invoicesOut.customerId, schema.customers.id))
		.where(eq(schema.invoicesOut.id, params.id))
		.limit(1);
	if (!invoice) {
		return fail('Invoice not found', 404);
	}

	if (uploadedKey) {
		if (!(await objectExists(platform.env, uploadedKey))) {
			return fail('Uploaded PDF not found in storage', 404);
		}
		await db
			.update(schema.invoicesOut)
			.set({ pdfUrl: uploadedKey, status: 'issued', updatedAt: new Date().toISOString() })
			.where(eq(schema.invoicesOut.id, invoice.id));
		return ok({ id: invoice.id, pdfUrl: uploadedKey });
	}

	const parsed = parseStoredInvoiceLineItems(invoice.lineItems);
	const pdfBytes = buildSimpleInvoicePdf({
		invoiceNo: invoice.invoiceNo,
		date: invoice.date,
		dueDate: invoice.dueDate,
		currency: invoice.currency,
		customerName: invoice.customerName ?? invoice.customerId,
		total: invoice.total,
		lines: parsed.lines
	});

	const key = `invoices/out/${invoice.id}.pdf`;
	await platform.env.R2.put(key, pdfBytes, {
		httpMetadata: { contentType: 'application/pdf' }
	});

	await db
		.update(schema.invoicesOut)
		.set({ pdfUrl: key, status: 'issued', updatedAt: new Date().toISOString() })
		.where(eq(schema.invoicesOut.id, invoice.id));

	return ok({ id: invoice.id, pdfUrl: key });
};

async function requestJsonSafe(request: Request): Promise<unknown> {
	try {
		return await request.json();
	} catch {
		return null;
	}
}
