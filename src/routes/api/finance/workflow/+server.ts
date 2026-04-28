import type { RequestHandler } from './$types';

import { fail, ok } from '$lib/server/http';
import { financeAgentManifest } from '../../../../modules/finance/agent';
import { vendorInvoiceIntakeWorkflow } from '../../../../modules/finance/workflows/vendor-invoice-intake';
import { startWorkflow } from '../../../../platform/workflow/workflow-runtime';
import { appendAgentAuditEntry } from '../../../../platform/audit/audit-log';
import { getDb } from '../../../../infrastructure/db';

interface StartBody {
	workflowId?: string;
	intentHint?: string;
	tenantId?: string;
	source?: 'quick_action' | 'today_brief' | 'main_app' | 'agent_intent';
}

export const POST: RequestHandler = async (event) => {
	if (!event.platform) return fail('Cloudflare platform bindings are required', 500);
	const user = event.locals.user;
	if (!user) return fail('Unauthorized', 401);

	const body = (await event.request.json().catch(() => null)) as StartBody | null;
	if (!body) return fail('Invalid JSON body', 400);

	if (body.workflowId !== vendorInvoiceIntakeWorkflow.id) {
		return fail(
			`Unsupported workflowId: ${body.workflowId}. Phase 1 supports only ${vendorInvoiceIntakeWorkflow.id}.`,
			400
		);
	}

	const tenantId = body.tenantId ?? 'default';
	const env = event.platform.env;
	const state = await startWorkflow(env.KV, {
		workflowId: vendorInvoiceIntakeWorkflow.id,
		agentId: financeAgentManifest.id,
		initialStep: vendorInvoiceIntakeWorkflow.initialStep,
		userId: user.id,
		tenantId,
		data: { source: body.source, intentHint: body.intentHint }
	});

	await appendAgentAuditEntry(getDb(env), {
		agentId: financeAgentManifest.id,
		agentVersion: financeAgentManifest.version,
		userId: user.id,
		userEmail: user.email,
		tenantId,
		workflowId: state.id,
		workflowStep: state.step,
		riskLevel: 'R0',
		permissionResult: 'allowed',
		confirmationRequired: false,
		finalAction: 'agent.workflow_started',
		status: 'ok'
	});

	return ok(
		{
			workflowId: state.id,
			currentStep: state.step,
			status: state.status
		},
		201
	);
};
