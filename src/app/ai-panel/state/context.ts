import { writable } from 'svelte/store';

export type AgentPageContext = Record<string, unknown>;

export const agentPageContext = writable<AgentPageContext>({});

export function setAgentPageContext(context: AgentPageContext) {
	agentPageContext.set(context);
}
