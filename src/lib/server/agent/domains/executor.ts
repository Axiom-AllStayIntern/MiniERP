import type { DomainAgentDef, RouterResult, DomainResult, AgentAction, QueryContext, ChatHistoryMessage } from '../types';
import { callAiJsonWithSource } from '$lib/server/services/ai-agent';
import { executeQuery, resolveProjectIdByName } from '../query-handlers';

export async function executeDomainAgent(
	env: Env,
	domain: DomainAgentDef,
	routerResult: RouterResult,
	userRole: string,
	queryCtx?: QueryContext,
	history?: ChatHistoryMessage[]
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

	const isQueryIntent = routerResult.intent_type === 'query';
	const systemPrompt = buildSystemPromptForIntent(domain, isQueryIntent, !!history?.length);

	const historySection = formatHistory(history);
	const userPrompt = `${historySection}User message: ${routerResult.raw_message}
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

	const prefill =
		parsed?.prefill && typeof parsed.prefill === 'object' && !Array.isArray(parsed.prefill)
			? (parsed.prefill as Record<string, unknown>)
			: {};

	// For query intent, try to execute the query directly
	if (isQueryIntent && matchedAction?.api && queryCtx) {
		const queryParams = {
			...prefill,
			project_id: prefill.project_id ?? routerResult.context.project_id,
			project_name: prefill.project_name ?? routerResult.context.project_name
		};

		const queryResult = await executeQuery(queryCtx, matchedAction.id, queryParams);

		if (queryResult.success && queryResult.data) {
			const baseReply =
				typeof parsed?.reply === 'string' && parsed.reply.trim()
					? parsed.reply.trim()
					: '查询结果如下：';

			return {
				reply: baseReply,
				action: null,
				prefill: {},
				data: queryResult.data,
				missing_context: []
			};
		}

		if (!queryResult.success) {
			const missingCtx = queryResult.error?.includes('项目 ID')
				? ['project_id']
				: [];

			const fallbackEntry = matchedAction
				? await resolveEntryPlaceholdersAsync(matchedAction.entry, prefill, routerResult.context, queryCtx)
				: null;

			return {
				reply: queryResult.error ?? '查询失败，请稍后重试。',
				action: matchedAction && fallbackEntry
					? { id: matchedAction.id, entry: fallbackEntry, layer: matchedAction.layer }
					: null,
				prefill,
				missing_context: missingCtx
			};
		}
	}

	let resolvedEntry: string | null = null;

	if (matchedAction) {
		resolvedEntry = await resolveEntryPlaceholdersAsync(
			matchedAction.entry,
			prefill,
			routerResult.context,
			queryCtx
		);
	}

	const missingContext = Array.isArray(parsed?.missing_context)
		? (parsed.missing_context as string[]).filter((x) => typeof x === 'string')
		: [];

	// If we have a matched action but couldn't resolve the entry, add missing context
	if (matchedAction && !resolvedEntry && matchedAction.entry.includes('[id]')) {
		if (!missingContext.includes('project_id')) {
			missingContext.push('project_id');
		}
	}

	let reply =
		typeof parsed?.reply === 'string' && parsed.reply.trim()
			? parsed.reply.trim()
			: '我理解了你的需求，请查看下方操作。';

	// If action couldn't be resolved due to missing project, add helpful message
	if (matchedAction && !resolvedEntry) {
		reply = '请告诉我具体是哪个项目？或者先进入项目详情页后再操作。';
	}

	return {
		reply,
		action: matchedAction && resolvedEntry
			? { id: matchedAction.id, entry: resolvedEntry, layer: matchedAction.layer }
			: null,
		prefill,
		data: parsed?.data ?? undefined,
		missing_context: missingContext
	};
}

async function resolveEntryPlaceholdersAsync(
	entry: string,
	prefill: Record<string, unknown>,
	context: RouterResult['context'],
	queryCtx?: QueryContext
): Promise<string | null> {
	let resolved = entry;

	// Replace [id] with project_id from prefill, context, or by resolving project_name
	if (resolved.includes('[id]')) {
		let projectId = (prefill.project_id ?? context.project_id) as string | undefined;

		// If no project_id but we have project_name, try to resolve it
		if (!projectId && typeof prefill.project_name === 'string' && queryCtx) {
			projectId = (await resolveProjectIdByName(queryCtx, prefill.project_name)) ?? undefined;
		}

		if (typeof projectId === 'string' && projectId) {
			resolved = resolved.replace('[id]', projectId);
		} else {
			return null;
		}
	}

	// Replace other common placeholders
	const placeholders: Record<string, string | undefined> = {
		'[projectId]': (prefill.project_id ?? context.project_id) as string | undefined,
		'[employeeId]': prefill.employee_id as string | undefined,
		'[invoiceId]': prefill.invoice_id as string | undefined,
		'[expenseId]': prefill.expense_id as string | undefined
	};

	for (const [placeholder, value] of Object.entries(placeholders)) {
		if (resolved.includes(placeholder)) {
			if (typeof value === 'string' && value) {
				resolved = resolved.replace(placeholder, value);
			} else {
				return null;
			}
		}
	}

	return resolved;
}

function formatHistory(history?: ChatHistoryMessage[]): string {
	if (!history?.length) return '';

	const formatted = history
		.map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
		.join('\n');

	return `Previous conversation:
${formatted}

---
Current follow-up:
`;
}

function buildSystemPromptForIntent(domain: DomainAgentDef, isQuery: boolean, hasHistory: boolean): string {
	const basePrompt = domain.buildSystemPrompt();
	let additional = '';

	if (hasHistory) {
		additional += `

IMPORTANT - Follow-up Context:
- The user is continuing a previous conversation
- "Previous conversation" section contains the chat history
- Extract any missing parameters from the conversation history
- If you previously asked for information and the user is now providing it, use that to complete the action`;
	}

	if (isQuery) {
		additional += `

IMPORTANT for QUERY intent:
- The user is asking a question and wants data, not navigation
- You MUST identify which action's API can answer this query
- Extract all relevant parameters (especially project_id, project_name) into prefill
- If project context is available, use it to fill project_id
- If user mentions a project by name, extract it to project_name in prefill`;
	}

	return basePrompt + additional;
}
