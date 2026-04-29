/**
 * AI Runtime type stubs per ref_files/v4/phase0-6/05 §5.
 *
 * Stage 2 only locks the shape so capabilities can be authored against a
 * stable contract. The real `runText` / `runStructuredOutput` / `runVision`
 * implementations land in Stage 4 (or later, when the model router ships).
 */

import type { FinanceRiskLevel } from '../../modules/finance/agent/types';

export interface AIMessage {
	role: 'system' | 'developer' | 'user' | 'assistant' | 'tool';
	content: string;
}

export type ModelCapability =
	| 'fast_classification'
	| 'structured_extraction'
	| 'vision_ocr'
	| 'reasoning'
	| 'long_context'
	| 'tool_calling';

export interface ModelHint {
	capability: ModelCapability;
	priority?: 'latency' | 'cost' | 'quality' | 'balanced';
	preferredProvider?: string;
	preferredModel?: string;
}

export interface AIRuntimeMetadata {
	tenantId: string;
	userId?: string;

	agentId?: string;
	workflowId?: string;
	workflowStep?: string;

	capabilityId: string;
	promptVersion: string;
	schemaVersion?: string;

	riskLevel?: FinanceRiskLevel;

	inputRefs?: string[];
}

export interface AIResultMetadata {
	providerId: string;
	modelId: string;

	promptVersion: string;
	schemaVersion?: string;

	latencyMs: number;

	inputTokens?: number;
	outputTokens?: number;
	totalTokens?: number;

	estimatedCost?: number;

	requestId?: string;
	responseId?: string;

	createdAt: string;
}

export interface AITextResult {
	text: string;
	meta: AIResultMetadata;
}

export interface AIStructuredResult<T> {
	value: T;
	meta: AIResultMetadata;
}

export interface AIVisionResult {
	text: string;
	meta: AIResultMetadata;
}
