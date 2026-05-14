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
	required_roles: Array<'owner' | 'finance' | 'project_manager' | 'hr' | 'employee'>;
	params?: AgentActionParam[];
}

export interface AgentContext {
	currentPath: string;
	project_id?: string;
	project_name?: string;
	user_role?: 'owner' | 'finance' | 'project_manager' | 'hr' | 'employee';
	[key: string]: unknown;
}

export interface AgentIntentResult {
	matched_action_id: string | null;
	confidence: number;
	reply: string;
	prefill: Record<string, unknown>;
	missing_context: string[];
}

// ============ Multi-agent orchestration types ============

/** Router agent output */
export interface RouterResult {
	intent_type: 'action' | 'query' | 'chat';
	domain: string | null;
	confidence: number;
	raw_message: string;
	context: AgentContext;
}

/** Domain agent output */
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

/** Module descriptor for router classification */
export interface DomainDescriptor {
	id: string;
	name: string;
	description: string;
	keywords: string[];
}

/** Domain agent definition */
export interface DomainAgentDef {
	descriptor: DomainDescriptor;
	actions: AgentAction[];
	buildSystemPrompt: () => string;
}

/** Query execution context (injected by intent API) */
export interface QueryContext {
	env: Env;
	userId: string;
	userRole: string;
}

/** Query execution result */
export interface QueryDataResult {
	success: boolean;
	data?: unknown;
	error?: string;
}

/** Query handler signature */
export type QueryHandler = (
	ctx: QueryContext,
	actionId: string,
	params: Record<string, unknown>
) => Promise<QueryDataResult>;

/** Chat history entry */
export interface ChatHistoryMessage {
	role: 'user' | 'assistant';
	content: string;
}
