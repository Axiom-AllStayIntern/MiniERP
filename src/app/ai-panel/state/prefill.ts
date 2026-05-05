import { writable, get } from 'svelte/store';

export type AgentPrefillData = Record<string, unknown>;

type PrefillState = {
	data: AgentPrefillData;
	version: number;
};

export const agentPrefill = writable<PrefillState>({ data: {}, version: 0 });

/**
 * Consume prefill data (read and clear).
 * Call this in form pages to get prefilled values from Agent.
 */
export function consumePrefill(): AgentPrefillData {
	const state = get(agentPrefill);
	if (Object.keys(state.data).length === 0) return {};
	agentPrefill.set({ data: {}, version: state.version });
	return state.data;
}

/**
 * Set prefill data before navigation.
 */
export function setPrefill(data: AgentPrefillData): void {
	const state = get(agentPrefill);
	agentPrefill.set({ data, version: state.version + 1 });
}

/**
 * Check if there's pending prefill data without consuming it.
 */
export function hasPrefill(): boolean {
	const state = get(agentPrefill);
	return Object.keys(state.data).length > 0;
}

/**
 * Parse various date formats to YYYY-MM-DD for HTML date input.
 */
export function parseDateToPrefill(value: unknown): string {
	if (typeof value !== 'string' || !value.trim()) return '';

	const input = value.trim().toLowerCase();

	// Relative dates (English shortcuts)
	const today = new Date();
	if (input === 'today') {
		return formatDate(today);
	}
	if (input === 'tomorrow') {
		const d = new Date(today);
		d.setDate(d.getDate() + 1);
		return formatDate(d);
	}
	if (input === 'yesterday') {
		const d = new Date(today);
		d.setDate(d.getDate() - 1);
		return formatDate(d);
	}

	// Try parsing as ISO date (YYYY-MM-DD)
	if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
		return input;
	}

	// Try parsing other common formats
	const parsed = new Date(value);
	if (!isNaN(parsed.getTime())) {
		return formatDate(parsed);
	}

	return '';
}

function formatDate(d: Date): string {
	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}
