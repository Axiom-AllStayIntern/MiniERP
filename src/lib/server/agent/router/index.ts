import type { AgentContext, RouterResult } from '../types';
import { matchByRules } from './rule-engine';
import { routeByLlm } from './llm-router';

export async function routeIntent(
	env: Env,
	message: string,
	context: AgentContext
): Promise<RouterResult> {
	const ruleResult = matchByRules(message, context);
	if (ruleResult && ruleResult.confidence >= 0.7) {
		return ruleResult;
	}

	const llmResult = await routeByLlm(env, message, context);

	if (ruleResult && ruleResult.confidence > llmResult.confidence) {
		return ruleResult;
	}

	return llmResult;
}
