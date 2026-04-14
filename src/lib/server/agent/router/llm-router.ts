import type { AgentContext, RouterResult } from '../types';
import { callAiJsonWithSource } from '$lib/server/services/ai-agent';
import { domainRegistry } from '../domains/registry';

export async function routeByLlm(
	env: Env,
	message: string,
	context: AgentContext
): Promise<RouterResult> {
	const domainList = domainRegistry.map((d) => d.descriptor);

	const system = `You are the intent router for SmartFin ERP system.
Your only task is to classify which business module the user's message belongs to, and whether it's an action or a query.
Do NOT answer the user's question. Do NOT extract any fields. Only classify.
Return strict JSON without markdown.`;

	const user = `User message: ${message}
Current page: ${context.currentPath}
${context.project_id ? `Current project: ${context.project_name ?? context.project_id}` : ''}

Available modules:
${JSON.stringify(domainList, null, 2)}

Return format:
{
  "intent_type": "action or query or chat",
  "domain": "module id, or null if cannot determine",
  "confidence": 0 to 1
}`;

	const result = await callAiJsonWithSource(env, {
		system,
		user,
		promptVersion: 'router-v1'
	});

	const parsed = result.json as Partial<RouterResult> | null;

	const confidence = parsed?.confidence;

	return {
		intent_type: (parsed?.intent_type as RouterResult['intent_type']) ?? 'chat',
		domain: typeof parsed?.domain === 'string' ? parsed.domain : null,
		confidence: typeof confidence === 'number' && Number.isFinite(confidence) ? confidence : 0.3,
		raw_message: message,
		context
	};
}
