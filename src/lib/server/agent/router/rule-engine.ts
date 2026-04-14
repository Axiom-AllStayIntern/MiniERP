import type { AgentContext, RouterResult } from '../types';
import { domainRegistry } from '../domains/registry';

/**
 * 基于关键词 + 路径的规则路由
 * 返回 null 表示规则无法确定，需要 LLM 兜底
 */
export function matchByRules(message: string, context: AgentContext): RouterResult | null {
	const msgLower = message.toLowerCase();

	const pathDomain = inferDomainFromPath(context.currentPath);

	let bestMatch: { domain: string; score: number } | null = null;

	for (const domain of domainRegistry) {
		let score = 0;
		for (const kw of domain.descriptor.keywords) {
			if (msgLower.includes(kw.toLowerCase())) {
				score += kw.length;
			}
		}
		if (score > 0 && (!bestMatch || score > bestMatch.score)) {
			bestMatch = { domain: domain.descriptor.id, score };
		}
	}

	const intentType = inferIntentType(msgLower);

	if (bestMatch && bestMatch.score >= 4) {
		return {
			intent_type: intentType,
			domain: bestMatch.domain,
			confidence: Math.min(0.95, 0.6 + bestMatch.score * 0.05),
			raw_message: message,
			context
		};
	}

	if (pathDomain && intentType !== 'chat') {
		return {
			intent_type: intentType,
			domain: pathDomain,
			confidence: 0.6,
			raw_message: message,
			context
		};
	}

	return null;
}

function inferDomainFromPath(path: string): string | null {
	if (path.startsWith('/ar')) return 'ar';
	if (path.startsWith('/projects')) return 'project';
	if (path.startsWith('/expenses')) return 'expense';
	if (path.startsWith('/tax')) return 'tax';
	if (path.startsWith('/employees')) return 'employee';
	if (path.startsWith('/reports')) return 'reporting';
	return null;
}

function inferIntentType(msg: string): 'action' | 'query' | 'chat' {
	const queryPatterns = [
		'查看',
		'多少',
		'几个',
		'列表',
		'统计',
		'报表',
		'利润',
		'哪些',
		'有没有',
		'how much',
		'how many',
		'show me',
		'list',
		'what is',
		'what are',
		'查询',
		'搜索'
	];
	const actionPatterns = [
		'创建',
		'新建',
		'添加',
		'上传',
		'生成',
		'开一个',
		'录入',
		'create',
		'new',
		'add',
		'upload',
		'generate',
		'修改',
		'删除',
		'编辑'
	];

	const isQuery = queryPatterns.some((p) => msg.includes(p));
	const isAction = actionPatterns.some((p) => msg.includes(p));

	if (isAction && !isQuery) return 'action';
	if (isQuery && !isAction) return 'query';
	if (isAction && isQuery) return 'action';
	return 'chat';
}
