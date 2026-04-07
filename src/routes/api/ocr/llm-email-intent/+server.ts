import type { RequestHandler } from './$types';

import { callExternalLlmJson } from '$lib/server/ocr/external-llm-json';
import { fail, ok } from '$lib/server/http';

type EmailType = 'invoice' | 'purchase_order' | 'quotation' | 'contract' | 'other';

const EMAIL_TYPES: EmailType[] = ['invoice', 'purchase_order', 'quotation', 'contract', 'other'];

type IntentPayload = {
	subject?: string;
	sender?: string;
	bodyPreview?: string;
	attachmentNames?: string[];
};

export type EmailIntentResult = {
	email_type: EmailType;
	target_attachment_keywords: string[];
	priority_attachment: string | null;
	/** 0–1 */
	confidence: number;
};

function clamp01(n: number): number {
	if (!Number.isFinite(n)) return 0;
	return Math.min(1, Math.max(0, n));
}

function normalizeEmailType(raw: unknown): EmailType {
	if (typeof raw !== 'string') return 'other';
	const v = raw.trim().toLowerCase().replace(/\s+/g, '_');
	const aliases: Record<string, EmailType> = {
		invoice: 'invoice',
		purchase_order: 'purchase_order',
		po: 'purchase_order',
		quotation: 'quotation',
		quote: 'quotation',
		contract: 'contract',
		agreement: 'contract',
		other: 'other'
	};
	return aliases[v] ?? (EMAIL_TYPES.includes(v as EmailType) ? (v as EmailType) : 'other');
}

function buildIntentSystemPrompt(): string {
	return `你是一个企业邮件分类助手。根据用户提供的邮件信息，判断业务类型和目标附件特征。

请返回JSON对象（仅此一个 JSON，不要 markdown）：
{
  "email_type": "invoice|purchase_order|quotation|contract|other",
  "target_attachment_keywords": ["invoice", "发票", "tax"],
  "priority_attachment": "最可能是目标的附件文件名，没有把握则 null",
  "confidence": 0.0
}

规则：
- confidence 为 0 到 1 的小数，表示你对整体判断的把握。
- target_attachment_keywords 为短词列表，用于在附件文件名中匹配。
- priority_attachment 必须是用户给出的附件文件名之一，否则填 null。
- 只返回 JSON，不要解释。`;
}

function buildIntentUserMessage(p: IntentPayload): string {
	const names = Array.isArray(p.attachmentNames) ? p.attachmentNames.filter(Boolean) : [];
	return `Subject: ${p.subject ?? ''}
From: ${p.sender ?? ''}
正文摘要（前500字）: ${(p.bodyPreview ?? '').slice(0, 500)}
附件列表: ${names.length ? names.join(', ') : '(无)'}`;
}

function heuristicIntent(p: IntentPayload): EmailIntentResult {
	const blob = [
		p.subject ?? '',
		p.sender ?? '',
		p.bodyPreview ?? '',
		...(Array.isArray(p.attachmentNames) ? p.attachmentNames : [])
	]
		.join(' ')
		.toLowerCase();

	let email_type: EmailType = 'other';
	if (/\binvoice\b|发票|tax\s+invoice|账单/.test(blob)) email_type = 'invoice';
	else if (/\bpurchase\s+order\b|\bpo\b|采购单/.test(blob)) email_type = 'purchase_order';
	else if (/\bquotation\b|\bquote\b|报价|rfq/.test(blob)) email_type = 'quotation';
	else if (/\bcontract\b|合同|agreement/.test(blob)) email_type = 'contract';

	const kw: string[] = [];
	if (email_type === 'invoice') kw.push('invoice', '发票', 'tax');
	if (email_type === 'purchase_order') kw.push('po', 'purchase');
	if (email_type === 'quotation') kw.push('quote', 'quotation');
	if (email_type === 'contract') kw.push('contract', 'agreement');

	const names = Array.isArray(p.attachmentNames) ? p.attachmentNames : [];
	let priority_attachment: string | null = null;
	let best = 0;
	for (const name of names) {
		const n = name.toLowerCase();
		let s = 0;
		for (const k of kw) {
			if (k && n.includes(k.toLowerCase())) s += 1;
		}
		if (/\.(pdf|xlsx?|docx?|csv)$/i.test(name)) s += 0.5;
		if (s > best) {
			best = s;
			priority_attachment = name;
		}
	}
	if (best < 0.5) priority_attachment = null;

	return {
		email_type,
		target_attachment_keywords: kw.length ? kw : ['document'],
		priority_attachment,
		confidence: 0.42
	};
}

function parseIntentModelJson(parsed: unknown): EmailIntentResult | null {
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
	const o = parsed as Record<string, unknown>;

	const email_type = normalizeEmailType(o.email_type);
	let confidence = 0.55;
	if (typeof o.confidence === 'number' && Number.isFinite(o.confidence)) confidence = clamp01(o.confidence);
	else if (typeof o.confidence === 'string') {
		const n = Number.parseFloat(o.confidence.trim());
		if (Number.isFinite(n)) confidence = clamp01(n);
	}

	let target_attachment_keywords: string[] = [];
	if (Array.isArray(o.target_attachment_keywords)) {
		target_attachment_keywords = o.target_attachment_keywords
			.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
			.map((x) => x.trim())
			.slice(0, 20);
	}

	let priority_attachment: string | null = null;
	if (typeof o.priority_attachment === 'string' && o.priority_attachment.trim()) {
		priority_attachment = o.priority_attachment.trim();
	} else if (o.priority_attachment === null) {
		priority_attachment = null;
	}

	return {
		email_type,
		target_attachment_keywords,
		priority_attachment,
		confidence
	};
}

export const POST: RequestHandler = async ({ request, platform }) => {
	if (!platform) return fail('Cloudflare platform bindings are required', 500);

	const payload = (await request.json()) as IntentPayload;
	const subject = payload.subject?.trim() ?? '';
	const sender = payload.sender?.trim() ?? '';
	const bodyPreview = payload.bodyPreview?.trim() ?? '';
	const attachmentNames = Array.isArray(payload.attachmentNames)
		? payload.attachmentNames.map((x) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean)
		: [];

	if (!subject && !sender && !bodyPreview && attachmentNames.length === 0) {
		return fail('At least one of subject, sender, bodyPreview, or attachmentNames is required', 400);
	}

	const user = buildIntentUserMessage({
		subject,
		sender,
		bodyPreview,
		attachmentNames
	});

	const external = await callExternalLlmJson(platform.env, buildIntentSystemPrompt(), user);
	const parsed = parseIntentModelJson(external);
	if (parsed) {
		const allowed = new Set(attachmentNames);
		if (parsed.priority_attachment && !allowed.has(parsed.priority_attachment)) {
			parsed.priority_attachment = null;
		}
		return ok({ provider: 'external_api', result: parsed });
	}

	const fallback = heuristicIntent({ subject, sender, bodyPreview, attachmentNames });
	return ok({ provider: 'heuristic', result: fallback });
};
