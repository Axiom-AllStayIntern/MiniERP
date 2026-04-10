import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { getActionById, getActionsForRole } from '$lib/server/agent/registry';
import { callAiJsonWithSource } from '$lib/server/services/ai-agent';
import type { AgentAction, AgentContext, AgentIntentResult } from '$lib/server/agent/types';

type IntentRequest = {
	message: string;
	context?: AgentContext;
};

function fallbackResult(reply: string): AgentIntentResult {
	return {
		matched_action_id: null,
		confidence: 0,
		reply,
		prefill: {},
		missing_context: []
	};
}

function sanitizeResult(raw: Partial<AgentIntentResult> | null): AgentIntentResult {
	const confidence = Number.isFinite(raw?.confidence) ? Number(raw?.confidence) : 0;
	return {
		matched_action_id: typeof raw?.matched_action_id === 'string' ? raw.matched_action_id : null,
		confidence: Math.min(1, Math.max(0, confidence)),
		reply: typeof raw?.reply === 'string' && raw.reply.trim() ? raw.reply.trim() : '我理解了你的需求。',
		prefill:
			raw?.prefill && typeof raw.prefill === 'object' && !Array.isArray(raw.prefill)
				? (raw.prefill as Record<string, unknown>)
				: {},
		missing_context: Array.isArray(raw?.missing_context)
			? raw.missing_context.filter((x): x is string => typeof x === 'string')
			: []
	};
}

function buildPrompt(message: string, context: AgentContext, actions: AgentAction[]): string {
	const slim = actions.map(({ id, description, keywords, layer, params }) => ({
		id,
		description,
		keywords,
		layer,
		params
	}));

	return `
用户当前页面路径：${context.currentPath}
${context.project_id ? `当前项目 ID：${context.project_id}，项目名：${context.project_name ?? ''}` : ''}
用户输入：${message}

系统支持的操作：
${JSON.stringify(slim, null, 2)}

请严格返回 JSON，不要 markdown：
{
  "matched_action_id": "最匹配的 action id，完全不匹配则为 null",
  "confidence": 0到1之间的数字,
  "reply": "用中文回复用户，说明你理解的意图和下一步",
  "prefill": { "project_id": "如果能从上下文推断则填入，否则省略" },
  "missing_context": ["如果有必填参数无法推断，列出来"]
}
`.trim();
}

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const body = (await request.json()) as IntentRequest;
	const message = body.message?.trim();
	if (!message) {
		return json({ error: 'message is required' }, { status: 400 });
	}

	const context: AgentContext = {
		currentPath: body.context?.currentPath ?? '/',
		...body.context,
		user_role: locals.user.role
	};

	const availableActions = getActionsForRole(locals.user.role);
	if (!platform) {
		return json(fallbackResult('AI 服务暂时不可用，请稍后再试。'), { status: 503 });
	}

	let parsedUnknown: unknown = null;
	try {
		const aiResult = await callAiJsonWithSource(platform.env, {
			system: '你是 SmartFin ERP 系统助手。只返回 JSON，不要任何其他内容，不要 markdown 代码块。',
			user: buildPrompt(message, context, availableActions),
			promptVersion: 'agent-intent-v1'
		});
		parsedUnknown = aiResult.json;
	} catch {
		return json(fallbackResult('AI 服务暂时不可用，请稍后重试。'));
	}

	if (!parsedUnknown || typeof parsedUnknown !== 'object' || Array.isArray(parsedUnknown)) {
		return json(fallbackResult('AI 服务暂时不可用，请稍后重试。'));
	}

	const parsed = sanitizeResult(parsedUnknown as Partial<AgentIntentResult>);
	if (!parsed.reply) {
		return json(fallbackResult('我没有理解你的意思，能换个方式说吗？'));
	}

	if (parsed.confidence < 0.5) {
		return json({ ...parsed, matched_action_id: null, action: null });
	}

	const action = parsed.matched_action_id ? getActionById(parsed.matched_action_id) : undefined;
	if (!action) {
		return json({ ...parsed, action: null });
	}

	if (!action.required_roles.includes(locals.user.role)) {
		return json({
			...fallbackResult('你当前账号没有权限执行这个操作。'),
			confidence: parsed.confidence,
			action: null
		});
	}

	return json({ ...parsed, action });
};
