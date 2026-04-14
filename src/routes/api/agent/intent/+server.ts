import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { AgentContext, DomainResult } from '$lib/server/agent/types';
import { routeIntent } from '$lib/server/agent/router';
import { getDomainAgent } from '$lib/server/agent/domains/registry';
import { executeDomainAgent } from '$lib/server/agent/domains/executor';

type IntentRequest = {
	message: string;
	context?: Partial<AgentContext>;
};

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const body = (await request.json()) as IntentRequest;
	const message = body.message?.trim();
	if (!message) {
		return json({ error: 'message is required' }, { status: 400 });
	}

	if (!platform) {
		return json(
			{
				reply: 'AI 服务暂时不可用，请稍后再试。',
				action: null,
				prefill: {},
				missing_context: []
			} satisfies DomainResult,
			{ status: 503 }
		);
	}

	const context: AgentContext = {
		currentPath: body.context?.currentPath ?? '/',
		...body.context,
		user_role: locals.user.role
	};

	const routerResult = await routeIntent(platform.env, message, context);

	if (!routerResult.domain || routerResult.confidence < 0.4) {
		return json({
			reply:
				routerResult.intent_type === 'chat'
					? '你好！我是 SmartFin 助手，可以帮你创建项目、管理发票、查看报表等。请告诉我你想做什么？'
					: '我不太确定你想操作哪个模块，能再说详细一些吗？',
			action: null,
			prefill: {},
			missing_context: []
		} satisfies DomainResult);
	}

	const domain = getDomainAgent(routerResult.domain);
	if (!domain) {
		return json({
			reply: '该功能模块暂未启用。',
			action: null,
			prefill: {},
			missing_context: []
		} satisfies DomainResult);
	}

	try {
		const domainResult = await executeDomainAgent(
			platform.env,
			domain,
			routerResult,
			locals.user.role
		);

		return json(domainResult);
	} catch {
		return json({
			reply: 'AI 服务暂时不可用，请稍后重试。',
			action: null,
			prefill: {},
			missing_context: []
		} satisfies DomainResult);
	}
};
