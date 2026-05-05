import { strFromU8, unzipSync } from 'fflate';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** ZIP local file header signature */
export function looksLikeZip(data: ArrayBuffer): boolean {
	const u8 = new Uint8Array(data);
	return u8.length >= 4 && u8[0] === 0x50 && u8[1] === 0x4b && (u8[2] === 0x03 || u8[2] === 0x05 || u8[2] === 0x07);
}

/** Word 97–2003 compound document */
export function looksLikeLegacyWordDoc(data: ArrayBuffer): boolean {
	const u8 = new Uint8Array(data);
	return u8.length >= 8 && u8[0] === 0xd0 && u8[1] === 0xcf && u8[2] === 0x11 && u8[3] === 0xe0;
}

export function isLikelyDocxMimeOrName(fileType: string, fileName: string): boolean {
	const ft = (fileType || '').toLowerCase();
	const name = (fileName || '').toLowerCase();
	if (ft.includes('wordprocessingml.document') || ft === DOCX_MIME) return true;
	return /\.docx$/i.test(name);
}

export function isLegacyDocMimeOrName(fileType: string, fileName: string): boolean {
	const ft = (fileType || '').toLowerCase();
	const name = (fileName || '').toLowerCase();
	if (ft === 'application/msword') return true;
	return /\.doc$/i.test(name) && !/\.docx$/i.test(name);
}

function hasWordDocumentXml(data: ArrayBuffer): boolean {
	try {
		const files = unzipSync(new Uint8Array(data));
		return typeof files['word/document.xml'] !== 'undefined';
	} catch {
		return false;
	}
}

/** Whether to parse as .docx (MIME/extension, or ZIP contains word/document.xml) */
export function shouldParseAsDocx(fileType: string, fileName: string, data: ArrayBuffer): boolean {
	if (looksLikeLegacyWordDoc(data) && !looksLikeZip(data)) return false;
	if (isLikelyDocxMimeOrName(fileType, fileName)) return true;
	if (looksLikeZip(data) && hasWordDocumentXml(data)) return true;
	return false;
}

function decodeXmlTextChunk(s: string): string {
	if (!s) return '';
	let t = s.replace(/<[^>]+>/g, '');
	return t
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&#(\d+);/g, (_, n) => {
			const code = Number(n);
			return Number.isFinite(code) ? String.fromCodePoint(code) : _;
		})
		.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => {
			const code = parseInt(h, 16);
			return Number.isFinite(code) ? String.fromCodePoint(code) : _;
		});
}

/** Extract paragraph text from Office Open XML word/document.xml */
export function documentXmlToPlainText(xml: string): string {
	const paragraphs: string[] = [];
	const pRegex = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;
	let m: RegExpExecArray | null;
	while ((m = pRegex.exec(xml)) !== null) {
		const pxml = m[0];
		const parts: string[] = [];
		const tRe = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
		let tm: RegExpExecArray | null;
		while ((tm = tRe.exec(pxml)) !== null) {
			parts.push(decodeXmlTextChunk(tm[1]));
		}
		const line = parts.join('').replace(/\s+/g, ' ').trim();
		if (line) paragraphs.push(line);
	}
	if (paragraphs.length > 0) {
		return paragraphs.join('\n').trim();
	}
	const parts: string[] = [];
	const tRe = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
	while ((m = tRe.exec(xml)) !== null) {
		parts.push(decodeXmlTextChunk(m[1]));
	}
	return parts.join(' ').replace(/\s+/g, ' ').trim();
}

export function extractDocxPlainText(data: ArrayBuffer): string {
	const u8 = new Uint8Array(data);
	let files: Record<string, Uint8Array>;
	try {
		files = unzipSync(u8);
	} catch {
		throw new Error('Not a valid .docx (ZIP) file.');
	}
	const docXml = files['word/document.xml'];
	if (!docXml) {
		throw new Error('Invalid .docx: missing word/document.xml.');
	}
	const xml = strFromU8(docXml, false);
	return documentXmlToPlainText(xml);
}

export function tryExtractDocxPlainText(data: ArrayBuffer): string | null {
	try {
		const t = extractDocxPlainText(data).trim();
		return t.length ? t : null;
	} catch {
		return null;
	}
}
