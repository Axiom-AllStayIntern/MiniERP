export type AgentLayer = 1 | 2 | 3 | 4;

export interface AgentActionParam {
	name: string;
	type: 'string' | 'number' | 'date';
	required: boolean;
	description: string;
	extract_from_context?: boolean;
}

export interface AgentAction {
	id: string;
	module: string;
	description: string;
	keywords: string[];
	entry: string;
	api?: string;
	layer: AgentLayer;
	required_roles: Array<'owner' | 'finance' | 'project_manager' | 'employee'>;
	params?: AgentActionParam[];
}

export interface AgentContext {
	currentPath: string;
	project_id?: string;
	project_name?: string;
	user_role?: 'owner' | 'finance' | 'project_manager' | 'employee';
	[key: string]: unknown;
}

export interface AgentIntentResult {
	matched_action_id: string | null;
	confidence: number;
	reply: string;
	prefill: Record<string, unknown>;
	missing_context: string[];
}

// ============ Multi-Agent 新增类型 ============

/** Router Agent 的输出 */
export interface RouterResult {
	intent_type: 'action' | 'query' | 'chat';
	domain: string | null;
	confidence: number;
	raw_message: string;
	context: AgentContext;
}

/** Domain Agent 的输出 */
export interface DomainResult {
	reply: string;
	action: {
		id: string;
		entry: string;
		layer: AgentLayer;
	} | null;
	prefill: Record<string, unknown>;
	data?: unknown;
	missing_context: string[];
}

/** 模块描述，供 Router Agent 分类用 */
export interface DomainDescriptor {
	id: string;
	name: string;
	description: string;
	keywords: string[];
}

/** Domain Agent 定义 */
export interface DomainAgentDef {
	descriptor: DomainDescriptor;
	actions: AgentAction[];
	buildSystemPrompt: () => string;
}
