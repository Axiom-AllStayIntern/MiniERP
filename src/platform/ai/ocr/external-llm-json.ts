import { callAiJson } from '$platform/ai/json-provider';

/** Returns parsed JSON (object or array) from the model, or null if unavailable / parse error. */
export async function callExternalLlmJson(
	platformEnv: Env,
	system: string,
	user: string
): Promise<unknown> {
	return callAiJson(platformEnv, { system, user });
}
