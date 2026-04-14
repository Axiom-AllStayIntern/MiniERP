<script lang="ts">
	import { unzip } from 'fflate';
	import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

	let { data } = $props();
	let selectedDocType = $state('contract');
	let selectedFile = $state<File | null>(null);
	let docTitle = $state('');
	let docNotes = $state('');
	let detectedTextPreview = $state('');
	let detectStatus = $state<'idle' | 'analyzing' | 'done' | 'unsupported' | 'error'>('idle');
	let detectMessage = $state('');
	let llmStatus = $state<'idle' | 'analyzing' | 'done' | 'error'>('idle');
	let llmMessage = $state('');
	let llmDetectedLines = $state<string[]>([]);
	let llmFieldConfidence = $state<Record<string, number>>({});
	let docTypeClassifyMessage = $state('');
	let docTypeClassifyConfidence = $state<number | null>(null);
	let rawDetectedText = $state('');
	let detectTiming = $state<{
		pdfLoadMs?: number;
		pdfParseMs?: number;
		regexExtractMs?: number;
		totalMs?: number;
	} | null>(null);
	let fileMeta = $state<{
		name: string;
		type: string;
		sizeLabel: string;
		lastModified: string;
	} | null>(null);
	let fileInputRef = $state<HTMLInputElement | null>(null);
	let pdfJsCache: (typeof import('pdfjs-dist')) | null = null;
	let filePreviewUrl = $state<string | null>(null);
	let contractNo = $state('');
	let contractDate = $state('');
	let contractAmount = $state('');
	let contractCurrency = $state('SGD');
	let quotationRef = $state('');
	let quotationDate = $state('');
	let quotationChannel = $state('');
	let quotationAmount = $state('');
	let quotationCurrency = $state('SGD');
	let poNumber = $state('');
	let poSupplier = $state('');
	let poDate = $state('');
	let poAmount = $state('');
	let poCurrency = $state('SGD');
	let invoiceOutNo = $state('');
	let invoiceOutCustomer = $state('');
	let invoiceOutDate = $state('');
	let invoiceOutDueDate = $state('');
	let invoiceOutTotal = $state('');
	let invoiceOutCurrency = $state('SGD');
	let invoiceOutGstAmount = $state('0');
	let invoiceOutGstType = $state<'standard' | 'zero' | 'exempt'>('standard');
	let invoiceInNo = $state('');
	let invoiceInSupplier = $state('');
	let invoiceInDate = $state('');
	let invoiceInPoNumber = $state('');
	let invoiceInAmount = $state('');
	let invoiceInCurrency = $state('SGD');
	let invoiceInGstAmount = $state('0');
	let invoiceInDueDate = $state('');
	let otherTag = $state('');
	let otherRef = $state('');
	let expenseCategory = $state('');
	let expenseSubcategory = $state('');
	let expenseAmount = $state('');
	let expenseCurrency = $state('SGD');
	let expenseDate = $state('');
	let expenseStaffName = $state('');
	let expenseCostLayer = $state<'cogs' | 'opex'>('cogs');
	let saveStatus = $state<'idle' | 'saving' | 'done' | 'error'>('idle');
	let saveMessage = $state('');
	let emlSummary = $state('');
	let emlAttachments = $state<
		Array<{
			filename: string;
			mimeType: string;
			sizeLabel: string;
			score: number;
			keywords: string[];
			isLikelyTarget: boolean;
			llmConfidence?: number;
			llmReason?: string;
		}>
	>([]);

	const BATCH_DETECTABLE_EXT = new Set([
		'pdf',
		'doc',
		'docx',
		'xls',
		'xlsx',
		'csv',
		'png',
		'jpg',
		'jpeg',
		'webp',
		'eml',
		'txt'
	]);
	const MAX_ZIP_BYTES = 80 * 1024 * 1024;
	const MAX_BATCH_FILES = 150;

	let pendingBatchFiles = $state<File[]>([]);
	let batchCurrentIndex = $state(0);
	let batchSourceArchiveName = $state<string | null>(null);
	let zipUnpackBusy = $state(false);
	let zipUnpackError = $state('');

	$effect(() => {
		selectedDocType = data.filters.docType || 'contract';
	});

	function formatFileSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
	}

	function isZipLike(file: File): boolean {
		const n = file.name.toLowerCase();
		const t = (file.type || '').toLowerCase();
		return n.endsWith('.zip') || t === 'application/zip' || t === 'application/x-zip-compressed';
	}

	function mimeForBatchExt(ext: string): string {
		const map: Record<string, string> = {
			pdf: 'application/pdf',
			png: 'image/png',
			jpg: 'image/jpeg',
			jpeg: 'image/jpeg',
			webp: 'image/webp',
			txt: 'text/plain',
			csv: 'text/csv',
			eml: 'message/rfc822',
			doc: 'application/msword',
			docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
			xls: 'application/vnd.ms-excel',
			xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
		};
		return map[ext] ?? 'application/octet-stream';
	}

	function shouldSkipZipPath(key: string): boolean {
		const k = key.replace(/\\/g, '/');
		if (k.endsWith('/')) return true;
		const segments = k.split('/').filter(Boolean);
		if (segments.some((s) => s === '__MACOSX')) return true;
		const base = segments[segments.length - 1] ?? '';
		if (base === '.DS_Store' || base.startsWith('._')) return true;
		const ext = base.includes('.') ? base.split('.').pop()?.toLowerCase() ?? '' : '';
		return !BATCH_DETECTABLE_EXT.has(ext);
	}

	function zipEntryDisplayName(pathKey: string): string {
		const normalized = pathKey.replace(/\\/g, '/');
		return normalized.split('/').filter(Boolean).join(' — ');
	}

	async function unpackZipToFiles(zipFile: File): Promise<File[]> {
		if (zipFile.size > MAX_ZIP_BYTES) {
			throw new Error(`ZIP exceeds ${formatFileSize(MAX_ZIP_BYTES)}; split the archive or upload files separately.`);
		}
		const buf = new Uint8Array(await zipFile.arrayBuffer());
		const entries = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
			unzip(buf, (err, data) => {
				if (err) reject(err);
				else resolve(data ?? {});
			});
		});
		const keys = Object.keys(entries).filter((k) => !shouldSkipZipPath(k));
		keys.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

		let totalBytes = 0;
		for (const k of keys) {
			totalBytes += entries[k].byteLength;
		}
		if (totalBytes > MAX_ZIP_BYTES) {
			throw new Error(`Uncompressed total exceeds ${formatFileSize(MAX_ZIP_BYTES)}.`);
		}

		const files: File[] = [];
		for (const pathKey of keys) {
			const bytes = entries[pathKey];
			if (!bytes?.byteLength) continue;
			const displayName = zipEntryDisplayName(pathKey);
			const extMatch = displayName.match(/\.([^.]+)$/);
			const ext = extMatch ? extMatch[1].toLowerCase() : '';
			const mime = mimeForBatchExt(ext);
			const copy = new Uint8Array(bytes.byteLength);
			copy.set(bytes);
			files.push(new File([copy], displayName, { type: mime, lastModified: Date.now() }));
			if (files.length > MAX_BATCH_FILES) {
				throw new Error(`Too many supported files in ZIP (limit ${MAX_BATCH_FILES}).`);
			}
		}
		return files;
	}

	function applyQueuedFileAtIndex(idx: number): void {
		const file = pendingBatchFiles[idx];
		if (!file) return;
		batchCurrentIndex = idx;
		if (filePreviewUrl) {
			URL.revokeObjectURL(filePreviewUrl);
		}
		selectedFile = file;
		filePreviewUrl = URL.createObjectURL(file);
		fileMeta = {
			name: file.name,
			type: file.type || 'unknown',
			sizeLabel: formatFileSize(file.size),
			lastModified: new Date(file.lastModified).toISOString().slice(0, 10)
		};
		const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
		docTitle = nameWithoutExt;
		docNotes = batchSourceArchiveName
			? `From archive: ${batchSourceArchiveName} · ${file.name} | ${fileMeta.sizeLabel} | ${fileMeta.type}`
			: `Auto-detected file metadata: ${file.name} | ${fileMeta.sizeLabel} | ${fileMeta.type}`;
		llmDetectedLines = [];
		llmFieldConfidence = {};
		void runQuickTextDetection(file);
	}

	function applySinglePickedFile(file: File): void {
		if (filePreviewUrl) {
			URL.revokeObjectURL(filePreviewUrl);
		}
		selectedFile = file;
		filePreviewUrl = URL.createObjectURL(file);
		fileMeta = {
			name: file.name,
			type: file.type || 'unknown',
			sizeLabel: formatFileSize(file.size),
			lastModified: new Date(file.lastModified).toISOString().slice(0, 10)
		};
		const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
		docTitle = nameWithoutExt;
		const autoNote = `Auto-detected file metadata: ${file.name} | ${fileMeta.sizeLabel} | ${fileMeta.type}`;
		docNotes = autoNote;
		llmDetectedLines = [];
		llmFieldConfidence = {};
		void runQuickTextDetection(file);
	}

	function navigateBatch(delta: number): void {
		if (pendingBatchFiles.length === 0) return;
		const next = batchCurrentIndex + delta;
		if (next < 0 || next >= pendingBatchFiles.length) return;
		resetExtractedFields();
		saveMessage = '';
		saveStatus = 'idle';
		zipUnpackError = '';
		applyQueuedFileAtIndex(next);
	}

	function detectDocType(fileName: string): string {
		const normalized = fileName.toLowerCase();
		if (normalized.includes('contract') || normalized.includes('agreement')) return 'contract';
		if (normalized.includes('quotation') || normalized.includes('quote') || normalized.includes('rfq'))
			return 'quotation';
		if (normalized.includes('purchase') || normalized.includes('po')) return 'purchase_order';
		if (normalized.includes('invoice') && (normalized.includes('supplier') || normalized.includes('vendor')))
			return 'invoice_in';
		if (normalized.includes('invoice')) return 'invoice_out';
		if (
			normalized.includes('receipt') ||
			normalized.includes('grab') ||
			normalized.includes('expense') ||
			normalized.includes('settlement') ||
			/\.(jpg|jpeg|png|webp)$/i.test(normalized)
		)
			return 'expense';
		return 'other';
	}

	const DOC_TYPE_LABELS: Record<string, string> = {
		contract: 'Contract',
		quotation: 'Quotation',
		purchase_order: 'Purchase Order',
		invoice_out: 'Customer Invoice',
		invoice_in: 'Supplier Invoice',
		expense: 'Company expense / receipt',
		other: 'Other (unclassified)'
	};

	function docTypeLabel(key: string): string {
		return DOC_TYPE_LABELS[key] ?? key;
	}

	function decodeMimeWord(input: string): string {
		return input.replace(/=\?([^?]+)\?([BQbq])\?([^?]+)\?=/g, (_full, charsetRaw, encodingRaw, bodyRaw) => {
			const charset = String(charsetRaw || '').toLowerCase();
			const encoding = String(encodingRaw || '').toUpperCase();
			const body = String(bodyRaw || '');
			if (charset && charset !== 'utf-8' && charset !== 'us-ascii') return body;
			if (encoding === 'B') {
				try {
					return atob(body);
				} catch {
					return body;
				}
			}
			const qp = body.replace(/_/g, ' ').replace(/=([0-9A-F]{2})/gi, (_m, hex) => {
				const n = Number.parseInt(hex, 16);
				return Number.isFinite(n) ? String.fromCharCode(n) : '';
			});
			return qp;
		});
	}

	function parseEmlHeaders(raw: string): Record<string, string> {
		const lines = raw.replace(/\r\n/g, '\n').split('\n');
		const headers: Record<string, string> = {};
		let activeKey = '';
		for (const line of lines) {
			if (!line.trim()) break;
			if ((line.startsWith(' ') || line.startsWith('\t')) && activeKey) {
				headers[activeKey] = `${headers[activeKey]} ${line.trim()}`.trim();
				continue;
			}
			const idx = line.indexOf(':');
			if (idx <= 0) continue;
			activeKey = line.slice(0, idx).trim().toLowerCase();
			headers[activeKey] = line.slice(idx + 1).trim();
		}
		return headers;
	}

	function parseBoundary(contentType: string): string | null {
		const boundaryMatch = contentType.match(/boundary="?([^";]+)"?/i);
		return boundaryMatch?.[1] ?? null;
	}

	function extractMultipartParts(raw: string, boundary: string): string[] {
		const normalized = raw.replace(/\r\n/g, '\n');
		const marker = `--${boundary}`;
		const chunks = normalized.split(marker);
		const out: string[] = [];
		for (const chunk of chunks) {
			const trimmed = chunk.trim();
			if (!trimmed || trimmed === '--') continue;
			const endMarkerIdx = trimmed.indexOf('\n--');
			out.push(endMarkerIdx >= 0 ? trimmed.slice(0, endMarkerIdx).trim() : trimmed);
		}
		return out;
	}

	function decodeBodyContent(body: string, transferEncoding: string): string {
		const normalizedEncoding = transferEncoding.toLowerCase();
		if (normalizedEncoding.includes('base64')) {
			try {
				return atob(body.replace(/\s+/g, ''));
			} catch {
				return '';
			}
		}
		if (normalizedEncoding.includes('quoted-printable')) {
			return body
				.replace(/=\n/g, '')
				.replace(/=([0-9A-F]{2})/gi, (_m, hex) => {
					const n = Number.parseInt(hex, 16);
					return Number.isFinite(n) ? String.fromCharCode(n) : '';
				});
		}
		return body;
	}

	function stringToLatin1Bytes(s: string): Uint8Array {
		const out = new Uint8Array(s.length);
		for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
		return out;
	}

	/** Decode a MIME part body to raw bytes (for PDF attachments). */
	function decodeMimePartToBytes(body: string, transferEncoding: string): Uint8Array | null {
		const enc = transferEncoding.toLowerCase();
		const trimmed = body.replace(/\r\n/g, '\n').trim();
		if (!trimmed) return null;
		if (enc.includes('base64')) {
			try {
				const bin = atob(trimmed.replace(/\s+/g, ''));
				const out = new Uint8Array(bin.length);
				for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i) & 0xff;
				return out;
			} catch {
				return null;
			}
		}
		if (enc.includes('quoted-printable')) {
			return stringToLatin1Bytes(decodeBodyContent(body, 'quoted-printable'));
		}
		return stringToLatin1Bytes(trimmed);
	}

	function isPdfMimeOrFilename(filename: string, mimeBase: string): boolean {
		return mimeBase.toLowerCase().includes('pdf') || /\.pdf$/i.test(filename);
	}

	function isLikelyPdfBytes(bytes: Uint8Array): boolean {
		if (bytes.length < 5) return false;
		const max = Math.min(bytes.length - 5, 2048);
		for (let i = 0; i <= max; i++) {
			if (
				bytes[i] === 0x25 &&
				bytes[i + 1] === 0x50 &&
				bytes[i + 2] === 0x44 &&
				bytes[i + 3] === 0x46 &&
				bytes[i + 4] === 0x2d
			) {
				return true;
			}
		}
		return false;
	}

	type EmlParsedAttachment = {
		filename: string;
		mimeType: string;
		size: number;
		score: number;
		keywords: string[];
		/** Populated for PDF parts when decoding succeeds */
		decodedBytes?: Uint8Array | null;
	};

	function collectFromMimePart(
		partHeaderRaw: string,
		partBodyRaw: string,
		fallbackTransferEncoding: string,
		depth: number
	): { attachments: EmlParsedAttachment[]; textParts: string[] } {
		if (depth > 10) return { attachments: [], textParts: [] };

		const h = parseEmlHeaders(partHeaderRaw);
		const contentType = h['content-type'] ?? 'text/plain';
		const transferEncoding = (h['content-transfer-encoding'] ?? fallbackTransferEncoding ?? '').trim();
		const mimeBase = contentType.split(';')[0].trim();
		const ctLower = contentType.toLowerCase();
		const boundary = parseBoundary(contentType);

		if (boundary && ctLower.includes('multipart/')) {
			const decoded = decodeBodyContent(partBodyRaw, transferEncoding);
			const innerParts = extractMultipartParts(decoded, boundary);
			const attachments: EmlParsedAttachment[] = [];
			const textParts: string[] = [];
			for (const chunk of innerParts) {
				const { headerRaw: ih, bodyRaw: ib } = splitHeaderBody(chunk);
				const sub = collectFromMimePart(ih, ib, '', depth + 1);
				attachments.push(...sub.attachments);
				textParts.push(...sub.textParts);
			}
			return { attachments, textParts };
		}

		const disposition = h['content-disposition'] ?? '';
		const filename = pickFileName(disposition, contentType);
		const dispLower = disposition.toLowerCase();
		const isAttachment =
			dispLower.includes('attachment') ||
			Boolean(filename) ||
			mimeBase.toLowerCase() === 'application/pdf';

		if (isAttachment) {
			const { score, keywords } = scoreAttachment(filename || 'unnamed', mimeBase);
			const wantPdfBytes = isPdfMimeOrFilename(filename || '', mimeBase);
			const decodedBytes = wantPdfBytes ? decodeMimePartToBytes(partBodyRaw, transferEncoding) : null;
			let size = partBodyRaw.length;
			if (decodedBytes) size = decodedBytes.length;
			else if (transferEncoding.toLowerCase().includes('base64')) {
				try {
					size = atob(partBodyRaw.replace(/\s+/g, '')).length;
				} catch {
					/* keep */
				}
			}
			return {
				attachments: [
					{
						filename: filename || 'unnamed',
						mimeType: mimeBase,
						size,
						score,
						keywords,
						decodedBytes: wantPdfBytes ? decodedBytes : undefined
					}
				],
				textParts: []
			};
		}

		if (ctLower.includes('text/plain') || ctLower.includes('text/html')) {
			const decoded = decodeBodyContent(partBodyRaw, transferEncoding);
			const plain = decoded
				.replace(/<style[\s\S]*?<\/style>/gi, ' ')
				.replace(/<script[\s\S]*?<\/script>/gi, ' ')
				.replace(/<[^>]+>/g, ' ')
				.replace(/\s+/g, ' ')
				.trim();
			return { attachments: [], textParts: plain ? [plain] : [] };
		}

		return { attachments: [], textParts: [] };
	}

	function orderEmlAttachmentsByRank(
		attachments: EmlParsedAttachment[],
		ranked: Array<{ filename: string; confidence?: number; reason?: string }>
	): EmlParsedAttachment[] {
		const byName = new Map(attachments.map((a) => [a.filename, a]));
		const seen = new Set<string>();
		const ordered: EmlParsedAttachment[] = [];
		for (const r of ranked) {
			const a = byName.get(r.filename);
			if (!a || seen.has(a.filename)) continue;
			seen.add(a.filename);
			ordered.push(a);
		}
		for (const a of attachments) {
			if (!seen.has(a.filename)) ordered.push(a);
		}
		return ordered;
	}

	function splitHeaderBody(rawPart: string): { headerRaw: string; bodyRaw: string } {
		const normalized = rawPart.replace(/\r\n/g, '\n');
		const idx = normalized.indexOf('\n\n');
		if (idx < 0) return { headerRaw: normalized, bodyRaw: '' };
		return { headerRaw: normalized.slice(0, idx), bodyRaw: normalized.slice(idx + 2) };
	}

	function pickFileName(disposition: string, contentType: string): string {
		const fromDisposition = disposition.match(/filename\*?="?([^";]+)"?/i)?.[1];
		const fromType = contentType.match(/name\*?="?([^";]+)"?/i)?.[1];
		const raw = fromDisposition || fromType || '';
		return decodeMimeWord(raw).trim();
	}

	function scoreAttachment(filename: string, mimeType: string): { score: number; keywords: string[] } {
		const normalized = `${filename} ${mimeType}`.toLowerCase();
		const keywords = ['invoice', '发票', 'bill', 'tax', 'gst', 'po', 'purchase', 'contract', 'quotation', 'quote'];
		const matched = keywords.filter((k) => normalized.includes(k));
		let score = 0;
		if (/\.(pdf|xlsx|xls|csv|docx?)$/i.test(filename)) score += 15;
		if (mimeType.includes('pdf')) score += 20;
		score += matched.length * 18;
		return { score: Math.min(100, score), keywords: matched };
	}

	function parseEmlContent(rawEml: string): {
		subject: string;
		sender: string;
		bodyText: string;
		attachments: EmlParsedAttachment[];
	} {
		const { headerRaw, bodyRaw } = splitHeaderBody(rawEml);
		const rootHeaders = parseEmlHeaders(headerRaw);
		const subject = decodeMimeWord(rootHeaders.subject ?? '');
		const sender = decodeMimeWord(rootHeaders.from ?? '');
		const rootTe = rootHeaders['content-transfer-encoding'] ?? '';
		const { attachments, textParts } = collectFromMimePart(headerRaw, bodyRaw, rootTe, 0);
		attachments.sort((a, b) => b.score - a.score);
		return { subject, sender, bodyText: textParts.join('\n'), attachments };
	}

	function mapEmailIntentToClassifyHint(intent: { email_type?: string } | null): string | undefined {
		if (!intent?.email_type) return undefined;
		const t = intent.email_type.toLowerCase();
		if (t === 'contract') return 'contract';
		if (t === 'quotation') return 'quotation';
		if (t === 'purchase_order') return 'purchase_order';
		if (t === 'invoice') return undefined;
		if (t === 'other') return 'other';
		return undefined;
	}

	function mergeEmlAttachmentsForUi(
		attachments: EmlParsedAttachment[],
		ranked: Array<{ filename: string; confidence?: number; reason?: string }>
	): Array<{
		filename: string;
		mimeType: string;
		sizeLabel: string;
		score: number;
		keywords: string[];
		isLikelyTarget: boolean;
		llmConfidence?: number;
		llmReason?: string;
	}> {
		const meta = new Map<string, { confidence?: number; reason?: string }>();
		const byName = new Map(attachments.map((a) => [a.filename, a]));
		for (const r of ranked) {
			if (!r.filename?.trim() || !byName.has(r.filename)) continue;
			meta.set(r.filename, { confidence: r.confidence, reason: r.reason });
		}
		const ordered = orderEmlAttachmentsByRank(attachments, ranked);
		return ordered.slice(0, 5).map((item, index) => {
			const m = meta.get(item.filename);
			const llmConf = m?.confidence;
			const topLlm = index === 0 && llmConf !== undefined && llmConf >= 0.45;
			const topRule = index === 0 && item.score >= 35 && llmConf === undefined;
			return {
				filename: item.filename,
				mimeType: item.mimeType,
				sizeLabel: formatFileSize(item.size),
				score: item.score,
				keywords: item.keywords,
				isLikelyTarget: topLlm || topRule,
				llmConfidence: m?.confidence,
				llmReason: m?.reason
			};
		});
	}

	function parseAmount(text: string): string {
		const directAmountMatch =
			text.match(
				/(?:grand total|invoice total|total amount|total|amount due|contract amount)\s*[:\-]?\s*(?:sgd|usd|cny|myr|eur|\$)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/i
			) ?? text.match(/(?:sgd|usd|cny|myr|eur|\$)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/i);
		return directAmountMatch?.[1]?.replace(/,/g, '') ?? '';
	}

	function parseDocumentDate(text: string): string {
		const isoMatch = text.match(/\b(20[0-9]{2})[-/](0[1-9]|1[0-2])[-/](0[1-9]|[12][0-9]|3[01])\b/);
		if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

		const dmyMatch = text.match(/\b(0?[1-9]|[12][0-9]|3[01])[\/\-](0?[1-9]|1[0-2])[\/\-](20[0-9]{2})\b/);
		if (dmyMatch) {
			const day = dmyMatch[1].padStart(2, '0');
			const month = dmyMatch[2].padStart(2, '0');
			const year = dmyMatch[3];
			return `${year}-${month}-${day}`;
		}
		return '';
	}

	function applyExtractedFields(text: string): void {
		const compact = text.replace(/\r/g, '\n');
		const amount = parseAmount(compact);
		const docDate = parseDocumentDate(compact);
		const currency = compact.match(/\b(SGD|USD|CNY|MYR|EUR)\b/i)?.[1]?.toUpperCase() ?? '';
		const invoiceNoMatch = compact.match(
			/(?:invoice|bill)\s*(?:no|number|#)\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9\-\/_]*)/i
		);
		const contractNoMatch = compact.match(
			/(?:contract|agreement)\s*(?:no|number|#)\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9\-\/_]*)/i
		);
		const poNoMatch = compact.match(
			/(?:po|purchase order)\s*(?:no|number|#)?\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9\-\/_]*)/i
		);
		const customerMatch = compact.match(/(?:bill to|customer|client)\s*[:\-]?\s*([^\n]+)/i);
		const supplierMatch = compact.match(/(?:supplier|vendor|from)\s*[:\-]?\s*([^\n]+)/i);

		if (selectedDocType === 'contract') {
			if (!contractNo && contractNoMatch?.[1]) contractNo = contractNoMatch[1];
			if (!contractDate && docDate) contractDate = docDate;
			if (!contractAmount && amount) contractAmount = amount;
			if (!contractCurrency && currency) contractCurrency = currency;
		} else if (selectedDocType === 'quotation') {
			if (!quotationRef && (contractNoMatch?.[1] || poNoMatch?.[1])) {
				quotationRef = contractNoMatch?.[1] ?? poNoMatch?.[1] ?? '';
			}
			if (!quotationDate && docDate) quotationDate = docDate;
			if (!quotationAmount && amount) quotationAmount = amount;
			if (!quotationCurrency && currency) quotationCurrency = currency;
		} else if (selectedDocType === 'purchase_order') {
			if (!poNumber && poNoMatch?.[1]) poNumber = poNoMatch[1];
			if (!poSupplier && supplierMatch?.[1]) poSupplier = supplierMatch[1].trim();
			if (!poDate && docDate) poDate = docDate;
			if (!poAmount && amount) poAmount = amount;
			if (!poCurrency && currency) poCurrency = currency;
		} else if (selectedDocType === 'invoice_out') {
			if (!invoiceOutNo && invoiceNoMatch?.[1]) invoiceOutNo = invoiceNoMatch[1];
			if (!invoiceOutCustomer && customerMatch?.[1]) invoiceOutCustomer = customerMatch[1].trim();
			if (!invoiceOutDate && docDate) invoiceOutDate = docDate;
			if (!invoiceOutTotal && amount) invoiceOutTotal = amount;
			if (!invoiceOutCurrency && currency) invoiceOutCurrency = currency;
		} else if (selectedDocType === 'invoice_in') {
			if (!invoiceInNo && invoiceNoMatch?.[1]) invoiceInNo = invoiceNoMatch[1];
			if (!invoiceInSupplier && supplierMatch?.[1]) invoiceInSupplier = supplierMatch[1].trim();
			if (!invoiceInDate && docDate) invoiceInDate = docDate;
			if (!invoiceInPoNumber && poNoMatch?.[1]) invoiceInPoNumber = poNoMatch[1];
			if (!invoiceInAmount && amount) invoiceInAmount = amount;
			if (!invoiceInCurrency && currency) invoiceInCurrency = currency;
		} else if (selectedDocType === 'expense') {
			if (!expenseCategory && supplierMatch?.[1]) expenseCategory = supplierMatch[1].trim().slice(0, 120);
			if (!expenseDate && docDate) expenseDate = docDate;
			if (!expenseAmount && amount) expenseAmount = amount;
			if (!expenseCurrency && currency) expenseCurrency = currency;
		}
	}

	function readFieldConfidenceMap(result: Record<string, unknown>): Record<string, number> | undefined {
		const raw = result.fieldConfidence;
		if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
		const out: Record<string, number> = {};
		for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
			if (typeof v === 'number' && Number.isFinite(v)) {
				out[k] = Math.min(100, Math.max(0, Math.round(v)));
			} else if (typeof v === 'string') {
				const n = Number.parseFloat(v.trim());
				if (Number.isFinite(n)) out[k] = Math.min(100, Math.max(0, Math.round(n)));
			}
		}
		return Object.keys(out).length ? out : undefined;
	}

	function fallbackBandPercent(band: string): number {
		if (band === 'high') return 92;
		if (band === 'low') return 46;
		return 74;
	}

	function applyLlmResult(result: Record<string, unknown>): void {
		const fc = readFieldConfidenceMap(result);
		const overallBand = typeof result.confidence === 'string' ? result.confidence : 'medium';
		const fallbackPct = fallbackBandPercent(overallBand);
		const setConfidence = (uiKey: string, apiKey: string): void => {
			const n = fc?.[apiKey];
			llmFieldConfidence[uiKey] =
				typeof n === 'number' && Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : fallbackPct;
		};

		if (selectedDocType === 'contract') {
			if (typeof result.contractNo === 'string' && result.contractNo.trim()) {
				contractNo = result.contractNo.trim();
				setConfidence('contractNo', 'contractNo');
			}
			if (typeof result.contractDate === 'string' && result.contractDate.trim()) {
				contractDate = result.contractDate.trim();
				setConfidence('contractDate', 'contractDate');
			}
			if (typeof result.contractAmount === 'number' && Number.isFinite(result.contractAmount)) {
				contractAmount = result.contractAmount.toFixed(2);
				setConfidence('contractAmount', 'contractAmount');
			}
			if (typeof result.contractCurrency === 'string' && result.contractCurrency.trim()) {
				contractCurrency = result.contractCurrency.trim().toUpperCase();
				setConfidence('contractCurrency', 'contractCurrency');
			}
			return;
		}

		if (selectedDocType === 'purchase_order') {
			if (typeof result.poNumber === 'string' && result.poNumber.trim()) {
				poNumber = result.poNumber.trim();
				setConfidence('poNumber', 'poNumber');
			}
			if (typeof result.supplierName === 'string' && result.supplierName.trim()) {
				poSupplier = result.supplierName.trim();
				setConfidence('poSupplier', 'supplierName');
			}
			if (typeof result.contractAmount === 'number' && Number.isFinite(result.contractAmount)) {
				poAmount = result.contractAmount.toFixed(2);
				setConfidence('poAmount', 'contractAmount');
			}
			if (typeof result.poDate === 'string' && result.poDate.trim()) {
				poDate = result.poDate.trim();
				setConfidence('poDate', 'poDate');
			}
			if (typeof result.poCurrency === 'string' && result.poCurrency.trim()) {
				poCurrency = result.poCurrency.trim().toUpperCase();
				setConfidence('poCurrency', 'poCurrency');
			}
			return;
		}

		if (selectedDocType === 'quotation') {
			if (typeof result.quotationRef === 'string' && result.quotationRef.trim()) {
				quotationRef = result.quotationRef.trim();
				setConfidence('quotationRef', 'quotationRef');
			}
			if (typeof result.quotationDate === 'string' && result.quotationDate.trim()) {
				quotationDate = result.quotationDate.trim();
				setConfidence('quotationDate', 'quotationDate');
			}
			if (typeof result.quotationAmount === 'number' && Number.isFinite(result.quotationAmount)) {
				quotationAmount = result.quotationAmount.toFixed(2);
				setConfidence('quotationAmount', 'quotationAmount');
			}
			if (typeof result.quotationCurrency === 'string' && result.quotationCurrency.trim()) {
				quotationCurrency = result.quotationCurrency.trim().toUpperCase();
				setConfidence('quotationCurrency', 'quotationCurrency');
			}
			if (typeof result.sourceType === 'string' && result.sourceType.trim()) {
				quotationChannel = result.sourceType.trim();
				setConfidence('quotationChannel', 'sourceType');
			}
			return;
		}

		if (selectedDocType === 'expense') {
			if (typeof result.expenseCategory === 'string' && result.expenseCategory.trim()) {
				expenseCategory = result.expenseCategory.trim();
				setConfidence('expenseCategory', 'expenseCategory');
			}
			if (typeof result.expenseSubcategory === 'string' && result.expenseSubcategory.trim()) {
				expenseSubcategory = result.expenseSubcategory.trim();
				setConfidence('expenseSubcategory', 'expenseSubcategory');
			}
			if (typeof result.expenseAmount === 'number' && Number.isFinite(result.expenseAmount)) {
				expenseAmount = result.expenseAmount.toFixed(2);
				setConfidence('expenseAmount', 'expenseAmount');
			}
			if (typeof result.expenseCurrency === 'string' && result.expenseCurrency.trim()) {
				expenseCurrency = result.expenseCurrency.trim().toUpperCase();
				setConfidence('expenseCurrency', 'expenseCurrency');
			}
			if (typeof result.expenseDate === 'string' && result.expenseDate.trim()) {
				expenseDate = result.expenseDate.trim();
				setConfidence('expenseDate', 'expenseDate');
			}
			if (typeof result.expenseStaffName === 'string' && result.expenseStaffName.trim()) {
				expenseStaffName = result.expenseStaffName.trim();
				setConfidence('expenseStaffName', 'expenseStaffName');
			}
			if (typeof result.expenseCostLayer === 'string' && result.expenseCostLayer.trim()) {
				const layer = result.expenseCostLayer.trim().toLowerCase();
				expenseCostLayer = layer === 'opex' ? 'opex' : 'cogs';
				setConfidence('expenseCostLayer', 'expenseCostLayer');
			}
			return;
		}

		if (selectedDocType === 'invoice_in' || selectedDocType === 'invoice_out') {
			if (selectedDocType === 'invoice_in') {
				if (typeof result.invoiceNo === 'string' && result.invoiceNo.trim()) {
					invoiceInNo = result.invoiceNo.trim();
					setConfidence('invoiceInNo', 'invoiceNo');
				}
				if (typeof result.supplierName === 'string' && result.supplierName.trim()) {
					invoiceInSupplier = result.supplierName.trim();
					setConfidence('invoiceInSupplier', 'supplierName');
				}
				if (typeof result.invoiceDate === 'string' && result.invoiceDate.trim()) {
					invoiceInDate = result.invoiceDate.trim();
					setConfidence('invoiceInDate', 'invoiceDate');
				}
				if (typeof result.invoiceCurrency === 'string' && result.invoiceCurrency.trim()) {
					invoiceInCurrency = result.invoiceCurrency.trim().toUpperCase();
					setConfidence('invoiceInCurrency', 'invoiceCurrency');
				}
				if (typeof result.invoiceDueDate === 'string' && result.invoiceDueDate.trim()) {
					invoiceInDueDate = result.invoiceDueDate.trim();
					setConfidence('invoiceInDueDate', 'invoiceDueDate');
				}
				if (typeof result.invoiceGstAmount === 'number' && Number.isFinite(result.invoiceGstAmount)) {
					invoiceInGstAmount = result.invoiceGstAmount.toFixed(2);
					setConfidence('invoiceInGstAmount', 'invoiceGstAmount');
				}
				if (typeof result.poNumber === 'string' && result.poNumber.trim()) {
					invoiceInPoNumber = result.poNumber.trim();
					setConfidence('invoiceInPoNumber', 'poNumber');
				}
				if (typeof result.invoiceAmount === 'number' && Number.isFinite(result.invoiceAmount)) {
					invoiceInAmount = result.invoiceAmount.toFixed(2);
					setConfidence('invoiceInAmount', 'invoiceAmount');
				}
			} else {
				if (typeof result.invoiceNo === 'string' && result.invoiceNo.trim()) {
					invoiceOutNo = result.invoiceNo.trim();
					setConfidence('invoiceOutNo', 'invoiceNo');
				}
				if (typeof result.customerName === 'string' && result.customerName.trim()) {
					invoiceOutCustomer = result.customerName.trim();
					setConfidence('invoiceOutCustomer', 'customerName');
				}
				if (typeof result.invoiceDate === 'string' && result.invoiceDate.trim()) {
					invoiceOutDate = result.invoiceDate.trim();
					setConfidence('invoiceOutDate', 'invoiceDate');
				}
				if (typeof result.invoiceCurrency === 'string' && result.invoiceCurrency.trim()) {
					invoiceOutCurrency = result.invoiceCurrency.trim().toUpperCase();
					setConfidence('invoiceOutCurrency', 'invoiceCurrency');
				}
				if (typeof result.invoiceDueDate === 'string' && result.invoiceDueDate.trim()) {
					invoiceOutDueDate = result.invoiceDueDate.trim();
					setConfidence('invoiceOutDueDate', 'invoiceDueDate');
				}
				if (typeof result.invoiceGstAmount === 'number' && Number.isFinite(result.invoiceGstAmount)) {
					invoiceOutGstAmount = result.invoiceGstAmount.toFixed(2);
					setConfidence('invoiceOutGstAmount', 'invoiceGstAmount');
				}
				if (typeof result.invoiceAmount === 'number' && Number.isFinite(result.invoiceAmount)) {
					invoiceOutTotal = result.invoiceAmount.toFixed(2);
					setConfidence('invoiceOutTotal', 'invoiceAmount');
				}
			}
		}
	}

	function buildLlmDetectedLines(result: Record<string, unknown>): string[] {
		const lines: string[] = [];
		const pushLine = (label: string, key: string): void => {
			const value = result[key];
			if (typeof value === 'string' && value.trim()) {
				lines.push(`${label}: ${value.trim()}`);
				return;
			}
			if (typeof value === 'number' && Number.isFinite(value)) {
				lines.push(`${label}: ${value}`);
			}
		};

		if (selectedDocType === 'contract') {
			pushLine('Contract No', 'contractNo');
			pushLine('Date', 'contractDate');
			pushLine('Amount', 'contractAmount');
			pushLine('Currency', 'contractCurrency');
		} else if (selectedDocType === 'quotation') {
			pushLine('Quotation Ref', 'quotationRef');
			pushLine('Date', 'quotationDate');
			pushLine('Amount', 'quotationAmount');
			pushLine('Currency', 'quotationCurrency');
			pushLine('Source Type', 'sourceType');
			pushLine('Customer', 'customerName');
		} else if (selectedDocType === 'purchase_order') {
			pushLine('PO Number', 'poNumber');
			pushLine('Date', 'poDate');
			pushLine('Supplier', 'supplierName');
			pushLine('Amount', 'contractAmount');
			pushLine('Currency', 'poCurrency');
		} else if (selectedDocType === 'expense') {
			pushLine('Category', 'expenseCategory');
			pushLine('Subcategory', 'expenseSubcategory');
			pushLine('Amount', 'expenseAmount');
			pushLine('Currency', 'expenseCurrency');
			pushLine('Date', 'expenseDate');
			pushLine('Staff', 'expenseStaffName');
			pushLine('Cost layer', 'expenseCostLayer');
		} else if (selectedDocType === 'invoice_in' || selectedDocType === 'invoice_out') {
			pushLine('Invoice No', 'invoiceNo');
			pushLine('Date', 'invoiceDate');
			pushLine('Due Date', 'invoiceDueDate');
			pushLine('Amount', 'invoiceAmount');
			pushLine('GST Amount', 'invoiceGstAmount');
			pushLine('Currency', 'invoiceCurrency');
			pushLine('PO Number', 'poNumber');
			pushLine('Supplier', 'supplierName');
			pushLine('Customer', 'customerName');
		}

		const fc = readFieldConfidenceMap(result);
		if (fc && Object.keys(fc).length) {
			const parts = Object.entries(fc)
				.map(([k, v]) => `${k}: ${v}%`)
				.sort((a, b) => a.localeCompare(b));
			lines.push(`Per-field confidence: ${parts.join(', ')}`);
		} else {
			const confidence = typeof result.confidence === 'string' ? result.confidence : '';
			if (confidence) {
				lines.push(`Overall confidence: ${confidence}`);
			}
		}
		return lines;
	}

	function confidenceClass(percent: number | undefined): string {
		if (!percent) return 'text-slate-400';
		if (percent >= 80) return 'text-emerald-700';
		if (percent >= 60) return 'text-amber-700';
		return 'text-rose-700';
	}

	async function runLlmRefinement(raw: string): Promise<void> {
		if (!raw.trim()) return;
		llmStatus = 'analyzing';
		llmMessage = 'Running LLM extraction refinement...';
		llmFieldConfidence = {};
		try {
			const response = await fetch('/api/ocr/llm-extract', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					docType: selectedDocType,
					text: raw.slice(0, 12000)
				})
			});
			if (!response.ok) {
				llmStatus = 'error';
				llmMessage = `LLM extraction failed (${response.status}).`;
				return;
			}
			const payload = (await response.json()) as {
				ok: boolean;
				data?: { provider: string; result: Record<string, unknown> };
				error?: string;
			};
			if (!payload.ok || !payload.data?.result) {
				llmStatus = 'error';
				llmMessage = payload.error || 'LLM extraction returned invalid result.';
				return;
			}

			applyLlmResult(payload.data.result);
			llmDetectedLines = buildLlmDetectedLines(payload.data.result);
			const fc = readFieldConfidenceMap(payload.data.result);
			const vals = fc ? Object.values(fc) : [];
			const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
			const band = typeof payload.data.result.confidence === 'string' ? payload.data.result.confidence : '';
			llmStatus = 'done';
			llmMessage =
				avg != null
					? `LLM refinement done (${payload.data.provider}, avg field confidence: ${avg}%${band ? `, overall: ${band}` : ''}).`
					: `LLM refinement done (${payload.data.provider}${band ? `, overall: ${band}` : ''}).`;
		} catch (error) {
			llmStatus = 'error';
			llmMessage = error instanceof Error ? error.message : 'LLM extraction error.';
			llmDetectedLines = [];
			llmFieldConfidence = {};
		}
	}

	async function loadPdfJs(): Promise<{ lib: typeof import('pdfjs-dist'); elapsedMs: number }> {
		if (pdfJsCache) {
			return { lib: pdfJsCache, elapsedMs: 0 };
		}
		console.time('pdf-load');
		const start = performance.now();
		const lib = await import('pdfjs-dist');
		// Force local bundled worker URL to avoid CDN/version mismatch.
		lib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
		const elapsedMs = performance.now() - start;
		console.timeEnd('pdf-load');
		pdfJsCache = lib;
		return { lib, elapsedMs };
	}

	async function extractPdfTextFromUint8Array(data: Uint8Array): Promise<{
		text: string;
		pageCount: number;
		parsedPages: number;
		pdfLoadMs: number;
		pdfParseMs: number;
	}> {
		const { lib: pdfjs, elapsedMs: pdfLoadMs } = await loadPdfJs();
		const loadingTask = pdfjs.getDocument({ data });
		console.time('pdf-parse');
		const parseStart = performance.now();
		const pdf = await Promise.race([
			loadingTask.promise,
			new Promise<never>((_, reject) =>
				setTimeout(() => reject(new Error('PDF parsing timeout after 15 seconds.')), 15000)
			)
		]);
		const parsedPages = Math.min(pdf.numPages, 8);
		const chunks: string[] = [];

		for (let pageNum = 1; pageNum <= parsedPages; pageNum += 1) {
			const page = await pdf.getPage(pageNum);
			const content = await page.getTextContent();
			const line = content.items
				.map((item) => ('str' in item ? item.str : ''))
				.join(' ')
				.replace(/\s+/g, ' ')
				.trim();
			if (line) chunks.push(line);
		}
		const pdfParseMs = performance.now() - parseStart;
		console.timeEnd('pdf-parse');

		return {
			text: chunks.join('\n').trim(),
			pageCount: pdf.numPages,
			parsedPages,
			pdfLoadMs,
			pdfParseMs
		};
	}

	async function extractPdfText(file: File): Promise<{
		text: string;
		pageCount: number;
		parsedPages: number;
		pdfLoadMs: number;
		pdfParseMs: number;
	}> {
		const fileBuffer = await file.arrayBuffer();
		return extractPdfTextFromUint8Array(new Uint8Array(fileBuffer));
	}

	/** Below this length, treat PDF as likely scanned and try Workers AI vision on page 1. */
	const MIN_PDF_TEXT_CHARS = 48;

	async function postWorkersVisionOcr(blob: Blob, fileName: string): Promise<{ text: string; error?: string }> {
		const fd = new FormData();
		fd.append('file', blob, fileName);
		const res = await fetch('/api/ocr/workers-vision', { method: 'POST', body: fd });
		const payload = (await res.json()) as {
			ok?: boolean;
			data?: { text?: string; model?: string };
			error?: string;
		};
		if (!res.ok || !payload.ok || typeof payload.data?.text !== 'string') {
			return { text: '', error: payload.error ?? `Workers vision OCR failed (${res.status})` };
		}
		return { text: payload.data.text };
	}

	async function renderPdfFirstPageToJpegBlob(file: File): Promise<Blob | null> {
		try {
			const { lib: pdfjs } = await loadPdfJs();
			const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
			const pdf = await Promise.race([
				loadingTask.promise,
				new Promise<never>((_, reject) =>
					setTimeout(() => reject(new Error('PDF open timeout')), 15000)
				)
			]);
			if (pdf.numPages < 1) return null;
			const page = await pdf.getPage(1);
			const baseVp = page.getViewport({ scale: 1 });
			const maxW = 1600;
			const scale = Math.min(2.5, maxW / Math.max(baseVp.width, 1));
			const viewport = page.getViewport({ scale });
			const canvas = document.createElement('canvas');
			canvas.width = Math.ceil(viewport.width);
			canvas.height = Math.ceil(viewport.height);
			const ctx = canvas.getContext('2d');
			if (!ctx) return null;
			const renderTask = page.render({ canvasContext: ctx, viewport, canvas });
			await renderTask.promise;
			return await new Promise((resolve) => {
				canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.88);
			});
		} catch {
			return null;
		}
	}

	async function runQuickTextDetection(file: File): Promise<void> {
		const totalStart = performance.now();
		detectStatus = 'analyzing';
		detectMessage = 'Running quick text detection...';
		detectedTextPreview = '';
		rawDetectedText = '';
		detectTiming = null;
		emlSummary = '';
		emlAttachments = [];
		try {
			const name = file.name.toLowerCase();
			const type = (file.type || '').toLowerCase();
			const isPdf = type.includes('pdf') || name.endsWith('.pdf');
			const isImage =
				type.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(name);
			const isTextLike =
				type.startsWith('text/') ||
				type.includes('json') ||
				type.includes('xml') ||
				name.endsWith('.txt') ||
				name.endsWith('.csv') ||
				name.endsWith('.eml');

			let raw = '';
			let pdfLoadMs = 0;
			let pdfParseMs = 0;
			let baseDetectMsg = '';
			let emlClassifyHint: string | undefined = undefined;
			if (isPdf) {
				const result = await extractPdfText(file);
				raw = result.text;
				pdfLoadMs = result.pdfLoadMs;
				pdfParseMs = result.pdfParseMs;
				baseDetectMsg = `PDF text extraction complete (${result.parsedPages}/${result.pageCount} pages scanned).`;

				const pdfTextLen = raw.replace(/\s+/g, ' ').trim().length;
				if (pdfTextLen < MIN_PDF_TEXT_CHARS) {
					detectMessage = 'Little or no selectable text — running Workers AI OCR on first page…';
					const jpegBlob = await renderPdfFirstPageToJpegBlob(file);
					if (jpegBlob) {
						const baseName = name.replace(/\.pdf$/i, '') || 'document';
						const ocr = await postWorkersVisionOcr(jpegBlob, `${baseName}-p1.jpg`);
						if (ocr.text.trim()) {
							raw = ocr.text;
							baseDetectMsg = `PDF had no usable text layer (${result.parsedPages}/${result.pageCount} pages checked). Workers AI OCR on page 1.`;
						} else if (ocr.error) {
							baseDetectMsg = `${baseDetectMsg} Workers AI OCR: ${ocr.error}`;
						}
					} else {
						baseDetectMsg = `${baseDetectMsg} Could not rasterize first page for OCR.`;
					}
				}
			} else if (isImage) {
				detectMessage = 'Running Workers AI vision OCR…';
				const ocr = await postWorkersVisionOcr(file, file.name);
				if (!ocr.text.trim()) {
					detectStatus = 'error';
					detectMessage = ocr.error ?? 'Workers AI OCR returned no text.';
					return;
				}
				raw = ocr.text;
				pdfLoadMs = 0;
				pdfParseMs = 0;
				baseDetectMsg = 'Image processed with Workers AI vision OCR.';
			} else if (isTextLike) {
				if (name.endsWith('.eml')) {
					const emlRaw = await file.text();
					const parsed = parseEmlContent(emlRaw);
					const bodyPreview = parsed.bodyText.replace(/\s+/g, ' ').slice(0, 500);
					const attachmentNames = parsed.attachments.map((a) => a.filename);

					const intentPromise = fetch('/api/ocr/llm-email-intent', {
						method: 'POST',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify({
							subject: parsed.subject,
							sender: parsed.sender,
							bodyPreview,
							attachmentNames
						})
					});

					const rankPromise =
						parsed.attachments.length > 0
							? fetch('/api/ocr/llm-attachment-rank', {
									method: 'POST',
									headers: { 'content-type': 'application/json' },
									body: JSON.stringify({
										emailType: 'business',
										attachments: parsed.attachments.map((a) => ({
											filename: a.filename,
											mimeType: a.mimeType,
											sizeBytes: a.size
										}))
									})
								})
							: Promise.resolve(null as Response | null);

					const [intentRes, rankRes] = await Promise.all([intentPromise, rankPromise]);

					type IntentApi = {
						ok: boolean;
						data?: {
							provider: string;
							result: {
								email_type: string;
								target_attachment_keywords: string[];
								priority_attachment: string | null;
								confidence: number;
							};
						};
						error?: string;
					};
					const intentJson = (await intentRes.json()) as IntentApi;

					let ranked: Array<{ filename: string; confidence?: number; reason?: string }> = [];
					let rankProvider = '';
					if (rankRes) {
						const rankJson = (await rankRes.json()) as {
							ok: boolean;
							data?: {
								provider: string;
								result: { ranked: Array<{ filename: string; confidence?: number; reason?: string }> };
							};
						};
						if (rankJson.ok && rankJson.data?.result?.ranked?.length) {
							ranked = rankJson.data.result.ranked;
							rankProvider = rankJson.data.provider ?? '';
						}
					}

					emlAttachments = mergeEmlAttachmentsForUi(parsed.attachments, ranked);

					const orderedForPdf = orderEmlAttachmentsByRank(parsed.attachments, ranked);
					const maxEmlPdfs = 3;
					const emlPdfSnippets: string[] = [];
					for (const att of orderedForPdf) {
						if (!att.decodedBytes || !isLikelyPdfBytes(att.decodedBytes)) continue;
						if (emlPdfSnippets.length >= maxEmlPdfs) break;
						try {
							const pr = await extractPdfTextFromUint8Array(att.decodedBytes);
							pdfLoadMs += pr.pdfLoadMs;
							pdfParseMs += pr.pdfParseMs;
							if (pr.text.trim()) {
								emlPdfSnippets.push(
									`--- PDF attachment: ${att.filename} (${pr.parsedPages}/${pr.pageCount} pages) ---\n${pr.text.trim()}`
								);
							}
						} catch {
							/* invalid or encrypted PDF */
						}
					}
					const emlPdfBlock = emlPdfSnippets.length ? emlPdfSnippets.join('\n\n') : '';

					let intentProvider = '';
					let intentLine = '';
					if (intentJson.ok && intentJson.data?.result) {
						const ir = intentJson.data.result;
						intentProvider = intentJson.data.provider ?? '';
						const kw =
							Array.isArray(ir.target_attachment_keywords) && ir.target_attachment_keywords.length
								? ir.target_attachment_keywords.slice(0, 6).join(', ')
								: '-';
						intentLine = ` | #1 ${intentProvider}: ${ir.email_type} (${(ir.confidence * 100).toFixed(0)}%), priority: ${ir.priority_attachment ?? '-'}, keywords: ${kw}`;
						emlClassifyHint = mapEmailIntentToClassifyHint(ir);
					} else {
						intentLine = intentJson.error ? ` | #1 failed: ${intentJson.error}` : '';
						emlClassifyHint = undefined;
					}

					const rankLine = rankProvider
						? ` | #2 ${rankProvider}: attachment rank (${ranked.length} items)`
						: '';

					emlSummary = `Subject: ${parsed.subject || '-'} | From: ${parsed.sender || '-'} | Attachments: ${parsed.attachments.length}${intentLine}${rankLine}`;

					const attachmentNamesStr = parsed.attachments.map((a) => a.filename).join(', ');
					raw = [
						parsed.subject ? `Subject: ${parsed.subject}` : '',
						parsed.sender ? `From: ${parsed.sender}` : '',
						attachmentNamesStr ? `Attachment list: ${attachmentNamesStr}` : '',
						parsed.bodyText,
						emlPdfBlock
					]
						.filter(Boolean)
						.join('\n')
						.trim();
					baseDetectMsg = `EML parsed, found ${parsed.attachments.length} attachment(s).`;
					if (emlPdfSnippets.length > 0) {
						baseDetectMsg += ` Extracted text from ${emlPdfSnippets.length} PDF attachment(s) (pdf.js, up to ${maxEmlPdfs} files, 8 pages each max).`;
					}
				} else {
					raw = await file.text();
					baseDetectMsg = 'Text file loaded.';
				}
			} else {
				detectStatus = 'unsupported';
				detectMessage =
					'Quick detection supports PDF (text layer + scanned page 1 via Workers AI), images (JPEG/PNG/WebP/GIF via Workers AI), text/csv, and eml.';
				return;
			}

			const normalized = raw.replace(/\s+/g, ' ').trim();
			rawDetectedText = raw;
			detectedTextPreview = normalized.slice(0, 600);

			const filenameHint = detectDocType(file.name);
			const allowedTypes = [
				'contract',
				'quotation',
				'purchase_order',
				'invoice_out',
				'invoice_in',
				'expense',
				'other'
			] as const;

			if (normalized.trim().length > 0) {
				detectMessage = `${baseDetectMsg} Analyzing document type…`;
				try {
					const cr = await fetch('/api/ocr/llm-classify', {
						method: 'POST',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify({
							text: raw.slice(0, 12000),
							hintDocType:
								emlClassifyHint ?? (filenameHint !== 'other' ? filenameHint : undefined)
						})
					});
					const payload = (await cr.json()) as {
						ok: boolean;
						data?: { provider: string; result: { docType: string; confidence: number; reason?: string } };
						error?: string;
					};
					if (
						payload.ok &&
						payload.data?.result &&
						allowedTypes.includes(payload.data.result.docType as (typeof allowedTypes)[number])
					) {
						selectedDocType = payload.data.result.docType;
						docTypeClassifyConfidence = payload.data.result.confidence;
						docTypeClassifyMessage = '';
						detectMessage = `${baseDetectMsg} Document type: ${docTypeLabel(selectedDocType)} (${payload.data.result.confidence}%).`;
					} else {
						if (filenameHint !== 'other') selectedDocType = filenameHint;
						docTypeClassifyConfidence = null;
						docTypeClassifyMessage = payload.error
							? `Classification failed: ${payload.error}. Filename hint applied if available.`
							: 'Classification returned no result; filename hint applied if available.';
						detectMessage = `${baseDetectMsg} ${docTypeClassifyMessage}`;
					}
				} catch {
					if (filenameHint !== 'other') selectedDocType = filenameHint;
					docTypeClassifyConfidence = null;
					docTypeClassifyMessage = 'Classification request failed; filename hint applied if available.';
					detectMessage = `${baseDetectMsg} ${docTypeClassifyMessage}`;
				}
			} else {
				if (filenameHint !== 'other') selectedDocType = filenameHint;
				docTypeClassifyConfidence = null;
				docTypeClassifyMessage =
					'No text extracted; content-based classification skipped. Filename hint applied if matched.';
				detectMessage = `${baseDetectMsg} ${docTypeClassifyMessage}`;
			}

			console.time('regex-extract');
			const regexStart = performance.now();
			applyExtractedFields(raw);
			const regexExtractMs = performance.now() - regexStart;
			console.timeEnd('regex-extract');
			const totalMs = performance.now() - totalStart;
			detectTiming = {
				pdfLoadMs,
				pdfParseMs,
				regexExtractMs,
				totalMs
			};
			console.log('[smartfin-detect-timing]', {
				fileName: file.name,
				pdfLoadMs: Number(pdfLoadMs.toFixed(1)),
				pdfParseMs: Number(pdfParseMs.toFixed(1)),
				regexExtractMs: Number(regexExtractMs.toFixed(1)),
				totalMs: Number(totalMs.toFixed(1))
			});

			if (detectedTextPreview) {
				detectStatus = 'done';
				detectMessage = detectMessage || 'Quick detection complete. Basic fields were auto-filled where possible.';
				llmStatus = 'idle';
				llmMessage = 'Text ready for AI detection.';
			} else {
				detectStatus = 'unsupported';
				detectMessage = isPdf
					? 'No readable text from this PDF and Workers AI OCR did not return usable text (check AI binding / model).'
					: 'No readable text found from this file.';
				llmStatus = 'idle';
				llmMessage = '';
				llmDetectedLines = [];
				llmFieldConfidence = {};
			}
		} catch (error) {
			detectStatus = 'error';
			detectMessage = error instanceof Error ? error.message : 'Quick detection failed.';
			const totalMs = performance.now() - totalStart;
			detectTiming = { totalMs };
			emlSummary = '';
			emlAttachments = [];
			llmStatus = 'idle';
			llmMessage = '';
			llmDetectedLines = [];
			llmFieldConfidence = {};
			docTypeClassifyMessage = '';
			docTypeClassifyConfidence = null;
			console.log('[smartfin-detect-timing]', {
				fileName: file.name,
				totalMs: Number(totalMs.toFixed(1)),
				error: detectMessage
			});
		}
	}

	function resetExtractedFields(): void {
		contractNo = '';
		contractDate = '';
		contractAmount = '';
		contractCurrency = 'SGD';
		quotationRef = '';
		quotationDate = '';
		quotationChannel = '';
		quotationAmount = '';
		quotationCurrency = 'SGD';
		poNumber = '';
		poSupplier = '';
		poDate = '';
		poAmount = '';
		poCurrency = 'SGD';
		invoiceOutNo = '';
		invoiceOutCustomer = '';
		invoiceOutDate = '';
		invoiceOutDueDate = '';
		invoiceOutTotal = '';
		invoiceOutCurrency = 'SGD';
		invoiceOutGstAmount = '0';
		invoiceOutGstType = 'standard';
		invoiceInNo = '';
		invoiceInSupplier = '';
		invoiceInDate = '';
		invoiceInPoNumber = '';
		invoiceInAmount = '';
		invoiceInCurrency = 'SGD';
		invoiceInGstAmount = '0';
		invoiceInDueDate = '';
		otherTag = '';
		otherRef = '';
		expenseCategory = '';
		expenseSubcategory = '';
		expenseAmount = '';
		expenseCurrency = 'SGD';
		expenseDate = '';
		expenseStaffName = '';
		expenseCostLayer = 'cogs';
		detectedTextPreview = '';
		rawDetectedText = '';
		detectTiming = null;
		detectStatus = 'idle';
		detectMessage = '';
		llmStatus = 'idle';
		llmMessage = '';
		llmDetectedLines = [];
		llmFieldConfidence = {};
		docTypeClassifyMessage = '';
		docTypeClassifyConfidence = null;
		emlSummary = '';
		emlAttachments = [];
	}

	function resetFileSelection(): void {
		if (filePreviewUrl) {
			URL.revokeObjectURL(filePreviewUrl);
			filePreviewUrl = null;
		}
		selectedFile = null;
		if (fileInputRef) fileInputRef.value = '';
		fileMeta = null;
		pendingBatchFiles = [];
		batchSourceArchiveName = null;
		batchCurrentIndex = 0;
	}

	async function saveDocument(): Promise<void> {
		if (!selectedFile || !data.selectedProject) {
			saveMessage = 'Select a project and upload a file first.';
			saveStatus = 'error';
			return;
		}

		saveStatus = 'saving';
		saveMessage = '';

		try {
			const entityId = crypto.randomUUID();
			const presignRes = await fetch('/api/upload/presign', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					fileName: selectedFile.name,
					contentType: selectedFile.type || 'application/octet-stream',
					projectId: data.selectedProject.id,
					entityType: selectedDocType,
					entityId
				})
			});
			const presignJson = (await presignRes.json()) as { ok?: boolean; error?: string; data?: { key: string; uploadUrl: string } };
			if (!presignJson.ok || !presignJson.data?.key || !presignJson.data?.uploadUrl) {
				throw new Error(presignJson.error || 'Could not start upload');
			}
			const { key, uploadUrl } = presignJson.data;

			const putRes = await fetch(uploadUrl, {
				method: 'PUT',
				headers: { 'Content-Type': selectedFile.type || 'application/octet-stream' },
				body: selectedFile
			});
			if (!putRes.ok) {
				throw new Error('Upload to storage failed');
			}

			const savePayload = {
				key,
				fileType: selectedFile.type || 'application/octet-stream',
				projectId: data.selectedProject.id,
				docType: selectedDocType,
				docTitle,
				docNotes,
				fileName: selectedFile.name,
				fileSize: selectedFile.size,
				rawDetectedText,
				contractNo,
				contractDate,
				contractAmount,
				contractCurrency,
				quotationRef,
				quotationDate,
				quotationChannel,
				quotationAmount,
				quotationCurrency,
				poNumber,
				poSupplier,
				poDate,
				poAmount,
				poCurrency,
				invoiceOutNo,
				invoiceOutCustomer,
				invoiceOutDate,
				invoiceOutDueDate,
				invoiceOutTotal,
				invoiceOutCurrency,
				invoiceOutGstAmount,
				invoiceOutGstType,
				invoiceInNo,
				invoiceInSupplier,
				invoiceInDate,
				invoiceInPoNumber,
				invoiceInAmount,
				invoiceInCurrency,
				invoiceInGstAmount,
				invoiceInDueDate,
				otherTag,
				otherRef,
				expenseCategory,
				expenseSubcategory,
				expenseAmount,
				expenseCurrency,
				expenseDate,
				expenseStaffName,
				expenseCostLayer
			};

			let saveRes = await fetch('/api/ar/save-project-document', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(savePayload)
			});
			let saveJson = (await saveRes.json()) as {
				ok?: boolean;
				error?: string;
				details?: unknown;
			};

			const duplicateInvoice =
				saveRes.status === 409 &&
				saveJson.details &&
				typeof saveJson.details === 'object' &&
				(saveJson.details as { code?: string }).code === 'DUPLICATE_INVOICE_NO';

			if (!saveJson.ok && duplicateInvoice && selectedDocType === 'invoice_out') {
				const inv = String((saveJson.details as { invoiceNo?: string }).invoiceNo ?? '');
				const proceed = window.confirm(
					`客户发票号码「${inv || '（当前填写）'}」在系统中已存在，可能是重复录入。\n\n` +
						`点「确定」：使用系统自动生成的新发票号保存（文档识别出的原号码会写入明细字段）。\n` +
						`点「取消」：不保存。`
				);
				if (!proceed) {
					saveStatus = 'idle';
					saveMessage = '已取消保存（发票号与其它记录重复）。';
					return;
				}
				saveRes = await fetch('/api/ar/save-project-document', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ ...savePayload, invoiceOutReissueNumber: true })
				});
				saveJson = (await saveRes.json()) as { ok?: boolean; error?: string };
			}

			if (!saveJson.ok) {
				const d = saveJson.details;
				const hint =
					typeof d === 'string'
						? d.slice(0, 280)
						: d != null
							? JSON.stringify(d).slice(0, 280)
							: '';
				throw new Error(
					hint ? `${saveJson.error || 'Save failed'} — ${hint}` : saveJson.error || 'Save failed'
				);
			}

			const hadBatch = pendingBatchFiles.length > 0;
			const advanceToNext = hadBatch && batchCurrentIndex + 1 < pendingBatchFiles.length;

			if (advanceToNext) {
				const nextIdx = batchCurrentIndex + 1;
				saveStatus = 'done';
				saveMessage = `Saved. Now on file ${nextIdx + 1} of ${pendingBatchFiles.length}.`;
				resetExtractedFields();
				docTitle = '';
				docNotes = '';
				applyQueuedFileAtIndex(nextIdx);
				return;
			}

			saveStatus = 'done';
			saveMessage =
				hadBatch && pendingBatchFiles.length > 1
					? `All ${pendingBatchFiles.length} files saved.`
					: 'Document saved.';
			resetExtractedFields();
			docTitle = '';
			docNotes = '';
			resetFileSelection();
		} catch (e) {
			saveStatus = 'error';
			saveMessage = e instanceof Error ? e.message : 'Save failed';
		}
	}

	async function onPickFile(event: Event): Promise<void> {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		resetExtractedFields();
		saveMessage = '';
		saveStatus = 'idle';
		zipUnpackError = '';

		if (isZipLike(file)) {
			zipUnpackBusy = true;
			try {
				const list = await unpackZipToFiles(file);
				if (list.length === 0) {
					zipUnpackError =
						'No supported files in this ZIP. Allowed: pdf, doc, docx, xls, xlsx, csv, png, jpg, jpeg, webp, eml, txt.';
					pendingBatchFiles = [];
					batchSourceArchiveName = null;
					batchCurrentIndex = 0;
					selectedFile = null;
					if (filePreviewUrl) {
						URL.revokeObjectURL(filePreviewUrl);
						filePreviewUrl = null;
					}
					fileMeta = null;
					return;
				}
				pendingBatchFiles = list;
				batchSourceArchiveName = file.name;
				batchCurrentIndex = 0;
				applyQueuedFileAtIndex(0);
			} catch (e) {
				uiZipError(e);
			} finally {
				zipUnpackBusy = false;
			}
			return;
		}

		pendingBatchFiles = [];
		batchSourceArchiveName = null;
		batchCurrentIndex = 0;
		applySinglePickedFile(file);
	}

	function uiZipError(e: unknown): void {
		zipUnpackError = e instanceof Error ? e.message : 'ZIP extraction failed.';
		pendingBatchFiles = [];
		batchSourceArchiveName = null;
		batchCurrentIndex = 0;
		selectedFile = null;
		if (filePreviewUrl) {
			URL.revokeObjectURL(filePreviewUrl);
			filePreviewUrl = null;
		}
		fileMeta = null;
	}

	// Database preview is intentionally removed from UI.
</script>

<section class="relative left-1/2 w-screen -translate-x-1/2 px-6 py-1">
	<div class="grid gap-4 lg:grid-cols-3">
		<div class="space-y-4">
			<section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
				<div class="flex items-start justify-between gap-3">
					<p class="text-xs font-semibold uppercase tracking-wide text-[var(--sf-green)]">AR / Document Upload / Project</p>
					<a
						href="/ar/document-upload"
						class="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
					>
						Back
					</a>
				</div>
				<h1 class="mt-1 text-xl font-semibold text-slate-900">Project-linked Document Upload</h1>
				<p class="mt-1 text-sm text-slate-600">Select project, upload document, then run quick extraction.</p>
				<p class="mt-2 text-xs text-slate-600">
					{#if data.selectedProject}
						Selected project: <span class="font-medium text-slate-800">{data.selectedProject.name}</span>
					{:else}
						No project selected yet.
					{/if}
				</p>
			</section>

			<section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
				<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Project Filter</p>
				<form class="mt-2 grid gap-2" method="GET" data-sveltekit-noscroll>
					<input type="hidden" name="page" value="1" />
					<input type="hidden" name="projectId" value={data.filters.projectId} />
					<input type="hidden" name="docType" value={selectedDocType} />
					<input class="w-full rounded border border-slate-300 px-3 py-2 text-sm" name="q" value={data.filters.q} placeholder="Name / ID / Customer" />
					<div class="grid grid-cols-2 gap-2">
						<select class="w-full rounded border border-slate-300 px-3 py-2 text-sm" name="status">
							<option value="">All status</option>
							<option value="active" selected={data.filters.status === 'active'}>active</option>
							<option value="on_hold" selected={data.filters.status === 'on_hold'}>on_hold</option>
							<option value="completed" selected={data.filters.status === 'completed'}>completed</option>
							<option value="archived" selected={data.filters.status === 'archived'}>archived</option>
						</select>
						<input class="w-full rounded border border-slate-300 px-3 py-2 text-sm" name="startedAfter" type="date" value={data.filters.startedAfter} />
					</div>
					<div class="grid grid-cols-2 gap-2">
						<button class="h-9 rounded border border-[var(--sf-green)] bg-[var(--sf-green)] text-sm font-medium text-white hover:bg-[#2f5e2c]" type="submit">
							Apply
						</button>
						<a class="inline-flex h-9 items-center justify-center rounded border border-[var(--sf-gold)] bg-[var(--sf-gold-soft)] text-sm font-medium text-[#7a5a07] hover:bg-[#f6e8b8]" href="/ar/document-upload/project" data-sveltekit-noscroll>
							Reset
						</a>
					</div>
				</form>

				<div class="mt-3 max-h-[240px] overflow-auto rounded-lg border border-slate-200">
					<table class="min-w-full divide-y divide-slate-200 text-xs">
						<thead class="bg-slate-50 text-left text-slate-600">
							<tr>
								<th class="px-2 py-2">Project</th>
								<th class="px-2 py-2">Action</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-100">
							{#each data.projects as project}
								<tr class={data.filters.projectId === project.id ? 'bg-[var(--sf-green-soft)]/50' : ''}>
									<td class="px-2 py-2">
										<p class="font-medium text-slate-800">{project.name}</p>
										<p class="text-slate-500">{project.id}</p>
									</td>
									<td class="px-2 py-2">
										<a
											class="rounded border border-slate-300 bg-white px-2 py-1 text-slate-700 hover:bg-slate-100"
											href={`/ar/document-upload/project?q=${encodeURIComponent(data.filters.q)}&status=${encodeURIComponent(data.filters.status)}&startedAfter=${encodeURIComponent(data.filters.startedAfter)}&page=${data.filters.page}&projectId=${encodeURIComponent(project.id)}&docType=${encodeURIComponent(selectedDocType)}`}
											data-sveltekit-noscroll
										>
											Select
										</a>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				<div class="mt-2 flex items-center justify-between text-xs text-slate-600">
					<p>{data.pagination.page}/{data.pagination.totalPages}</p>
					<div class="flex gap-2">
						{#if data.pagination.hasPrev}
							<a class="rounded border border-slate-300 bg-white px-2 py-1 hover:bg-slate-100" href={`/ar/document-upload/project?q=${encodeURIComponent(data.filters.q)}&status=${encodeURIComponent(data.filters.status)}&startedAfter=${encodeURIComponent(data.filters.startedAfter)}&page=${data.pagination.page - 1}&projectId=${encodeURIComponent(data.filters.projectId)}&docType=${encodeURIComponent(selectedDocType)}`} data-sveltekit-noscroll>
								Prev
							</a>
						{/if}
						{#if data.pagination.hasNext}
							<a class="rounded border border-slate-300 bg-white px-2 py-1 hover:bg-slate-100" href={`/ar/document-upload/project?q=${encodeURIComponent(data.filters.q)}&status=${encodeURIComponent(data.filters.status)}&startedAfter=${encodeURIComponent(data.filters.startedAfter)}&page=${data.pagination.page + 1}&projectId=${encodeURIComponent(data.filters.projectId)}&docType=${encodeURIComponent(selectedDocType)}`} data-sveltekit-noscroll>
								Next
							</a>
						{/if}
					</div>
				</div>
			</section>

			<section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
				<div class="flex items-center justify-between gap-2">
					<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">File Upload</p>
					<input
						bind:this={fileInputRef}
						type="file"
						class="hidden"
						accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.webp,.eml,.txt,.zip,application/zip"
						onchange={(ev) => void onPickFile(ev)}
					/>
					<button
						type="button"
						class="inline-flex items-center rounded border border-[var(--sf-gold)] bg-[var(--sf-gold-soft)] px-3 py-2 text-xs font-medium text-[#7a5a07] hover:bg-[#f6e8b8]"
						onclick={() => fileInputRef?.click()}
					>
						Upload Document
					</button>
				</div>
				<p class="mt-2 text-[11px] leading-relaxed text-slate-500">
					You can upload a <span class="font-medium text-slate-600">.zip</span> containing multiple documents. Supported entries are extracted in
					path order, quick-detected on the first file automatically, and you can move through the queue with <strong>Previous / Next</strong>
					or save to advance to the next file.
				</p>
				{#if zipUnpackBusy}
					<p class="mt-2 text-xs font-medium text-[var(--sf-green)]">Extracting ZIP…</p>
				{/if}
				{#if zipUnpackError}
					<p class="mt-2 text-xs text-rose-600">{zipUnpackError}</p>
				{/if}
				{#if pendingBatchFiles.length > 0}
					<div
						class="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700"
					>
						<span class="font-medium">
							File {batchCurrentIndex + 1} of {pendingBatchFiles.length}
							{#if batchSourceArchiveName}
								<span class="font-normal text-slate-500"> · from {batchSourceArchiveName}</span>
							{/if}
						</span>
						<button
							type="button"
							class="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
							disabled={batchCurrentIndex <= 0 || detectStatus === 'analyzing' || saveStatus === 'saving' || zipUnpackBusy}
							onclick={() => navigateBatch(-1)}
						>
							Previous
						</button>
						<button
							type="button"
							class="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
							disabled={batchCurrentIndex >= pendingBatchFiles.length - 1 ||
								detectStatus === 'analyzing' ||
								saveStatus === 'saving' ||
								zipUnpackBusy}
							onclick={() => navigateBatch(1)}
						>
							Next
						</button>
					</div>
				{/if}
				{#if fileMeta}
					<div class="mt-2 rounded-lg border border-[var(--sf-gold)]/45 bg-[var(--sf-gold-soft)]/35 p-3 text-xs text-slate-700">
						<p><span class="font-medium">Name:</span> {fileMeta.name}</p>
						<p><span class="font-medium">Type:</span> {fileMeta.type}</p>
						<p><span class="font-medium">Size:</span> {fileMeta.sizeLabel}</p>
						<p><span class="font-medium">Last Modified:</span> {fileMeta.lastModified}</p>
						{#if detectStatus !== 'idle'}
							<p class="mt-1"><span class="font-medium">Quick:</span> {detectMessage}</p>
						{/if}
						{#if llmStatus !== 'idle'}
							<p class="mt-1"><span class="font-medium">LLM:</span> {llmMessage}</p>
						{/if}
						{#if detectTiming}
							<p class="mt-1">
								<span class="font-medium">Timing:</span>
								{#if detectTiming.pdfLoadMs !== undefined} load={detectTiming.pdfLoadMs.toFixed(1)}ms {/if}
								{#if detectTiming.pdfParseMs !== undefined} parse={detectTiming.pdfParseMs.toFixed(1)}ms {/if}
								{#if detectTiming.regexExtractMs !== undefined} regex={detectTiming.regexExtractMs.toFixed(1)}ms {/if}
								total={detectTiming.totalMs?.toFixed(1)}ms
							</p>
						{/if}
						{#if emlSummary}
							<p class="mt-1"><span class="font-medium">EML:</span> {emlSummary}</p>
						{/if}
						{#if emlAttachments.length > 0}
							<div class="mt-2 rounded border border-slate-200 bg-white p-2">
								<p class="font-medium text-slate-700">Detected Attachments (Top Candidates)</p>
								<div class="mt-1 space-y-1">
									{#each emlAttachments as item}
										<p class={item.isLikelyTarget ? 'text-emerald-700' : 'text-slate-700'}>
											{item.isLikelyTarget ? '★ ' : ''}{item.filename}
											({item.mimeType}, {item.sizeLabel}, rule {item.score})
											{item.keywords.length ? ` | keywords: ${item.keywords.join(', ')}` : ''}
											{#if item.llmConfidence !== undefined}
												{' '}| LLM rank {item.llmConfidence.toFixed(2)}
												{item.llmReason ? ` (${item.llmReason})` : ''}
											{/if}
										</p>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				{/if}
			</section>
		</div>

		<section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
			<div class="flex items-center justify-between gap-3">
				<div class="flex items-center gap-3">
					<p class="text-xs font-semibold uppercase tracking-wide text-[var(--sf-green)]">Document Details</p>
					<button
						type="button"
						class="min-w-[132px] rounded border border-[var(--sf-green)] bg-[var(--sf-green)] px-4 py-2 text-xs font-medium text-white hover:bg-[#2f5e2c] disabled:cursor-not-allowed disabled:opacity-50"
						disabled={!rawDetectedText || llmStatus === 'analyzing'}
						onclick={() => void runLlmRefinement(rawDetectedText)}
					>
						{llmStatus === 'analyzing' ? 'AI Detecting...' : 'AI Autofill'}
					</button>
				</div>
				<div class="flex flex-col items-end gap-1">
					<button
						type="button"
						class="rounded border border-[var(--sf-gold)] bg-white px-4 py-2 text-xs font-semibold text-[#b08a14] hover:bg-[var(--sf-gold-soft)] disabled:cursor-not-allowed disabled:opacity-50"
						disabled={!data.selectedProject || !selectedFile || saveStatus === 'saving'}
						onclick={() => void saveDocument()}
					>
						{saveStatus === 'saving' ? 'Saving…' : 'Save Document'}
					</button>
					{#if saveMessage}
						<p
							class="max-w-[220px] text-right text-[11px] {saveStatus === 'error'
								? 'text-rose-600'
								: saveStatus === 'done'
									? 'text-emerald-700'
									: 'text-slate-500'}"
						>
							{saveMessage}
						</p>
					{/if}
				</div>
			</div>

			<div class="mt-3 grid gap-3 md:grid-cols-2">
				<label class="space-y-1">
					<span class="text-xs font-medium text-slate-600">Document Type</span>
					<select class="w-full rounded border border-slate-300 px-3 py-2 text-sm" bind:value={selectedDocType}>
						<option value="contract">Contract</option>
						<option value="quotation">Quotation</option>
						<option value="purchase_order">Purchase Order</option>
						<option value="invoice_out">Customer Invoice</option>
						<option value="invoice_in">Supplier Invoice</option>
						<option value="expense">Company expense / receipt</option>
						<option value="other">Other (unclassified)</option>
					</select>
					{#if docTypeClassifyConfidence !== null}
						<p class="text-xs text-slate-500">Confidence: {docTypeClassifyConfidence}%</p>
					{/if}
				</label>
				<label class="space-y-1">
					<span class="text-xs font-medium text-slate-600">Document Title</span>
					<input
						class="w-full rounded border border-slate-300 px-3 py-2 text-sm"
						placeholder="Enter a clear title"
						bind:value={docTitle}
					/>
				</label>
			</div>

			<div class="mt-3">
				{#if selectedDocType === 'contract'}
					<div class="grid gap-3 md:grid-cols-3">
						<label class="space-y-1">
							<span class="text-xs font-medium text-slate-600">Contract No</span>
							<input class="w-full rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Contract No" bind:value={contractNo} />
							{#if llmFieldConfidence.contractNo}
								<p class={`text-xs ${confidenceClass(llmFieldConfidence.contractNo)}`}>AI confidence: {llmFieldConfidence.contractNo}%</p>
							{/if}
						</label>
						<label class="space-y-1">
							<span class="text-xs font-medium text-slate-600">Date</span>
							<input class="w-full rounded border border-slate-300 px-3 py-2 text-sm" type="date" bind:value={contractDate} />
							{#if llmFieldConfidence.contractDate}
								<p class={`text-xs ${confidenceClass(llmFieldConfidence.contractDate)}`}>AI confidence: {llmFieldConfidence.contractDate}%</p>
							{/if}
						</label>
						<label class="space-y-1">
							<span class="text-xs font-medium text-slate-600">Amount</span>
							<input class="w-full rounded border border-slate-300 px-3 py-2 text-sm" type="number" step="0.01" placeholder="Contract Amount" bind:value={contractAmount} />
							{#if llmFieldConfidence.contractAmount}
								<p class={`text-xs ${confidenceClass(llmFieldConfidence.contractAmount)}`}>AI confidence: {llmFieldConfidence.contractAmount}%</p>
							{/if}
						</label>
						<label class="space-y-1">
							<span class="text-xs font-medium text-slate-600">Currency</span>
							<input class="w-full rounded border border-slate-300 px-3 py-2 text-sm" placeholder="SGD" bind:value={contractCurrency} />
							{#if llmFieldConfidence.contractCurrency}
								<p class={`text-xs ${confidenceClass(llmFieldConfidence.contractCurrency)}`}>AI confidence: {llmFieldConfidence.contractCurrency}%</p>
							{/if}
						</label>
					</div>
				{:else if selectedDocType === 'quotation'}
					<div class="grid gap-3 md:grid-cols-3">
						<label class="space-y-1">
							<span class="text-xs font-medium text-slate-600">Quotation Ref</span>
							<input class="w-full rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Quotation Ref" bind:value={quotationRef} />
							{#if llmFieldConfidence.quotationRef}
								<p class={`text-xs ${confidenceClass(llmFieldConfidence.quotationRef)}`}>AI confidence: {llmFieldConfidence.quotationRef}%</p>
							{/if}
						</label>
						<label class="space-y-1">
							<span class="text-xs font-medium text-slate-600">Date</span>
							<input class="w-full rounded border border-slate-300 px-3 py-2 text-sm" type="date" bind:value={quotationDate} />
							{#if llmFieldConfidence.quotationDate}
								<p class={`text-xs ${confidenceClass(llmFieldConfidence.quotationDate)}`}>AI confidence: {llmFieldConfidence.quotationDate}%</p>
							{/if}
						</label>
						<label class="space-y-1">
							<span class="text-xs font-medium text-slate-600">Amount</span>
							<input class="w-full rounded border border-slate-300 px-3 py-2 text-sm" type="number" step="0.01" placeholder="Quoted Amount" bind:value={quotationAmount} />
							{#if llmFieldConfidence.quotationAmount}
								<p class={`text-xs ${confidenceClass(llmFieldConfidence.quotationAmount)}`}>AI confidence: {llmFieldConfidence.quotationAmount}%</p>
							{/if}
						</label>
						<label class="space-y-1 md:col-span-3">
							<span class="text-xs font-medium text-slate-600">Source Channel</span>
							<input class="w-full rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Source Channel (email/pdf/chat)" bind:value={quotationChannel} />
							{#if llmFieldConfidence.quotationChannel}
								<p class={`text-xs ${confidenceClass(llmFieldConfidence.quotationChannel)}`}>AI confidence: {llmFieldConfidence.quotationChannel}%</p>
							{/if}
						</label>
						<label class="space-y-1">
							<span class="text-xs font-medium text-slate-600">Currency</span>
							<input class="w-full rounded border border-slate-300 px-3 py-2 text-sm" placeholder="SGD" bind:value={quotationCurrency} />
						</label>
					</div>
				{:else if selectedDocType === 'purchase_order'}
					<div class="grid gap-3 md:grid-cols-3">
						<label class="space-y-1">
							<span class="text-xs font-medium text-slate-600">PO Number</span>
							<input class="w-full rounded border border-slate-300 px-3 py-2 text-sm" placeholder="PO Number" bind:value={poNumber} />
							{#if llmFieldConfidence.poNumber}
								<p class={`text-xs ${confidenceClass(llmFieldConfidence.poNumber)}`}>AI confidence: {llmFieldConfidence.poNumber}%</p>
							{/if}
						</label>
						<label class="space-y-1">
							<span class="text-xs font-medium text-slate-600">Supplier Name</span>
							<input class="w-full rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Supplier Name" bind:value={poSupplier} />
							{#if llmFieldConfidence.poSupplier}
								<p class={`text-xs ${confidenceClass(llmFieldConfidence.poSupplier)}`}>AI confidence: {llmFieldConfidence.poSupplier}%</p>
							{/if}
						</label>
						<label class="space-y-1">
							<span class="text-xs font-medium text-slate-600">Amount</span>
							<input class="w-full rounded border border-slate-300 px-3 py-2 text-sm" type="number" step="0.01" placeholder="PO Amount" bind:value={poAmount} />
							{#if llmFieldConfidence.poAmount}
								<p class={`text-xs ${confidenceClass(llmFieldConfidence.poAmount)}`}>AI confidence: {llmFieldConfidence.poAmount}%</p>
							{/if}
						</label>
						<label class="space-y-1">
							<span class="text-xs font-medium text-slate-600">Date</span>
							<input class="w-full rounded border border-slate-300 px-3 py-2 text-sm" type="date" bind:value={poDate} />
							{#if llmFieldConfidence.poDate}
								<p class={`text-xs ${confidenceClass(llmFieldConfidence.poDate)}`}>AI confidence: {llmFieldConfidence.poDate}%</p>
							{/if}
						</label>
						<label class="space-y-1">
							<span class="text-xs font-medium text-slate-600">Currency</span>
							<input class="w-full rounded border border-slate-300 px-3 py-2 text-sm" placeholder="SGD" bind:value={poCurrency} />
							{#if llmFieldConfidence.poCurrency}
								<p class={`text-xs ${confidenceClass(llmFieldConfidence.poCurrency)}`}>AI confidence: {llmFieldConfidence.poCurrency}%</p>
							{/if}
						</label>
					</div>
				{:else if selectedDocType === 'invoice_out'}
					<div class="grid gap-3 md:grid-cols-3">
						<label class="space-y-1">
							<span class="text-xs font-medium text-slate-600">Invoice No</span>
							<input class="w-full rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Invoice No" bind:value={invoiceOutNo} />
							{#if llmFieldConfidence.invoiceOutNo}
								<p class={`text-xs ${confidenceClass(llmFieldConfidence.invoiceOutNo)}`}>AI confidence: {llmFieldConfidence.invoiceOutNo}%</p>
							{/if}
						</label>
						<label class="space-y-1">
							<span class="text-xs font-medium text-slate-600">Customer Name</span>
							<input class="w-full rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Customer Name" bind:value={invoiceOutCustomer} />
							{#if llmFieldConfidence.invoiceOutCustomer}
								<p class={`text-xs ${confidenceClass(llmFieldConfidence.invoiceOutCustomer)}`}>AI confidence: {llmFieldConfidence.invoiceOutCustomer}%</p>
							{/if}
						</label>
						<label class="space-y-1">
							<span class="text-xs font-medium text-slate-600">Amount</span>
							<input class="w-full rounded border border-slate-300 px-3 py-2 text-sm" type="number" step="0.01" placeholder="Invoice Total" bind:value={invoiceOutTotal} />
							{#if llmFieldConfidence.invoiceOutTotal}
								<p class={`text-xs ${confidenceClass(llmFieldConfidence.invoiceOutTotal)}`}>AI confidence: {llmFieldConfidence.invoiceOutTotal}%</p>
							{/if}
						</label>
						<label class="space-y-1">
							<span class="text-xs font-medium text-slate-600">Date</span>
							<input class="w-full rounded border border-slate-300 px-3 py-2 text-sm" type="date" bind:value={invoiceOutDate} />
							{#if llmFieldConfidence.invoiceOutDate}
								<p class={`text-xs ${confidenceClass(llmFieldConfidence.invoiceOutDate)}`}>AI confidence: {llmFieldConfidence.invoiceOutDate}%</p>
							{/if}
						</label>
						<label class="space-y-1">
							<span class="text-xs font-medium text-slate-600">Due Date</span>
							<input class="w-full rounded border border-slate-300 px-3 py-2 text-sm" type="date" bind:value={invoiceOutDueDate} />
							{#if llmFieldConfidence.invoiceOutDueDate}
								<p class={`text-xs ${confidenceClass(llmFieldConfidence.invoiceOutDueDate)}`}>AI confidence: {llmFieldConfidence.invoiceOutDueDate}%</p>
							{/if}
						</label>
						<label class="space-y-1">
							<span class="text-xs font-medium text-slate-600">Currency</span>
							<input class="w-full rounded border border-slate-300 px-3 py-2 text-sm" placeholder="SGD" bind:value={invoiceOutCurrency} />
							{#if llmFieldConfidence.invoiceOutCurrency}
								<p class={`text-xs ${confidenceClass(llmFieldConfidence.invoiceOutCurrency)}`}>AI confidence: {llmFieldConfidence.invoiceOutCurrency}%</p>
							{/if}
						</label>
						<label class="space-y-1">
							<span class="text-xs font-medium text-slate-600">GST Amount</span>
							<input class="w-full rounded border border-slate-300 px-3 py-2 text-sm" type="number" step="0.01" bind:value={invoiceOutGstAmount} />
							{#if llmFieldConfidence.invoiceOutGstAmount}
								<p class={`text-xs ${confidenceClass(llmFieldConfidence.invoiceOutGstAmount)}`}>AI confidence: {llmFieldConfidence.invoiceOutGstAmount}%</p>
							{/if}
						</label>
						<label class="space-y-1">
							<span class="text-xs font-medium text-slate-600">GST Type</span>
							<select class="w-full rounded border border-slate-300 px-3 py-2 text-sm" bind:value={invoiceOutGstType}>
								<option value="standard">standard</option>
								<option value="zero">zero</option>
								<option value="exempt">exempt</option>
							</select>
						</label>
					</div>
				{:else if selectedDocType === 'invoice_in'}
					<div class="grid gap-3 md:grid-cols-3">
						<label class="space-y-1">
							<span class="text-xs font-medium text-slate-600">Supplier Invoice No</span>
							<input class="w-full rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Supplier Invoice No" bind:value={invoiceInNo} />
							{#if llmFieldConfidence.invoiceInNo}
								<p class={`text-xs ${confidenceClass(llmFieldConfidence.invoiceInNo)}`}>AI confidence: {llmFieldConfidence.invoiceInNo}%</p>
							{/if}
						</label>
						<label class="space-y-1">
							<span class="text-xs font-medium text-slate-600">PO Number (if any)</span>
							<input class="w-full rounded border border-slate-300 px-3 py-2 text-sm" placeholder="PO Number (if any)" bind:value={invoiceInPoNumber} />
							{#if llmFieldConfidence.invoiceInPoNumber}
								<p class={`text-xs ${confidenceClass(llmFieldConfidence.invoiceInPoNumber)}`}>AI confidence: {llmFieldConfidence.invoiceInPoNumber}%</p>
							{/if}
						</label>
						<label class="space-y-1">
							<span class="text-xs font-medium text-slate-600">Amount</span>
							<input class="w-full rounded border border-slate-300 px-3 py-2 text-sm" type="number" step="0.01" placeholder="Invoice Amount" bind:value={invoiceInAmount} />
							{#if llmFieldConfidence.invoiceInAmount}
								<p class={`text-xs ${confidenceClass(llmFieldConfidence.invoiceInAmount)}`}>AI confidence: {llmFieldConfidence.invoiceInAmount}%</p>
							{/if}
						</label>
						<label class="space-y-1">
							<span class="text-xs font-medium text-slate-600">Supplier Name</span>
							<input class="w-full rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Supplier Name" bind:value={invoiceInSupplier} />
							{#if llmFieldConfidence.invoiceInSupplier}
								<p class={`text-xs ${confidenceClass(llmFieldConfidence.invoiceInSupplier)}`}>AI confidence: {llmFieldConfidence.invoiceInSupplier}%</p>
							{/if}
						</label>
						<label class="space-y-1">
							<span class="text-xs font-medium text-slate-600">Date</span>
							<input class="w-full rounded border border-slate-300 px-3 py-2 text-sm" type="date" bind:value={invoiceInDate} />
							{#if llmFieldConfidence.invoiceInDate}
								<p class={`text-xs ${confidenceClass(llmFieldConfidence.invoiceInDate)}`}>AI confidence: {llmFieldConfidence.invoiceInDate}%</p>
							{/if}
						</label>
						<label class="space-y-1">
							<span class="text-xs font-medium text-slate-600">Due Date</span>
							<input class="w-full rounded border border-slate-300 px-3 py-2 text-sm" type="date" bind:value={invoiceInDueDate} />
							{#if llmFieldConfidence.invoiceInDueDate}
								<p class={`text-xs ${confidenceClass(llmFieldConfidence.invoiceInDueDate)}`}>AI confidence: {llmFieldConfidence.invoiceInDueDate}%</p>
							{/if}
						</label>
						<label class="space-y-1">
							<span class="text-xs font-medium text-slate-600">Currency</span>
							<input class="w-full rounded border border-slate-300 px-3 py-2 text-sm" placeholder="SGD" bind:value={invoiceInCurrency} />
							{#if llmFieldConfidence.invoiceInCurrency}
								<p class={`text-xs ${confidenceClass(llmFieldConfidence.invoiceInCurrency)}`}>AI confidence: {llmFieldConfidence.invoiceInCurrency}%</p>
							{/if}
						</label>
						<label class="space-y-1">
							<span class="text-xs font-medium text-slate-600">GST Amount</span>
							<input class="w-full rounded border border-slate-300 px-3 py-2 text-sm" type="number" step="0.01" bind:value={invoiceInGstAmount} />
							{#if llmFieldConfidence.invoiceInGstAmount}
								<p class={`text-xs ${confidenceClass(llmFieldConfidence.invoiceInGstAmount)}`}>AI confidence: {llmFieldConfidence.invoiceInGstAmount}%</p>
							{/if}
						</label>
					</div>
				{:else if selectedDocType === 'expense'}
					<div class="grid gap-3 md:grid-cols-3">
						<label class="space-y-1 md:col-span-3">
							<span class="text-xs font-medium text-slate-600">Category</span>
							<input
								class="w-full rounded border border-slate-300 px-3 py-2 text-sm"
								placeholder="e.g. Transport, Meals, Software subscription"
								bind:value={expenseCategory}
							/>
							{#if llmFieldConfidence.expenseCategory}
								<p class={`text-xs ${confidenceClass(llmFieldConfidence.expenseCategory)}`}>
									AI confidence: {llmFieldConfidence.expenseCategory}%
								</p>
							{/if}
						</label>
						<label class="space-y-1">
							<span class="text-xs font-medium text-slate-600">Subcategory</span>
							<input class="w-full rounded border border-slate-300 px-3 py-2 text-sm" bind:value={expenseSubcategory} />
						</label>
						<label class="space-y-1">
							<span class="text-xs font-medium text-slate-600">Amount</span>
							<input class="w-full rounded border border-slate-300 px-3 py-2 text-sm" type="number" step="0.01" bind:value={expenseAmount} />
							{#if llmFieldConfidence.expenseAmount}
								<p class={`text-xs ${confidenceClass(llmFieldConfidence.expenseAmount)}`}>AI confidence: {llmFieldConfidence.expenseAmount}%</p>
							{/if}
						</label>
						<label class="space-y-1">
							<span class="text-xs font-medium text-slate-600">Currency</span>
							<input class="w-full rounded border border-slate-300 px-3 py-2 text-sm" bind:value={expenseCurrency} />
						</label>
						<label class="space-y-1">
							<span class="text-xs font-medium text-slate-600">Date</span>
							<input class="w-full rounded border border-slate-300 px-3 py-2 text-sm" type="date" bind:value={expenseDate} />
						</label>
						<label class="space-y-1 md:col-span-2">
							<span class="text-xs font-medium text-slate-600">Staff (optional)</span>
							<input class="w-full rounded border border-slate-300 px-3 py-2 text-sm" bind:value={expenseStaffName} />
						</label>
						<label class="space-y-1 md:col-span-3">
							<span class="text-xs font-medium text-slate-600">Cost layer (project P&amp;L)</span>
							<select class="w-full rounded border border-slate-300 px-3 py-2 text-sm" bind:value={expenseCostLayer}>
								<option value="cogs">COGS — logistics, materials paid by card, direct project spend</option>
								<option value="opex">OpEx — BD meals, subscriptions, indirect costs charged to project</option>
							</select>
						</label>
					</div>
				{:else}
					<div class="space-y-2">
						<p class="text-xs text-slate-500">
							Use this only for scans that are not ready to book as contracts, invoices, or company expenses. Prefer
							<strong>Company expense / receipt</strong> for Grab receipts, subscriptions, and petty cash without a supplier tax invoice.
						</p>
						<div class="grid gap-3 md:grid-cols-2">
						<label class="space-y-1">
							<span class="text-xs font-medium text-slate-600">Document Tag / Category</span>
							<input class="w-full rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Document Tag / Category" bind:value={otherTag} />
						</label>
						<label class="space-y-1">
							<span class="text-xs font-medium text-slate-600">Reference No (optional)</span>
							<input class="w-full rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Reference No (optional)" bind:value={otherRef} />
						</label>
						</div>
					</div>
				{/if}
			</div>

			<div class="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
				<div class="space-y-3">
					<div class="space-y-1">
						<span class="text-xs font-medium text-slate-600">Info Detection Result</span>
						<div class="min-h-[120px] rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700">
							{#if llmDetectedLines.length > 0}
								{#each llmDetectedLines as line}
									<p>{line}</p>
								{/each}
							{:else}
								<p class="text-slate-500">No LLM key info yet. Click AI Autofill.</p>
							{/if}
						</div>
					</div>
					<textarea
						class="min-h-[100px] w-full rounded border border-slate-300 px-3 py-2 text-sm"
						placeholder="Type document notes / extracted key points here..."
						bind:value={docNotes}
					></textarea>
				</div>
				<div class="flex flex-col gap-2">
				</div>
			</div>
		</section>

		<section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
			<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Document Preview</p>
			<div class="mt-2 min-h-[260px] overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
				{#if selectedFile && filePreviewUrl && selectedFile.type.includes('pdf')}
					<iframe src={filePreviewUrl} class="h-[320px] w-full" title="PDF Preview"></iframe>
				{:else if selectedFile && filePreviewUrl && selectedFile.type.startsWith('image/')}
					<img src={filePreviewUrl} alt="Uploaded file preview" class="h-[320px] w-full object-contain" />
				{:else}
					<div class="flex h-[320px] items-center justify-center px-4 text-sm text-slate-500">
						Upload a PDF or image to preview the document.
					</div>
				{/if}
			</div>

			<p class="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Text Extraction Result</p>
			<div class="mt-2 min-h-[220px] max-h-[320px] overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
				{#if rawDetectedText}
					<p class="whitespace-pre-wrap break-words">{rawDetectedText.slice(0, 5000)}</p>
				{:else}
					<p class="text-slate-500">No extracted text yet.</p>
				{/if}
			</div>
		</section>
	</div>
</section>
