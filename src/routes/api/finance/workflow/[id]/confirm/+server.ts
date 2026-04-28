import type { RequestHandler } from './$types';

import { fail } from '$lib/server/http';
import { getDb } from '../../../../../../infrastructure/db';
import { financeAgentManifest } from '../../../../../../modules/finance/agent';
import { getState } from '../../../../../../platform/workflow/workflow-runtime';
import { appendAgentAuditEntry } from '../../../../../../platform/audit/audit-log';

/**
 * Stage 3: stubbed gate. Validates the workflow exists and is at the
 * `user_confirmation` step, then refuses with 501 to prove the route + policy
 * gate are wired before Stage 5 connects the real expense write.
 */
export const POST: RequestHandler = async (event) => {
	if (!event.platform) return fail('Cloudflare platform bindings are required', 500);
	const user = event.locals.user;
	if (!user) return fail('Unauthorized', 401);

	const id = event.params.id;
	if (!id) return fail('Workflow id is required', 400);

	const env = event.platform.env;
	const db = getDb(env);
	const state = await getState(env.KV, id);
	if (!state) return fail('Workflow not found', 404);
	if (state.status !== 'active') return fail(`Workflow is ${state.status}`, 409);
	if (state.step !== 'user_confirmation') {
		return fail(
			`Confirmation only valid at step 'user_confirmation'. Current: ${state.step}.`,
			409
		);
	}

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
		finalAction: 'agent.confirm_not_implemented',
		status: 'failed',
		errorCode: 'stage3_stub'
	});

	return fail('Confirmation flow lands in Stage 5.', 501);
};
