import type { RequestHandler } from './$types';

import { fail, ok } from '$lib/server/http';
import {
	classifyFinanceIntent,
	financeAgentManifest,
	financeAgentRefusalCopy,
	isForbiddenAction,
	type ClassifyFinanceIntentInput,
	type FinanceIntent
} from '../../../../../modules/finance/agent';
import { appendAgentAuditEntry } from '../../../../../platform/audit/audit-log';
import { getDb } from '../../../../../infrastructure/db';

interface IntentBody extends ClassifyFinanceIntentInput {
	forbiddenActionProbe?: string;
}

export const POST: RequestHandler = async (event) => {
	if (!event.platform) return fail('Cloudflare platform bindings are required', 500);
	const user = event.locals.user;
	if (!user) return fail('Unauthorized', 401);

	const body = (await event.request.json().catch(() => null)) as IntentBody | null;
	if (!body) return fail('Invalid JSON body', 400);

	const db = getDb(event.platform.env);

	if (body.forbiddenActionProbe && isForbiddenAction(body.forbiddenActionProbe)) {
		await appendAgentAuditEntry(db, {
			agentId: financeAgentManifest.id,
			agentVersion: financeAgentManifest.version,
			userId: user.id,
			userEmail: user.email,
			intent: 'unknown',
			riskLevel: 'R5',
			permissionResult: 'denied',
			confirmationRequired: false,
			finalAction: 'agent.refused_action',
			status: 'denied',
			errorCode: `forbidden:${body.forbiddenActionProbe}`
		});
		return ok({
			intent: 'unknown' as FinanceIntent,
			refused: true,
			refusalMessage: financeAgentRefusalCopy[body.forbiddenActionProbe]
		});
	}

	const result = classifyFinanceIntent({
		message: body.message,
		intentHint: body.intentHint,
		currentPath: body.currentPath
	});

	return ok({
		intent: result.intent,
		confidence: result.confidence,
		reason: result.reason,
		requiredInputs: result.requiredInputs,
		suggestedWorkflow: result.suggestedWorkflow,
		riskLevel: result.riskLevel
	});
};
