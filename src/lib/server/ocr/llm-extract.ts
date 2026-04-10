import { callAiJsonWithSource, type AiProviderUsed } from '$lib/server/services/ai-agent';

type StructuredInvoiceCore = {
	invoiceDate: string | null;
	totalAmount: number | null;
	currency: string | null;
	supplierName: string | null;
	gstAmount: number | null;
	poNumber: string | null;
	dueDate: string | null;
};

type LlmStructuredResult = StructuredInvoiceCore & {
	llmProvider: 'heuristic' | 'external_api' | 'workers_ai';
	modelResponseRaw?: string;
};

type LlmExtractOptions = {
	llmProvider: 'heuristic' | 'external';
	llmApiUrl?: string;
	llmApiKey?: string;
	promptVersion: string;
	env?: Env;
};

function pickCurrency(text: string): string | null {
	const match = text.match(/\b(SGD|USD|CNY|MYR|EUR)\b/i);
	return match ? match[1].toUpperCase() : null;
}

function pickNumber(text: string, pattern: RegExp): number | null {
	const match = text.match(pattern);
	if (!match?.[1]) return null;
	const normalized = match[1].replace(/,/g, '');
	const parsed = Number.parseFloat(normalized);
	return Number.isFinite(parsed) ? parsed : null;
}

function pickDate(text: string, pattern: RegExp): string | null {
	const match = text.match(pattern);
	return match?.[1] ?? null;
}

function heuristicExtract(rawText: string): LlmStructuredResult {
	const invoiceDate = pickDate(rawText, /invoice\s*date[:\s]+(\d{4}-\d{2}-\d{2})/i);
	const dueDate = pickDate(rawText, /due\s*date[:\s]+(\d{4}-\d{2}-\d{2})/i);
	const totalAmount = pickNumber(rawText, /(?:total|amount\s*due)[:\s$]+([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i);
	const gstAmount = pickNumber(rawText, /(?:gst|tax)\s*(?:amount)?[:\s$]+([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i);
	const supplierNameMatch = rawText.match(/supplier[:\s]+([^\n]+)/i);
	const poMatch = rawText.match(/po(?:\s*number)?[:\s#-]+([A-Z0-9-]+)/i);

	return {
		invoiceDate,
		totalAmount,
		currency: pickCurrency(rawText),
		supplierName: supplierNameMatch?.[1]?.trim() ?? null,
		gstAmount,
		poNumber: poMatch?.[1] ?? null,
		dueDate,
		llmProvider: 'heuristic'
	};
}

async function externalExtract(rawText: string, options: LlmExtractOptions): Promise<LlmStructuredResult | null> {
	const envLike = {
		LLM_PROVIDER: options.llmProvider,
		LLM_API_URL: options.llmApiUrl,
		LLM_API_KEY: options.llmApiKey,
		OCR_PROMPT_VERSION: options.promptVersion
	} as Env;
	const envForCall = options.env ?? envLike;

	const systemPrompt = `You are an invoice data extractor. Return ONLY JSON object with keys:
invoiceDate, totalAmount, currency, supplierName, gstAmount, poNumber, dueDate.
Use null for unknown fields.`;
	const { json: parsedUnknown, provider } = await callAiJsonWithSource(envForCall, {
		system: systemPrompt,
		user: rawText,
		promptVersion: options.promptVersion
	});
	if (!parsedUnknown || typeof parsedUnknown !== 'object' || Array.isArray(parsedUnknown)) return null;
	const parsed = parsedUnknown as Record<string, unknown>;
	const llmProvider: Extract<LlmStructuredResult['llmProvider'], AiProviderUsed> =
		provider === 'workers_ai' ? 'workers_ai' : 'external_api';

	return {
		invoiceDate: typeof parsed.invoiceDate === 'string' ? parsed.invoiceDate : null,
		totalAmount: typeof parsed.totalAmount === 'number' ? parsed.totalAmount : null,
		currency: typeof parsed.currency === 'string' ? parsed.currency : null,
		supplierName: typeof parsed.supplierName === 'string' ? parsed.supplierName : null,
		gstAmount: typeof parsed.gstAmount === 'number' ? parsed.gstAmount : null,
		poNumber: typeof parsed.poNumber === 'string' ? parsed.poNumber : null,
		dueDate: typeof parsed.dueDate === 'string' ? parsed.dueDate : null,
		llmProvider,
		modelResponseRaw: JSON.stringify(parsed)
	};
}

export async function extractStructuredInvoiceFields(
	rawText: string,
	options: LlmExtractOptions
): Promise<LlmStructuredResult> {
	if (options.llmProvider === 'external' || options.env?.AI) {
		const external = await externalExtract(rawText, options);
		if (external) return external;
	}
	return heuristicExtract(rawText);
}
