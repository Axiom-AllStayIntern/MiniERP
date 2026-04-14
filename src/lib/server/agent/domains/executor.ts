import type { DomainAgentDef, RouterResult, DomainResult, AgentAction } from '../types';
import { callAiJsonWithSource } from '$lib/server/services/ai-agent';

export async function executeDomainAgent(
	env: Env,
	domain: DomainAgentDef,
	routerResult: RouterResult,
	userRole: string
): Promise<DomainResult> {
	const availableActions = domain.actions.filter((a) =>
		a.required_roles.includes(userRole as AgentAction['required_roles'][number])
	);

	if (availableActions.length === 0) {
		return {
			reply: '你当前没有权限操作此模块的功能。',
			action: null,
			prefill: {},
			missing_context: []
		};
	}

	const systemPrompt = domain.buildSystemPrompt();

	const userPrompt = `User message: ${routerResult.raw_message}
Intent type: ${routerResult.intent_type}
Current page: ${routerResult.context.currentPath}
${routerResult.context.project_id ? `Current project ID: ${routerResult.context.project_id}, project name: ${routerResult.context.project_name ?? ''}` : ''}
User role: ${routerResult.context.user_role ?? ''}`;

	const aiResult = await callAiJsonWithSource(env, {
		system: systemPrompt,
		user: userPrompt,
		promptVersion: `domain-${domain.descriptor.id}-v1`
	});

	const parsed = aiResult.json as Record<string, unknown> | null;

	const actionId = typeof parsed?.matched_action_id === 'string' ? parsed.matched_action_id : null;
	const matchedAction = actionId ? availableActions.find((a) => a.id === actionId) : null;

	return {
		reply:
			typeof parsed?.reply === 'string' && parsed.reply.trim()
				? parsed.reply.trim()
				: '我理解了你的需求，请查看下方操作。',
		action: matchedAction
			? { id: matchedAction.id, entry: matchedAction.entry, layer: matchedAction.layer }
			: null,
		prefill:
			parsed?.prefill && typeof parsed.prefill === 'object' && !Array.isArray(parsed.prefill)
				? (parsed.prefill as Record<string, unknown>)
				: {},
		data: parsed?.data ?? undefined,
		missing_context: Array.isArray(parsed?.missing_context)
			? (parsed.missing_context as string[]).filter((x) => typeof x === 'string')
			: []
	};
}
