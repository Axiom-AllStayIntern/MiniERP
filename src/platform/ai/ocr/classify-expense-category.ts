/**
 * Second-pass classifier: given the first-pass decided it's an expense-bucket
 * document (invoice_in / expense), decide which expense_type + category it is.
 *
 * Category universe per smartfin-expense-revenue-design.md Â§2:
 *   opex:        transport | accommodation | meal | gift | allowance |
 *                ai_subscription | logistics | purchase | others
 *   sales_cost:  invoice | receipt
 *
 * The category drives which field set we LLM-extract in the next pass, and
 * which DB columns/metadata keys we write on save. This is hidden from users;
 * they only see the bucket confirmation ("Expense: AI subscription") in the
 * UI, never a dropdown of 11 categories.
 */

import { callAiJsonWithSource } from '$platform/ai/json-provider';

export type ExpenseType = 'opex' | 'sales_cost';

export type OpexCategory =
	| 'transport'
	| 'accommodation'
	| 'meal'
	| 'gift'
	| 'allowance'
	| 'ai_subscription'
	| 'logistics'
	| 'purchase'
	| 'others';

export type SalesCostCategory = 'invoice' | 'receipt';

export type ExpenseCategory = OpexCategory | SalesCostCategory;

export type ExpenseCategoryResult = {
	expenseType: ExpenseType;
	category: ExpenseCategory;
	docType: 'invoice' | 'receipt' | 'po' | null;
	reason?: string;
};

const ALL_CATEGORIES: ExpenseCategory[] = [
	'transport',
	'accommodation',
	'meal',
	'gift',
	'allowance',
	'ai_subscription',
	'logistics',
	'purchase',
	'others',
	'invoice',
	'receipt'
];

const OPEX_CATEGORIES: OpexCategory[] = [
	'transport',
	'accommodation',
	'meal',
	'gift',
	'allowance',
	'ai_subscription',
	'logistics',
	'purchase',
	'others'
];

function buildSystemPrompt(firstPassDocType: 'invoice_in' | 'expense'): string {
	return `You refine an expense classification for an SMB accounting system.

The first pass said this document is: "${firstPassDocType}".
Now decide:
1. expense_type: "opex" (operating / overhead) or "sales_cost" (direct project / COGS)
2. category: one of [transport, accommodation, meal, gift, allowance, ai_subscription, logistics, purchase, others, invoice, receipt]
3. doc_type: "invoice" | "receipt" | "po" | null

Decision rules:
- sales_cost categories are ONLY "invoice" or "receipt" â€?they represent a supplier bill (or its payment confirmation) for project-linked work.
- opex categories cover overhead: staff transport/meal/lodging, SaaS subscriptions, logistics, gifts, cash allowances, procurement.
- sales_cost needs a clear project linkage signal: large amount, supplier name matches a known project vendor, mention of deliverables. When in doubt, prefer opex.
- Map by merchant + content:
    * Grab / Uber / taxi / Gojek / MRT â†?opex.transport, doc_type: receipt
    * Hotel / Airbnb / Booking.com â†?opex.accommodation, doc_type: receipt or invoice
    * Restaurant / cafe / food delivery â†?opex.meal, doc_type: receipt
    * Gift shop / florist / FTD â†?opex.gift, doc_type: receipt
    * Cash per-diem with no merchant â†?opex.allowance, doc_type: null
    * ChatGPT / OpenAI / Cursor / Anthropic / Cloudflare / AWS / Vercel / GitHub / Figma / Notion â†?opex.ai_subscription, doc_type: invoice
    * DHL / FedEx / SingPost / UPS / SF Express â†?opex.logistics, doc_type: receipt or invoice
    * Electronic components / BOM / bulk procurement with PO number â†?opex.purchase, doc_type: po
    * Supplier tax invoice for a project deliverable â†?sales_cost.invoice, doc_type: invoice
    * Supplier payment receipt for same â†?sales_cost.receipt, doc_type: receipt

Return ONLY a JSON object:
{"expense_type": "opex"|"sales_cost", "category": "...", "doc_type": "invoice"|"receipt"|"po"|null, "reason": "brief"}`;
}

function heuristicFallback(
	rawText: string,
	firstPassDocType: 'invoice_in' | 'expense'
): ExpenseCategoryResult {
	const t = rawText.toLowerCase();

	// Transport
	if (/\b(grab|gojek|uber|taxi|comfort\s*delgro|cabcharge|mrt)\b/.test(t)) {
		return { expenseType: 'opex', category: 'transport', docType: 'receipt', reason: 'transport merchant' };
	}

	// AI / SaaS
	if (/\b(openai|chatgpt|anthropic|claude|cursor|github|figma|notion|cloudflare|vercel|aws|stripe)\b/.test(t)) {
		return { expenseType: 'opex', category: 'ai_subscription', docType: 'invoice', reason: 'SaaS merchant' };
	}

	// Logistics
	if (/\b(dhl|fedex|singpost|ups|sf\s*express|ninja\s*van)\b/.test(t)) {
		return { expenseType: 'opex', category: 'logistics', docType: 'receipt', reason: 'logistics merchant' };
	}

	// Accommodation
	if (/\b(hotel|airbnb|booking\.com|agoda|marina\s+bay\s+sands|hilton|marriott|shangri-la)\b/.test(t)) {
		return { expenseType: 'opex', category: 'accommodation', docType: 'receipt', reason: 'accommodation merchant' };
	}

	// Meal
	if (/\b(restaurant|cafe|foodpanda|deliveroo|mcdonald|starbucks|toast\s*box|kopi)\b/.test(t)) {
		return { expenseType: 'opex', category: 'meal', docType: 'receipt', reason: 'meal merchant' };
	}

	// Purchase / PO
	if (/\bpurchase\s*order\b|\bp\.?\s*o\.?\s*(no|number|#)/.test(rawText) || /\bbom\b/.test(t)) {
		return { expenseType: 'opex', category: 'purchase', docType: 'po', reason: 'PO / BOM signal' };
	}

	// First-pass says invoice_in â†?default to sales_cost.invoice (most common case)
	if (firstPassDocType === 'invoice_in') {
		return {
			expenseType: 'sales_cost',
			category: 'invoice',
			docType: 'invoice',
			reason: 'supplier invoice without specific overhead signal'
		};
	}

	// expense (receipt) with no specific signal â†?opex.others
	return { expenseType: 'opex', category: 'others', docType: 'receipt', reason: 'generic expense receipt' };
}

function normalizeCategory(raw: unknown, fallback: ExpenseCategory): ExpenseCategory {
	if (typeof raw !== 'string') return fallback;
	const v = raw.trim().toLowerCase().replace(/[-\s]/g, '_');
	if ((ALL_CATEGORIES as string[]).includes(v)) return v as ExpenseCategory;
	// Common alias cleanup
	if (v === 'saas' || v === 'subscription') return 'ai_subscription';
	if (v === 'travel' || v === 'transportation') return 'transport';
	if (v === 'food' || v === 'dining') return 'meal';
	if (v === 'lodging' || v === 'hotel') return 'accommodation';
	if (v === 'shipping' || v === 'courier') return 'logistics';
	if (v === 'per_diem') return 'allowance';
	if (v === 'bom' || v === 'procurement') return 'purchase';
	return fallback;
}

function normalizeExpenseType(raw: unknown, fallback: ExpenseType): ExpenseType {
	if (typeof raw !== 'string') return fallback;
	const v = raw.trim().toLowerCase().replace(/[-\s]/g, '_');
	if (v === 'opex' || v === 'operating') return 'opex';
	if (v === 'sales_cost' || v === 'cogs' || v === 'direct_cost') return 'sales_cost';
	return fallback;
}

function normalizeDocType(raw: unknown): 'invoice' | 'receipt' | 'po' | null {
	if (typeof raw !== 'string') return null;
	const v = raw.trim().toLowerCase();
	if (v === 'invoice' || v === 'receipt' || v === 'po') return v;
	return null;
}

/**
 * Refine a first-pass classification (invoice_in | expense) into the
 * expense_type + category + doc_type triple. LLM-first with heuristic
 * fallback; safe to call without AI configured.
 */
export async function classifyExpenseCategory(
	rawText: string,
	firstPassDocType: 'invoice_in' | 'expense',
	env: Env
): Promise<ExpenseCategoryResult> {
	const fallback = heuristicFallback(rawText, firstPassDocType);

	try {
		const system = buildSystemPrompt(firstPassDocType);
		const { json } = await callAiJsonWithSource(env, {
			system,
			user: rawText.slice(0, 12000)
		});
		if (json && typeof json === 'object' && !Array.isArray(json)) {
			const parsed = json as Record<string, unknown>;
			const expenseType = normalizeExpenseType(parsed.expense_type, fallback.expenseType);
			const category = normalizeCategory(parsed.category, fallback.category);
			const docType = normalizeDocType(parsed.doc_type);
			const reason = typeof parsed.reason === 'string' ? parsed.reason.slice(0, 200) : undefined;

			// Consistency guard: sales_cost must be invoice or receipt
			if (expenseType === 'sales_cost' && category !== 'invoice' && category !== 'receipt') {
				return { ...fallback, reason: 'model picked sales_cost with opex category â€?kept heuristic' };
			}
			// Consistency guard: allowance implies no file
			if (category === 'allowance') {
				return { expenseType: 'opex', category: 'allowance', docType: null, reason };
			}

			return {
				expenseType,
				category,
				docType: docType ?? fallback.docType,
				reason
			};
		}
	} catch {
		// LLM call failed â€?heuristic fallback is fine.
	}

	return fallback;
}

export { OPEX_CATEGORIES };
