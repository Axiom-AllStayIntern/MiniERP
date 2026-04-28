import type { RequestHandler } from './$types';

import { fail, ok } from '$lib/server/http';
import { getDb, type DBClient } from '../../../../../../infrastructure/db';
import { financeAgentManifest } from '../../../../../../modules/finance/agent';
import {
	findVendorInvoiceIntakeStep,
	runFieldExtractionStep,
	runMatchingStep,
	type DocumentIntakeOutput,
	type ExtractedInvoiceFields,
	type VendorInvoiceIntakeStepId
} from '../../../../../../modules/finance/workflows/vendor-invoice-intake';
import { appendAgentAuditEntry } from '../../../../../../platform/audit/audit-log';
import { checkToolPolicy } from '../../../../../../platform/ai/tool-policy';
import {
	getState,
	patchState,
	type WorkflowStateRecord
} from '../../../../../../platform/workflow/workflow-runtime';

interface AdvanceBody {
	targetStep: VendorInvoiceIntakeStepId;
	payload?: {
		documentId?: string;
		fileName?: string;
	};
}

interface PolicyGateOk {
	allowed: true;
}
interface PolicyGateDenied {
	allowed: false;
	missingPermissions: string[];
	blockedBy: string[];
}

async function gateAllCapabilities(
	db: DBClient,
	state: WorkflowStateRecord,
	allowedCapabilities: readonly string[],
	user: App.Locals['user']
): Promise<PolicyGateOk | PolicyGateDenied> {
	for (const capabilityId of allowedCapabilities) {
		const decision = checkToolPolicy({
			agentId: financeAgentManifest.id,
			capabilityId,
			userRole: user?.role,
			currentStepAllowedCapabilities: allowedCapabilities
		});
		if (!decision.allowed) {
			await appendAgentAuditEntry(db, {
				agentId: financeAgentManifest.id,
				agentVersion: financeAgentManifest.version,
				userId: user?.id ?? null,
				userEmail: user?.email ?? null,
				tenantId: state.tenantId,
				workflowId: state.id,
				workflowStep: state.step,
				toolId: capabilityId,
				riskLevel: decision.riskLevel,
				permissionResult: 'denied',
				confirmationRequired: decision.requiresConfirmation,
				finalAction: 'agent.policy_denied',
				status: 'denied',
				errorCode: decision.blockedBy.join(',')
			});
			return {
				allowed: false,
				missingPermissions: decision.missingUserPermissions,
				blockedBy: decision.blockedBy
			};
		}
	}
	return { allowed: true };
}

async function auditCapabilitySuccess(
	db: DBClient,
	state: WorkflowStateRecord,
	user: App.Locals['user'],
	capabilityId: string,
	outputRefs: unknown
) {
	const decision = checkToolPolicy({
		agentId: financeAgentManifest.id,
		capabilityId,
		userRole: user?.role
	});
	await appendAgentAuditEntry(db, {
		agentId: financeAgentManifest.id,
		agentVersion: financeAgentManifest.version,
		userId: user?.id ?? null,
		userEmail: user?.email ?? null,
		tenantId: state.tenantId,
		workflowId: state.id,
		workflowStep: state.step,
		toolId: capabilityId,
		riskLevel: decision.riskLevel,
		permissionResult: 'allowed',
		confirmationRequired: decision.requiresConfirmation,
		modelId: 'mock-v1',
		promptVersion: 'mock-v1',
		schemaVersion: 'v1',
		outputRefs,
		finalAction: 'agent.capability_call',
		status: 'ok'
	});
}

export const POST: RequestHandler = async (event) => {
	if (!event.platform) return fail('Cloudflare platform bindings are required', 500);
	const user = event.locals.user;
	if (!user) return fail('Unauthorized', 401);

	const id = event.params.id;
	if (!id) return fail('Workflow id is required', 400);

	const body = (await event.request.json().catch(() => null)) as AdvanceBody | null;
	if (!body?.targetStep) return fail('targetStep is required', 400);

	const env = event.platform.env;
	const db = getDb(env);
	const state = await getState(env.KV, id);
	if (!state) return fail('Workflow not found', 404);
	if (state.status !== 'active') return fail(`Workflow is ${state.status}`, 409);

	const currentStepDef = findVendorInvoiceIntakeStep(
		state.step as VendorInvoiceIntakeStepId
	);
	if (!currentStepDef) return fail(`Unknown current step: ${state.step}`, 500);
	if (!currentStepDef.nextSteps.includes(body.targetStep)) {
		return fail(
			`Cannot advance from ${state.step} to ${body.targetStep}. Allowed: ${currentStepDef.nextSteps.join(', ') || '(none)'}.`,
			400
		);
	}
	const targetStepDef = findVendorInvoiceIntakeStep(body.targetStep);
	if (!targetStepDef) return fail(`Unknown target step: ${body.targetStep}`, 400);

	const gate = await gateAllCapabilities(
		db,
		state,
		targetStepDef.allowedCapabilities,
		user
	);
	if (!gate.allowed) {
		return fail(
			`Policy denied: ${gate.blockedBy.join(', ')}${gate.missingPermissions.length ? ` (missing ${gate.missingPermissions.join(', ')})` : ''}`,
			403
		);
	}

	const ctx = { tenantId: state.tenantId, userId: state.userId, useMock: true };

	switch (body.targetStep) {
		case 'document_intake': {
			if (!body.payload?.documentId) {
				return fail('payload.documentId is required for document_intake', 400);
			}
			const document: DocumentIntakeOutput = {
				documentId: body.payload.documentId,
				fileName: body.payload.fileName
			};
			const next = await patchState(env.KV, state.id, {
				step: body.targetStep,
				dataPatch: { document }
			});
			return ok({ currentStep: next.step, state: next });
		}

		case 'invoice_field_extraction': {
			const document = state.data.document as DocumentIntakeOutput | undefined;
			if (!document) return fail('Workflow has no document context', 400);
			const result = await runFieldExtractionStep(document, ctx);
			await auditCapabilitySuccess(db, state, user, 'finance.extract-invoice-fields', {
				confidence: result.confidence
			});
			const next = await patchState(env.KV, state.id, {
				step: body.targetStep,
				dataPatch: { extraction: result }
			});
			return ok({ currentStep: next.step, state: next });
		}

		case 'matching': {
			const extraction = state.data.extraction as
				| { fields: ExtractedInvoiceFields }
				| undefined;
			if (!extraction) return fail('Workflow has no extracted fields yet', 400);
			const result = await runMatchingStep({ fields: extraction.fields }, ctx);
			for (const capabilityId of targetStepDef.allowedCapabilities) {
				await auditCapabilitySuccess(db, state, user, capabilityId, {
					supplierTop: result.supplierCandidates[0]?.id ?? null,
					poTop: result.poCandidates[0]?.id ?? null,
					duplicate: result.duplicate.isDuplicate
				});
			}
			const next = await patchState(env.KV, state.id, {
				step: body.targetStep,
				dataPatch: { matching: result }
			});
			return ok({ currentStep: next.step, state: next });
		}

		case 'user_confirmation': {
			const next = await patchState(env.KV, state.id, { step: body.targetStep });
			return ok({ currentStep: next.step, state: next });
		}

		case 'record_creation':
		case 'completion':
			return fail(
				`Step ${body.targetStep} is not driven by /advance. Use /confirm.`,
				400
			);

		default:
			return fail(`Unsupported target step: ${body.targetStep}`, 400);
	}
};
