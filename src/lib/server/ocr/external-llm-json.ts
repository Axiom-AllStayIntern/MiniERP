/**
 * JSON responses from the same external LLM config as `llm-classify` / `llm-extract`
 * (LLM_PROVIDER=external, LLM_API_URL, LLM_API_KEY, optional OPENAI_MODEL).
 */

function readEnv(platformEnv: Env, key: string): string {
	const processEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
	const fromPlatform = (platformEnv as unknown as Record<string, unknown>)[key];
	if (typeof fromPlatform === 'string' && fromPlatform.trim()) return fromPlatform.trim();
	const fromProcess = processEnv?.[key];
	return typeof fromProcess === 'string' ? fromProcess.trim() : '';
}

/** Returns parsed JSON (object or array) from the model, or null if unavailable / parse error. */
export async function callExternalLlmJson(
	platformEnv: Env,
	system: string,
	user: string
): Promise<unknown> {
	const provider = readEnv(platformEnv, 'LLM_PROVIDER').toLowerCase();
	const apiUrl = readEnv(platformEnv, 'LLM_API_URL');
	const apiKey = readEnv(platformEnv, 'LLM_API_KEY');
	const promptVersion = readEnv(platformEnv, 'OCR_PROMPT_VERSION') || 'v1';
	if (provider !== 'external' || !apiUrl) return null;

	const openAiModel = readEnv(platformEnv, 'OPENAI_MODEL') || 'gpt-4o-mini';
	const isOpenAiChatEndpoint = /api\.openai\.com\/v1\/chat\/completions/i.test(apiUrl);
	const systemFull = `${system}\nPrompt version: ${promptVersion}`;

	const response = await fetch(
		apiUrl,
		isOpenAiChatEndpoint
			? {
					method: 'POST',
					headers: {
						'content-type': 'application/json',
						...(apiKey ? { authorization: `Bearer ${apiKey}` } : {})
					},
					body: JSON.stringify({
						model: openAiModel,
						temperature: 0,
						response_format: { type: 'json_object' },
						messages: [
							{ role: 'system', content: systemFull },
							{ role: 'user', content: user }
						]
					})
				}
			: {
					method: 'POST',
					headers: {
						'content-type': 'application/json',
						...(apiKey ? { authorization: `Bearer ${apiKey}` } : {})
					},
					body: JSON.stringify({
						promptVersion,
						system: systemFull,
						input: user
					})
				}
	);

	if (!response.ok) return null;
	const raw = await response.text();
	try {
		const json = JSON.parse(raw) as Record<string, unknown>;
		if (isOpenAiChatEndpoint) {
			const choices = json.choices as Array<{ message?: { content?: string } }> | undefined;
			const content = choices?.[0]?.message?.content;
			if (typeof content !== 'string' || !content.trim()) return null;
			return JSON.parse(content.trim()) as unknown;
		}
		return json as unknown;
	} catch {
		return null;
	}
}
