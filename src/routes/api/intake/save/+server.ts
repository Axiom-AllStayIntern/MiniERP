import type { RequestHandler } from './$types';

import { fail, ok } from '$platform/http';
import { createModuleContext } from '$platform/modules';
import { createDocumentIntakeApi } from '../../../../modules/document-intake';

type Bucket = 'revenue' | 'expense' | 'document_only';

type IntakePayload = {
	fileKey?: string;
	fileName?: string;
	fileType?: string;
	bucket?: Bucket;
	docType?: string;
	category?: string | null;
	expenseType?: 'opex' | 'sales_cost' | null;
	categoryDocType?: 'invoice' | 'receipt' | 'po' | null;
	fields?: Record<string, unknown>;
	projectId?: string | null;
};

export const POST: RequestHandler = async (event) => {
	const { request, platform, locals } = event;
	if (!platform) return fail('Cloudflare platform bindings are required', 500);

	const body = (await request.json()) as IntakePayload;
	const ctx = await createModuleContext(event);
	const intake = createDocumentIntakeApi(ctx);
	const result = await intake.savePanelIntake({
		...body,
		uploadedBy: locals.user?.id ?? 'system'
	});

	if (!result.ok) {
		return fail(result.message, result.status);
	}

	return ok(
		{
			entityType: result.entityType,
			entityId: result.entityId,
			documentId: result.documentId,
			message: result.message
		},
		201
	);
};

