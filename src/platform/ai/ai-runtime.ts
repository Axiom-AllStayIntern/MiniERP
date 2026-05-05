/**
 * Minimum AI Runtime impl (Phase 2).
 *
 * Stage 2 only locked the type shape (`ai-runtime.types.ts`). Stage 4 lands
 * the first real `runStructuredOutput` so finance capabilities can ask for
 * schema-validated JSON back from a model.
 *
 * Internally this just wraps the existing
 * `$platform/ai/json-provider:callAiJsonWithSource` helper â€?that helper
 * already routes between Workers AI and an external HTTP provider, parses
 * loose JSON output, and retries once on invalid output. The model-router
 * abstraction listed in doc 05 Â§30.3 lands later; until then this file is
 * the call site.
 */
import type { ZodType } from 'zod';
import { callAiJsonWithSource } from './json-provider';
import type {
	AIMessage,
	AIResultMetadata,
	AIRuntimeMetadata,
	AIStructuredResult,
	ModelHint
} from './ai-runtime.types';

export interface RunStructuredOutputInput<T> {
	task: string;
	messages: AIMessage[];
	schema: ZodType<T>;
	schemaName: string;
	schemaVersion: string;
	modelHint?: ModelHint;
	metadata: AIRuntimeMetadata;
	env: Env;
}

export type StructuredOutputStatus =
	| 'success'
	| 'invalid_output'
	| 'no_provider'
	| 'unknown_error';

export type RunStructuredOutputResult<T> =
	| { status: 'success'; result: AIStructuredResult<T> }
	| {
			status: 'invalid_output' | 'no_provider' | 'unknown_error';
			error: string;
			meta: AIResultMetadata;
	  };

function flattenMessages(messages: AIMessage[]): { system: string; user: string } {
	const sys: string[] = [];
	const usr: string[] = [];
	for (const msg of messages) {
		if (msg.role === 'system' || msg.role === 'developer') sys.push(msg.content);
		else if (msg.role === 'user') usr.push(msg.content);
	}
	return { system: sys.join('\n\n'), user: usr.join('\n\n') };
}

function emptyMeta(input: RunStructuredOutputInput<unknown>, latencyMs: number, providerId: string, modelId: string): AIResultMetadata {
	return {
		providerId,
		modelId,
		promptVersion: input.metadata.promptVersion,
		schemaVersion: input.schemaVersion,
		latencyMs,
		createdAt: new Date().toISOString()
	};
}

/**
 * Run an LLM call that must return a JSON value matching `schema`. On invalid
 * output we don't retry beyond what `callAiJsonWithSource` already does â€?we
 * surface the failure to the caller so they can fall back to heuristic /
 * mock paths instead of looping.
 */
export async function runStructuredOutput<T>(
	input: RunStructuredOutputInput<T>
): Promise<RunStructuredOutputResult<T>> {
	const { system, user } = flattenMessages(input.messages);
	const start = Date.now();

	let json: unknown;
	let provider: string;
	try {
		const out = await callAiJsonWithSource(input.env, {
			system,
			user,
			promptVersion: input.metadata.promptVersion
		});
		json = out.json;
		provider = out.provider;
	} catch (err) {
		const meta = emptyMeta(input, Date.now() - start, 'unknown', 'unknown');
		return {
			status: 'unknown_error',
			error: err instanceof Error ? err.message : 'AI runtime error',
			meta
		};
	}

	const meta = emptyMeta(input, Date.now() - start, provider, 'unknown');

	if (provider === 'none' || json === null || json === undefined) {
		return { status: 'no_provider', error: 'No AI provider returned a result.', meta };
	}

	const parsed = input.schema.safeParse(json);
	if (!parsed.success) {
		return {
			status: 'invalid_output',
			error: parsed.error.issues
				.map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
				.join('; '),
			meta
		};
	}

	return {
		status: 'success',
		result: { value: parsed.data, meta }
	};
}
