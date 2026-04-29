import type { RequestHandler } from './$types';

import { fail, ok } from '$lib/server/http';
import { hashConfirmationPayload } from '$lib/workflow/payload-hash';
import { createModuleContext } from '$lib/server/modules';
import { getDb } from '../../../../../../infrastructure/db';
import { financeAgentManifest } from '../../../../../../modules/finance/agent';
import { suggestNextFinanceTaskCapability } from '../../../../../../modules/finance/capabilities/suggest-next-task';
import { validateExpenseRecord } from '../../../../../../modules/finance/rules/validate-expense';
import { createFinanceApi } from '../../../../../../modules/finance/services/api';
import { appendAgentAuditEntry } from '../../../../../../platform/audit/audit-log';
import {
	getState,
	patchState
} from '../../../../../../platform/workflow/workflow-runtime';

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
	supplierId: string | null;
	poId: string | null;
	projectId: string | null;
	fields: ConfirmedFields;
}

interface ConfirmBody {
	payload?: ConfirmedPayload;
	payloadHash?: string;
}

function buildExpenseInput(payload: ConfirmedPayload) {
	return {
		expenseType: 'opex' as const,
		category: 'purchase',
		amount: payload.fields.totalAmount,
		currency: payload.fields.currency,
		date: payload.fields.issueDate,
		vendorOrSupplier: payload.fields.counterpartyName,
		notes: `Recorded via Finance Agent · invoice ${payload.fields.documentNumber}${payload.poId ? ` · po=${payload.poId}` : ''}`
	};
}

export const POST: RequestHandler = async (event) => {
	if (!event.platform) return fail('Cloudflare platform bindings are required', 500);
	const user = event.locals.user;
	if (!user) return fail('Unauthorized', 401);

	const id = event.params.id;
	if (!id) return fail('Workflow id is required', 400);

	const env = event.platform.env;
	const db = getDb(env);

	const body = (await event.request.json().catch(() => null)) as ConfirmBody | null;
	if (!body?.payload || !body.payloadHash) {
		return fail('payload and payloadHash are required', 400);
	}

	const state = await getState(env.KV, id);
	if (!state) return fail('Workflow not found', 404);
	if (state.status !== 'active') return fail(`Workflow is ${state.status}`, 409);
	if (state.step !== 'user_confirmation') {
		return fail(
			`Confirmation only valid at step 'user_confirmation'. Current: ${state.step}.`,
			409
		);
	}

	const recomputedHash = await hashConfirmationPayload(body.payload);
	if (recomputedHash !== body.payloadHash) {
		await appendAgentAuditEntry(db, {
			agentId: financeAgentManifest.id,
			agentVersion: financeAgentManifest.version,
			userId: user.id,
			userEmail: user.email,
			tenantId: state.tenantId,
			workflowId: state.id,
			workflowStep: state.step,
			toolId: 'finance.create-expense-record',
			riskLevel: 'R4',
			permissionResult: 'allowed',
			confirmationRequired: true,
			confirmationRef: body.payloadHash,
			finalAction: 'agent.confirmation_failed',
			status: 'failed',
			errorCode: 'payload_hash_mismatch'
		});
		return fail('Payload hash mismatch — UI state and submission do not agree.', 400);
	}

	const expenseInput = buildExpenseInput(body.payload);

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
			tenantId: state.tenantId,
			workflowId: state.id,
			workflowStep: state.step,
			toolId: 'finance.validate-expense-draft',
			riskLevel: 'R2',
			permissionResult: 'allowed',
			confirmationRequired: true,
			confirmationRef: recomputedHash,
			outputRefs: { issues },
			finalAction: 'agent.validation_failed',
			status: 'failed',
			errorCode: 'validation_failed'
		});
		return fail('Validation failed', 400, { issues });
	}

	const ctx = await createModuleContext(event);
	const finance = createFinanceApi(ctx);
	const created = await finance.expenses.createStandaloneExpense(expenseInput);

	const audit = await appendAgentAuditEntry(db, {
		agentId: financeAgentManifest.id,
		agentVersion: financeAgentManifest.version,
		userId: user.id,
		userEmail: user.email,
		tenantId: state.tenantId,
		workflowId: state.id,
		workflowStep: 'record_creation',
		toolId: 'finance.create-expense-record',
		riskLevel: 'R4',
		permissionResult: 'allowed',
		confirmationRequired: true,
		confirmationRef: recomputedHash,
		modelId: 'mock-v1',
		promptVersion: 'mock-v1',
		schemaVersion: 'v1',
		outputRefs: { entityType: 'expense', entityId: created.id },
		finalAction: 'expense.created',
		status: 'ok'
	});

	const suggestion = await suggestNextFinanceTaskCapability.execute(
		{
			afterWorkflowId: state.workflowId,
			afterSupplierName: body.payload.fields.counterpartyName
		},
		{ tenantId: state.tenantId, userId: state.userId, useMock: true }
	);

	await patchState(env.KV, state.id, {
		step: 'completion',
		status: 'completed',
		confirmationRef: recomputedHash,
		dataPatch: {
			confirmation: {
				entityId: created.id,
				auditRef: audit.auditId,
				confirmedAt: Date.now()
			},
			nextTask: suggestion.task
		}
	});

	return ok({
		entityId: created.id,
		auditRef: audit.auditId,
		entityRoute: '/expenses',
		nextTask: suggestion.task
	});
};
