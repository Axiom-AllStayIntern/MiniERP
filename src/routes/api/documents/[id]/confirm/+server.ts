import type { RequestHandler } from './$types';

import { fail, ok } from '$platform/http';
import { hashConfirmationPayload } from '$platform/workflow/payload-hash';
import { createModuleContext } from '$platform/modules';
import { getDb } from '../../../../../infrastructure/db';
import { createDocumentIntakeService } from '$modules/document-intake';
import {
	createFinanceApi,
	findCategoryById,
	financeAgentManifest,
	financeRules,
	type CategoryDefinition
} from '$modules/finance';
import { appendAgentAuditEntry } from '$platform/audit/audit-log';

const { validateExpenseRecord } = financeRules;

/**
 * POST /api/documents/[id]/confirm
 *
 * Inbox-flow confirmation endpoint (Ship 2). User has reviewed the
 * `suggestedFields` (or edited them) on the artifact and clicks Confirm.
 * Persists to the appropriate finance entity (expenses / revenue / archive)
 * based on the resolved category's `persistTarget`, writes an audit entry,
 * and marks the artifact `confirmed` so it leaves the active inbox.
 *
 * Why this is separate from /api/finance/workflow/[id]/confirm:
 *  - The legacy workflow confirm operates on a KV-backed workflow state
 *    machine (BucketStep / KindStep / ConfirmStep flow). It expects the
 *    workflow to exist at step `user_confirmation`.
 *  - The inbox flow has no workflow state — only the artifact. The user
 *    can confirm directly from the inbox (or AI Panel inbox layer) without
 *    spinning up a workflow. This route bridges the artifact directly to
 *    finance persistence.
 *
 * Request body (JSON):
 *  - `payload.documentId` (required): must match :id
 *  - `payload.categoryId` (required): the category the user confirmed; pinned
 *  - `payload.fields` (required): final field values (potentially edited)
 *  - `payload.supplierId` / `poId` / `projectId` (optional): user-attached
 *    business links
 *  - `payloadHash` (required): sha-256 of the canonical payload (tamper guard)
 */

interface ConfirmedFields {
	documentNumber: string;
	counterpartyName: string;
	currency: string;
	totalAmount: number;
	gstAmount: number;
	issueDate: string;
	dueDate: string;
}

interface ConfirmedPayload {
	documentId: string;
	categoryId: string;
	supplierId?: string | null;
	poId?: string | null;
	projectId?: string | null;
	fields: ConfirmedFields;
}

interface ConfirmBody {
	payload: ConfirmedPayload;
	payloadHash: string;
}

function buildExpenseInput(payload: ConfirmedPayload, category: CategoryDefinition) {
	const expenseType = category.expenseType ?? 'opex';
	const cat = category.category ?? 'others';
	return {
		expenseType,
		category: cat,
		amount: payload.fields.totalAmount,
		currency: payload.fields.currency,
		date: payload.fields.issueDate,
		vendorOrSupplier: payload.fields.counterpartyName,
		notes: `Recorded via inbox · ${category.label} · ${payload.fields.documentNumber}${payload.poId ? ` · po=${payload.poId}` : ''}`
	} as const;
}

function buildRevenueInput(payload: ConfirmedPayload) {
	return {
		projectId: payload.projectId ?? null,
		invoiceType: 'tax_invoice' as const,
		invoiceNumber: payload.fields.documentNumber,
		clientName: payload.fields.counterpartyName,
		date: payload.fields.issueDate,
		amount: payload.fields.totalAmount,
		currency: payload.fields.currency,
		gstAmount: payload.fields.gstAmount,
		notes: `Recorded via inbox · invoice ${payload.fields.documentNumber}`
	};
}

export const POST: RequestHandler = async (event) => {
	if (!event.platform) return fail('Cloudflare platform bindings are required', 500);
	const user = event.locals.user;
	if (!user) return fail('Unauthorized', 401);

	const id = event.params.id;
	if (!id) return fail('Document id is required', 400);

	const env = event.platform.env;
	const db = getDb(env);

	const body = (await event.request.json().catch(() => null)) as ConfirmBody | null;
	if (!body?.payload || !body?.payloadHash) {
		return fail('payload and payloadHash are required', 400);
	}
	if (body.payload.documentId !== id) {
		return fail('payload.documentId does not match URL :id', 400);
	}

	// 1. Hash check (tamper guard).
	const recomputedHash = await hashConfirmationPayload(body.payload);
	if (recomputedHash !== body.payloadHash) {
		await appendAgentAuditEntry(db, {
			agentId: financeAgentManifest.id,
			agentVersion: financeAgentManifest.version,
			userId: user.id,
			userEmail: user.email,
			tenantId: 'default',
			workflowId: id,
			workflowStep: 'inbox_confirm',
			toolId: 'finance.create-expense-record',
			riskLevel: 'R4',
			permissionResult: 'allowed',
			confirmationRequired: true,
			confirmationRef: body.payloadHash,
			finalAction: 'inbox.confirmation_failed',
			status: 'failed',
			errorCode: 'payload_hash_mismatch'
		});
		return fail('Payload hash mismatch — UI state and submission do not agree.', 400);
	}

	// 2. Verify artifact exists and is in a confirmable state.
	const intake = createDocumentIntakeService({ db, env, user });
	const artifact = await intake.getDocumentArtifact({ tenantId: 'default', documentId: id });
	if (!artifact) return fail('Document artifact not found', 404);
	if (
		artifact.processingStatus !== 'ready_for_review' &&
		artifact.processingStatus !== 'ready_for_workflow'
	) {
		return fail(
			`Artifact is in '${artifact.processingStatus}' state; only ready_for_review can be confirmed.`,
			409
		);
	}

	// 3. Resolve category (must be pinned by caller).
	const category = findCategoryById(body.payload.categoryId);
	if (!category) {
		return fail(`Unknown categoryId: ${body.payload.categoryId}`, 400);
	}

	// 4. Branch persistence by category.persistTarget.
	const ctx = await createModuleContext(event);
	const finance = createFinanceApi(ctx);

	let entityId: string;
	let entityRoute: string;
	let entityType: string;
	let toolId: string;
	let finalAction: string;

	if (category.persistTarget === 'expenses') {
		const expenseInput = buildExpenseInput(body.payload, category);
		const validation = validateExpenseRecord(expenseInput);
		if (!validation.success) {
			const issues = validation.error.issues.map((issue) => ({
				field: issue.path.join('.') || '<root>',
				message: issue.message
			}));
			await appendAgentAuditEntry(db, {
				agentId: financeAgentManifest.id,
				agentVersion: financeAgentManifest.version,
				userId: user.id,
				userEmail: user.email,
				tenantId: 'default',
				workflowId: id,
				workflowStep: 'inbox_confirm',
				toolId: 'finance.validate-expense-draft',
				riskLevel: 'R2',
				permissionResult: 'allowed',
				confirmationRequired: true,
				confirmationRef: recomputedHash,
				outputRefs: { issues, categoryId: category.id },
				finalAction: 'inbox.validation_failed',
				status: 'failed',
				errorCode: 'validation_failed'
			});
			return fail('Validation failed', 400, { issues });
		}
		const created = await finance.expenses.createStandaloneExpense(expenseInput);
		entityId = created.id;
		entityType = 'expense';
		entityRoute = '/finance/expenses';
		toolId = 'finance.create-expense-record';
		finalAction = `expense.created.${category.expenseType}.${category.category}`;
	} else if (category.persistTarget === 'revenue') {
		const created = await finance.revenue.createRevenue(buildRevenueInput(body.payload));
		entityId = created.id;
		entityType = 'revenue';
		entityRoute = '/finance/doc-hub/customer-invoices';
		toolId = 'finance.create-revenue-record';
		finalAction = 'revenue.created';
	} else {
		// Archive categories (contracts/quotations/POs). Persistence to those
		// tables lands in a follow-up — the artifact stays in inbox until we
		// wire the project-side write path.
		await appendAgentAuditEntry(db, {
			agentId: financeAgentManifest.id,
			agentVersion: financeAgentManifest.version,
			userId: user.id,
			userEmail: user.email,
			tenantId: 'default',
			workflowId: id,
			workflowStep: 'inbox_confirm',
			toolId: 'finance.create-document-archive',
			riskLevel: 'R4',
			permissionResult: 'allowed',
			confirmationRequired: true,
			confirmationRef: recomputedHash,
			outputRefs: { categoryId: category.id, persistTarget: category.persistTarget },
			finalAction: 'inbox.archive_persist_not_implemented',
			status: 'failed',
			errorCode: 'archive_persist_not_implemented'
		});
		return fail(
			`Archive persistence (${category.persistTarget}) lands in a follow-up. Use the project-side flow for now.`,
			501
		);
	}

	// 5. Audit success.
	const audit = await appendAgentAuditEntry(db, {
		agentId: financeAgentManifest.id,
		agentVersion: financeAgentManifest.version,
		userId: user.id,
		userEmail: user.email,
		tenantId: 'default',
		workflowId: id,
		workflowStep: 'inbox_confirm',
		toolId,
		riskLevel: 'R4',
		permissionResult: 'allowed',
		confirmationRequired: true,
		confirmationRef: recomputedHash,
		modelId: 'inbox-confirm-v1',
		promptVersion: 'inbox-confirm-v1',
		schemaVersion: 'v1',
		outputRefs: {
			entityType,
			entityId,
			categoryId: category.id
		},
		finalAction,
		status: 'ok'
	});

	// 6. Mark artifact confirmed (drops it out of inbox listing).
	await intake.markConfirmed({
		tenantId: 'default',
		documentId: id,
		entityType,
		entityId,
		categoryId: category.id
	});

	return ok({
		entityId,
		auditRef: audit.auditId,
		entityRoute,
		categoryId: category.id
	});
};
