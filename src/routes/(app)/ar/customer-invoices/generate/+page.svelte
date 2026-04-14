<script lang="ts">
	import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
	import { tick } from 'svelte';
	import PageShell from '$lib/components/PageShell.svelte';
	import companyLogo from '$lib/assets/favicon.png';
	import { agentPrefill, consumePrefill } from '$lib/agent/prefill';

	type ProjectRow = {
		id: string;
		name: string;
		customerId: string;
		customerName: string | null;
		customerAddress: string | null;
	};

	type CustomCol = { id: string; key: string; label: string };
	type LineItem = {
		id: string;
		itemName: string;
		description: string;
		qty: string;
		uom: string;
		unitPrice: string;
		extras: Record<string, string>;
	};

	let { data } = $props();
	const editing = data.editingInvoice;

	const today = new Date();
	const ymd = (d: Date) => d.toISOString().slice(0, 10);
	const addDays = (d: Date, n: number) => {
		const x = new Date(d);
		x.setDate(x.getDate() + n);
		return x;
	};

	function newLine(): LineItem {
		return {
			id: crypto.randomUUID(),
			itemName: '',
			description: '',
			qty: '1',
			uom: 'EA',
			unitPrice: '0',
			extras: {}
		};
	}

	let fromName = $state(String((editing?.generator?.fromName as string | undefined) ?? 'AXIOM TECH PTE LTD'));
	let fromAddr = $state(
		String(
			(editing?.generator?.fromAddr as string | undefined) ??
				'5008 Ang Mo Kio Ave 5, #04-09 (Mo4)\nTechplace II, Singapore 569874'
		)
	);
	let gstReg = $state(String((editing?.generator?.gstReg as string | undefined) ?? '{replace by GST Reg No}'));

	let toName = $state(String((editing?.generator?.toName as string | undefined) ?? ''));
	let toAddr = $state(String((editing?.generator?.toAddr as string | undefined) ?? ''));
	let toAttn = $state(String((editing?.generator?.toAttn as string | undefined) ?? ''));

	let invoiceNo = $state(editing?.invoiceNo ?? `INV-${today.getFullYear()}-${String(Date.now()).slice(-6)}`);
	let issueDate = $state(editing?.date ?? ymd(today));
	let dueDate = $state(editing?.dueDate ?? ymd(addDays(today, 45)));
	let projectRef = $state(String((editing?.generator?.projectRef as string | undefined) ?? ''));
	let poNumber = $state(String((editing?.generator?.poNumber as string | undefined) ?? ''));

	let lineItems = $state<LineItem[]>(
		Array.isArray(editing?.lines) && editing.lines.length > 0
			? editing.lines.map((line: Record<string, unknown>) => ({
					id: crypto.randomUUID(),
					itemName: String(line.itemName ?? ''),
					description: String(line.desc ?? ''),
					qty: `${Number(line.qty ?? 0) || 0}`,
					uom: String(line.uom ?? 'EA'),
					unitPrice: `${Number(line.price ?? 0) || 0}`,
					extras:
						line.extras && typeof line.extras === 'object'
							? (line.extras as Record<string, string>)
							: {}
				}))
			: [
					{
						id: crypto.randomUUID(),
						itemName: 'Engineering services',
						description: 'Phase 1',
						qty: '1',
						uom: 'EA',
						unitPrice: '8000',
						extras: {}
					},
					{
						id: crypto.randomUUID(),
						itemName: 'Hardware supply',
						description: 'Installation & materials',
						qty: '1',
						uom: 'EA',
						unitPrice: '3200',
						extras: {}
					},
					{
						id: crypto.randomUUID(),
						itemName: 'Site visit',
						description: 'Consultation (per trip)',
						qty: '3',
						uom: 'TRIP',
						unitPrice: '450',
						extras: {}
					}
				]
	);

	let taxType = $state<'gst' | 'nongst'>(editing?.gstType === 'standard' ? 'gst' : 'nongst');
	let currency = $state(editing?.currency ?? 'SGD');

	const bankDetails = {
		accountName: 'AXIOM TECH PTE LTD',
		sgdAccountNumber: '5965 1039 6001',
		bankName: 'OCBC Back Ltd',
		bankAddress: '65 Chulia Street, OCBC Centre, Singapore 049513',
		swift: 'OCBCSGSG',
		paymentTerm: 'net 45 days'
	};

	let notes = $state(String((editing?.generator?.notes as string | undefined) ?? ''));

	const REQUIRED_COLS = ['item', 'description', 'orderQty', 'uom', 'unitPrice', 'netValue'] as const;
	let customCols = $state<CustomCol[]>(
		Array.isArray(editing?.generator?.customCols)
			? (editing?.generator?.customCols as Array<Record<string, unknown>>).map((c) => ({
					id: String(c.id ?? crypto.randomUUID()),
					key: String(c.key ?? ''),
					label: String(c.label ?? '')
				}))
			: []
	);

	let selectedProjectId = $state(
		data.preselectProjectId && data.projects.some((p: ProjectRow) => p.id === data.preselectProjectId)
			? data.preselectProjectId
			: (data.projects[0]?.id ?? '')
	);
	let selectedCustomerId = $state(editing?.customerId ?? '');
	let lastBillToProjectId = $state('');
	let editingInvoiceId = $state(editing?.id ?? '');
	let lastPrefillVersion = $state(-1);

	$effect(() => {
		const state = $agentPrefill;
		if (state.version === lastPrefillVersion) return;
		lastPrefillVersion = state.version;

		const prefill = consumePrefill();
		if (Object.keys(prefill).length === 0) return;

		if (typeof prefill.project_name === 'string' && !editingInvoiceId) {
			const needle = prefill.project_name.toLowerCase();
			const match = data.projects.find(
				(p: ProjectRow) =>
					p.name.toLowerCase() === needle || p.name.toLowerCase().includes(needle)
			);
			if (match) {
				selectedProjectId = match.id;
			}
		}

		if (typeof prefill.currency === 'string') {
			const c = prefill.currency.toUpperCase();
			if (['SGD', 'USD', 'CNY'].includes(c)) {
				currency = c;
			}
		}

		if (typeof prefill.amount === 'number' && lineItems.length > 0) {
			lineItems[0].unitPrice = String(prefill.amount);
			lineItems = [...lineItems];
		}

		if (typeof prefill.description === 'string' && lineItems.length > 0) {
			lineItems[0].description = prefill.description;
			lineItems = [...lineItems];
		}
	});

	let saveBusy = $state(false);
	let saveMessage = $state('');
	let previewZoom = $state(80);
	let printRootEl = $state<HTMLElement | null>(null);

	function projectById(id: string): ProjectRow | undefined {
		return data.projects.find((p: ProjectRow) => p.id === id);
	}

	$effect(() => {
		const p = projectById(selectedProjectId);
		if (!p) {
			selectedCustomerId = '';
			return;
		}
		selectedCustomerId = p.customerId;
		if (!editingInvoiceId && selectedProjectId !== lastBillToProjectId) {
			lastBillToProjectId = selectedProjectId;
			toName = p.customerName ?? '';
			toAddr = p.customerAddress ?? '';
			projectRef = p.name;
		}
	});

	function safeKey(label: string): string {
		return label
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '_')
			.replace(/^_+|_+$/g, '')
			.slice(0, 24);
	}

	function addCustomCol(label: string) {
		const trimmed = label.trim();
		if (!trimmed) return;
		const base = safeKey(trimmed) || 'col';
		let key = base;
		let i = 2;
		while (customCols.some((c) => c.key === key)) {
			key = `${base}_${i}`;
			i += 1;
		}
		const col: CustomCol = { id: crypto.randomUUID(), key, label: trimmed };
		customCols = [...customCols, col];
		lineItems = lineItems.map((li) => ({ ...li, extras: { ...li.extras, [key]: li.extras[key] ?? '' } }));
	}

	function removeCustomCol(id: string) {
		const col = customCols.find((c) => c.id === id);
		if (!col) return;
		customCols = customCols.filter((c) => c.id !== id);
		lineItems = lineItems.map((li) => {
			const next = { ...li.extras };
			delete next[col.key];
			return { ...li, extras: next };
		});
	}

	function fmtMoney(n: number): string {
		return n.toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	}

	function fmtPreviewDate(raw: string): string {
		if (!raw) return '—';
		const [y, m, day] = raw.split('-').map((x) => Number.parseInt(x, 10));
		if (!y || !m || !day) return raw;
		const mn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
		return `${day} ${mn[m - 1]} ${y}`;
	}

	const totals = $derived.by(() => {
		const isGst = taxType === 'gst';
		let sub = 0;
		const rows: {
			itemName: string;
			description: string;
			qty: number;
			uom: string;
			unitPrice: number;
			net: number;
			extras: Record<string, string>;
		}[] = [];
		for (const it of lineItems) {
			const q = Number.parseFloat(it.qty) || 0;
			const pr = Number.parseFloat(it.unitPrice) || 0;
			const net = q * pr;
			sub += net;
			rows.push({
				itemName: it.itemName,
				description: it.description,
				qty: q,
				uom: it.uom,
				unitPrice: pr,
				net,
				extras: it.extras ?? {}
			});
		}
		const gst = isGst ? sub * 0.09 : 0;
		const total = sub + gst;
		return { sub, gst, total, rows, isGst };
	});

	function addLine() {
		lineItems = [...lineItems, newLine()];
	}

	function removeLine(id: string) {
		lineItems = lineItems.filter((x) => x.id !== id);
		if (lineItems.length === 0) lineItems = [newLine()];
	}

	function normalizedApiLines(): Array<{
		desc: string;
		qty: number;
		price: number;
		uom?: string;
		itemName?: string;
		extras?: Record<string, string>;
	}> {
		return totals.rows.map((r) => ({
			// Keep `desc` as the main detailed description for existing DB/API fields.
			desc: r.description,
			qty: r.qty,
			price: r.unitPrice,
			uom: r.uom,
			itemName: r.itemName,
			extras: r.extras
		}));
	}

	function generatorMeta(): Record<string, unknown> {
		return {
			fromName,
			fromAddr,
			gstReg,
			toName,
			toAddr,
			toAttn,
			projectRef,
			poNumber,
			notes,
			taxType,
			currency,
			customCols,
			bankDetails
		};
	}

	async function saveDraft(): Promise<{ ok: boolean; invoiceId?: string; invoiceNo?: string }> {
		saveMessage = '';
		if (!selectedProjectId || !selectedCustomerId) {
			saveMessage = 'Select a project (customer is required).';
			return { ok: false };
		}
		if (!issueDate) {
			saveMessage = 'Issue date is required.';
			return { ok: false };
		}
		saveBusy = true;
		try {
			const editMode = Boolean(editingInvoiceId);
			const endpoint = editMode ? `/api/invoices/out/${editingInvoiceId}` : '/api/invoices/out';
			const res = await fetch(endpoint, {
				method: editMode ? 'PUT' : 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					projectId: selectedProjectId,
					customerId: selectedCustomerId,
					date: issueDate,
					dueDate: dueDate || undefined,
					currency,
					gstType: taxType === 'gst' ? 'standard' : 'exempt',
					lineItems: normalizedApiLines(),
					invoiceNo: invoiceNo.trim() || undefined,
					generatorMeta: generatorMeta()
				})
			});
			const json = (await res.json()) as { ok?: boolean; error?: string; data?: { id: string; invoiceNo: string } };
			if (!res.ok || !json.ok) {
				saveMessage = json.error ?? 'Save failed.';
				return { ok: false };
			}
			const no = (json.data?.invoiceNo as string | null | undefined) ?? invoiceNo;
			if (json.data?.id) editingInvoiceId = json.data.id;
			saveMessage = editMode ? `Draft updated${no ? ` (${no})` : ''}.` : `Draft saved as ${no ?? ''}.`;
			return { ok: true, invoiceId: json.data?.id, invoiceNo: no ?? undefined };
		} catch {
			saveMessage = 'Save failed.';
			return { ok: false };
		} finally {
			saveBusy = false;
		}
	}

	function printPreview() {
		window.print();
	}

	function wrapText(text: string, maxChars: number): string[] {
		const src = (text || '').replace(/\r/g, '');
		const hard = src.split('\n');
		const out: string[] = [];
		for (const line of hard) {
			const words = line.split(/\s+/).filter(Boolean);
			if (words.length === 0) {
				out.push('');
				continue;
			}
			let cur = '';
			for (const w of words) {
				if (!cur) cur = w;
				else if ((cur + ' ' + w).length <= maxChars) cur += ' ' + w;
				else {
					out.push(cur);
					cur = w;
				}
			}
			if (cur) out.push(cur);
		}
		return out.length ? out : [''];
	}

	async function buildTextPdfBlob(): Promise<Blob> {
		const pdf = await PDFDocument.create();
		const page = pdf.addPage([595.28, 841.89]); // A4
		const font = await pdf.embedFont(StandardFonts.Helvetica);
		const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
		const textColor = rgb(0.13, 0.18, 0.29);
		const muted = rgb(0.39, 0.45, 0.57);
		const lineColor = rgb(0.85, 0.88, 0.92);
		const marginX = 48;
		let y = 790;

		try {
			const logoBytes = await fetch(companyLogo).then((r) => r.arrayBuffer());
			const logo = await pdf.embedPng(logoBytes);
			page.drawImage(logo, { x: 510, y: y - 8, width: 30, height: 30 });
		} catch {
			// logo optional
		}

		const rightX = 480;
		const companyLines = [fromName, ...fromAddr.split('\n').filter(Boolean), gstReg.trim() ? `GST Reg No: ${gstReg}` : ''].filter(Boolean);
		let cy = y;
		for (let i = 0; i < companyLines.length; i++) {
			const t = companyLines[i];
			const f = i === 0 ? fontBold : font;
			const s = i === 0 ? 10 : 8;
			const w = f.widthOfTextAtSize(t, s);
			page.drawText(t, { x: rightX - w, y: cy, size: s, font: f, color: i === 0 ? textColor : muted });
			cy -= i === 0 ? 14 : 11;
		}

		y = 730;
		page.drawText(totals.isGst ? 'Tax Invoice' : 'Invoice', { x: marginX, y, size: 22, font: fontBold, color: textColor });
		y -= 44;

		page.drawText('Bill To', { x: marginX, y, size: 9, font: fontBold, color: muted });
		page.drawText(toName || 'Customer', { x: marginX + 46, y, size: 10, font: fontBold, color: textColor });
		y -= 16;
		for (const line of (toAddr || '').split('\n').filter(Boolean)) {
			page.drawText(line, { x: marginX, y, size: 9, font, color: muted });
			y -= 12;
		}

		let ry = 686;
		page.drawText(`Invoice Number: ${invoiceNo || '-'}`, { x: 330, y: ry, size: 9, font: fontBold, color: textColor });
		ry -= 13;
		page.drawText(`Invoice Date: ${fmtPreviewDate(issueDate)}`, { x: 330, y: ry, size: 9, font: fontBold, color: textColor });
		if (projectRef || poNumber) {
			page.drawText('REFERENCE', { x: 430, y: ry - 14, size: 8, font: fontBold, color: muted });
			if (projectRef) page.drawText(projectRef, { x: 365, y: ry - 28, size: 9, font, color: textColor });
			if (poNumber) page.drawText(`PO: ${poNumber}`, { x: 365, y: ry - 41, size: 9, font, color: textColor });
		}

		y = 610;
		const headers = ['ITEM', 'DESCRIPTION', 'QTY', 'UOM', 'UNIT PRICE (SGD)', 'NET VALUE (SGD)'];
		const xs = [marginX, 150, 305, 338, 372, 472];
		headers.forEach((h, i) => page.drawText(h, { x: xs[i], y, size: 8.5, font: fontBold, color: muted }));
		y -= 8;
		page.drawLine({ start: { x: marginX, y }, end: { x: 545, y }, thickness: 1, color: lineColor });
		y -= 20;

		for (const r of totals.rows.slice(0, 18)) {
			const descLines = wrapText(r.description || '-', 32);
			const itemLines = wrapText(r.itemName || '-', 14);
			const rowH = Math.max(descLines.length, itemLines.length, 1) * 11 + 6;
			itemLines.forEach((t, idx) => page.drawText(t, { x: xs[0], y: y - idx * 11, size: 8.5, font, color: textColor }));
			descLines.forEach((t, idx) => page.drawText(t, { x: xs[1], y: y - idx * 11, size: 8.5, font, color: textColor }));
			page.drawText(`${r.qty}`, { x: xs[2], y, size: 8.5, font, color: textColor });
			page.drawText(r.uom || '', { x: xs[3], y, size: 8.5, font, color: textColor });
			page.drawText(fmtMoney(r.unitPrice), { x: xs[4], y, size: 8.5, font, color: textColor });
			page.drawText(fmtMoney(r.net), { x: xs[5], y, size: 8.5, font, color: textColor });
			y -= rowH;
			page.drawLine({ start: { x: marginX, y: y + 2 }, end: { x: 545, y: y + 2 }, thickness: 1, color: lineColor });
		}

		y -= 14;
		page.drawText('Subtotal', { x: 395, y, size: 9, font, color: muted });
		page.drawText(`${currency} ${fmtMoney(totals.sub)}`, { x: 470, y, size: 9, font, color: textColor });
		y -= 16;
		if (totals.isGst) {
			page.drawText('GST (9%)', { x: 395, y, size: 9, font, color: muted });
			page.drawText(`${currency} ${fmtMoney(totals.gst)}`, { x: 470, y, size: 9, font, color: textColor });
			y -= 14;
		}
		page.drawLine({ start: { x: 390, y }, end: { x: 545, y }, thickness: 1, color: lineColor });
		y -= 22;
		page.drawText('Total', { x: 395, y, size: 14, font: fontBold, color: textColor });
		page.drawText(`${currency} ${fmtMoney(totals.total)}`, { x: 455, y, size: 14, font: fontBold, color: textColor });

		y -= 46;
		page.drawLine({ start: { x: marginX, y }, end: { x: 545, y }, thickness: 1, color: lineColor });
		y -= 22;
		page.drawText('BANK DETAILS', { x: marginX, y, size: 9, font: fontBold, color: muted });
		y -= 18;
		page.drawText(`Account Name: ${bankDetails.accountName}`, { x: marginX, y, size: 9, font, color: textColor });
		page.drawText(`SGD Account Number: ${bankDetails.sgdAccountNumber}`, { x: 310, y, size: 9, font, color: textColor });
		y -= 15;
		page.drawText(`Bank Name: ${bankDetails.bankName}`, { x: marginX, y, size: 9, font, color: textColor });
		page.drawText(`Back Address: ${bankDetails.bankAddress}`, { x: 310, y, size: 9, font, color: textColor });
		y -= 15;
		page.drawText(`SWIFT Code: ${bankDetails.swift}`, { x: marginX, y, size: 9, font, color: textColor });
		page.drawText(`Payment Term: ${bankDetails.paymentTerm}`, { x: 310, y, size: 9, font, color: textColor });

		page.drawLine({ start: { x: 360, y: 70 }, end: { x: 545, y: 70 }, thickness: 1, color: lineColor });
		page.drawText('Signature and Company Stamp', { x: 405, y: 54, size: 9, font, color: muted });

		const bytes = await pdf.save();
		const copy = new Uint8Array(bytes.length);
		copy.set(bytes);
		return new Blob([copy], { type: 'application/pdf' });
	}

	async function generateAndSend() {
		const saved = await saveDraft();
		if (!saved.ok || !saved.invoiceId) return;
		try {
			if (!printRootEl) {
				saveMessage += ' PDF generation failed: preview root not found.';
				return;
			}
			const previousZoom = previewZoom;
			previewZoom = 100;
			await tick();
			const blob = await buildTextPdfBlob();
			previewZoom = previousZoom;
			await tick();

			// Step 1: always download to local first.
			const safeNo = (invoiceNo || saved.invoiceNo || saved.invoiceId).replace(/[^a-zA-Z0-9._-]/g, '_');
			const localName = `${safeNo}.pdf`;
			const downloadUrl = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = downloadUrl;
			a.download = localName;
			document.body.appendChild(a);
			a.click();
			a.remove();
			URL.revokeObjectURL(downloadUrl);

			const shouldSaveToProject = window.confirm(
				'下载完成。是否保存到对应项目中？\n\n选择“是”：保存到项目并关联到该 invoice。\n选择“否”：你可先自行检查后再手动上传。'
			);
			if (!shouldSaveToProject) {
				saveMessage += ' PDF downloaded locally. Not saved to project storage.';
				return;
			}

			const presignRes = await fetch('/api/upload/presign', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					fileName: localName,
					contentType: 'application/pdf',
					projectId: selectedProjectId,
					entityType: 'invoice_pdf',
					entityId: saved.invoiceId
				})
			});
			const presignJson = (await presignRes.json()) as { ok?: boolean; error?: string; data?: { key: string; uploadUrl: string } };
			if (!presignRes.ok || !presignJson.ok || !presignJson.data?.key || !presignJson.data?.uploadUrl) {
				saveMessage += ` PDF generation failed: ${presignJson.error ?? 'presign error'}.`;
				return;
			}

			const putRes = await fetch(presignJson.data.uploadUrl, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/pdf' },
				body: blob
			});
			if (!putRes.ok) {
				saveMessage += ' PDF generation failed: upload failed.';
				return;
			}

			const pdfRes = await fetch(`/api/invoices/out/${saved.invoiceId}/pdf`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ key: presignJson.data.key })
			});
			const pdfJson = (await pdfRes.json()) as { ok?: boolean; error?: string; data?: { pdfUrl?: string } };
			if (!pdfRes.ok || !pdfJson.ok) {
				saveMessage += ` PDF generation failed: ${pdfJson.error ?? 'unknown error'}.`;
				return;
			}
			saveMessage += ' PDF downloaded and saved to project storage successfully. Email delivery is not configured yet.';
		} catch {
			saveMessage += ' PDF generation request failed.';
		}
	}

	function zoomIn() {
		previewZoom = Math.min(160, previewZoom + 10);
	}

	function zoomOut() {
		previewZoom = Math.max(60, previewZoom - 10);
	}

	function zoomReset() {
		previewZoom = 70;
	}
</script>

<svelte:head>
	<title>Generate invoice · SmartFin</title>
	<style>
		:root {
			--invoice-pad-y: 14mm;
			--invoice-pad-x: 22mm;
		}

		@page {
			size: A4;
			margin: 0;
		}

		@media screen {
			/* Real A4 paper on screen: keep physical ratio, allow scroll instead of shrinking. */
			.sf-preview-frame {
				overflow: auto;
				max-height: calc(100vh - 120px);
				padding: 0;
				background: transparent;
				border: 0;
				border-radius: 0;
			}

			.sf-print-root {
				width: 210mm;
				min-height: 297mm;
				max-width: none;
				margin-left: auto;
				margin-right: auto;
				padding: var(--invoice-pad-y) var(--invoice-pad-x);
				box-sizing: border-box;
				zoom: var(--preview-zoom, 1);
			}
		}

		@media print {
			body * {
				visibility: hidden;
			}
			.sf-print-root,
			.sf-print-root * {
				visibility: visible;
			}
			.sf-print-root {
				position: fixed !important;
				left: 0 !important;
				top: 0 !important;
				right: 0 !important;
				width: 100% !important;
				max-width: none !important;
				margin: 0 !important;
				padding: var(--invoice-pad-y) var(--invoice-pad-x) !important;
				box-sizing: border-box !important;
				border: none !important;
				border-radius: 0 !important;
				box-shadow: none !important;
				background: #fff !important;
				zoom: 1 !important;
			}
			.sf-no-print {
				display: none !important;
			}

			/* Prevent key blocks from splitting between pages. */
			.sf-print-root table,
			.sf-print-root tbody,
			.sf-print-root tr,
			.sf-print-root .border-t,
			.sf-print-root .w-\[200px\],
			.sf-print-root .w-\[260px\] {
				break-inside: avoid !important;
				page-break-inside: avoid !important;
			}
		}
	</style>
</svelte:head>

<PageShell
	eyebrow="AR / Customer Invoices"
	title="Generate invoice"
	description="Two-column editor with live preview, aligned to the standalone invoice generator layout. Saves a draft customer invoice on your selected project."
>
	<p class="sf-no-print -mt-2 text-sm">
		<a class="font-medium text-[var(--sf-green)] hover:underline" href="/ar/customer-invoices">← Back to customer invoices</a>
	</p>

	<div class="grid gap-5 lg:grid-cols-2 lg:items-start">
		<div class="sf-no-print overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
			<div class="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600">Invoice details</div>

			<div class="space-y-0 divide-y divide-slate-200">
				<div class="p-4">
					<label class="block text-xs font-medium uppercase tracking-wide text-slate-500">Project</label>
					<select
						class="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--sf-green)]"
						bind:value={selectedProjectId}
					>
						{#if data.projects.length === 0}
							<option value="">No projects — create one first</option>
						{:else}
							{#each data.projects as p}
								<option value={p.id}>{p.name} · {p.customerName ?? p.customerId}</option>
							{/each}
						{/if}
					</select>
					<p class="mt-1 text-[11px] text-slate-500">Bill-to fields fill from the project’s customer; edit as needed before saving.</p>
				</div>

				<div class="p-4">
					<p class="text-xs font-medium uppercase tracking-wide text-slate-500">From (your company)</p>
					<div class="mt-3 space-y-2">
						<label class="block text-xs text-slate-600">
							Company name
							<input class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" bind:value={fromName} />
						</label>
						<label class="block text-xs text-slate-600">
							Address
							<textarea class="mt-1 w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm leading-relaxed" rows="2" bind:value={fromAddr}></textarea>
						</label>
						<label class="block text-xs text-slate-600">
							GST Reg No.
							<input class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" bind:value={gstReg} />
						</label>
					</div>
				</div>

				<div class="p-4">
					<p class="text-xs font-medium uppercase tracking-wide text-slate-500">Bill to (customer)</p>
					<div class="mt-3 space-y-2">
						<label class="block text-xs text-slate-600">
							Company / Name
							<input class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" bind:value={toName} />
						</label>
						<label class="block text-xs text-slate-600">
							Address
							<textarea class="mt-1 w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm leading-relaxed" rows="2" bind:value={toAddr}></textarea>
						</label>
						<label class="block text-xs text-slate-600">
							Attention to
							<input class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" bind:value={toAttn} placeholder="e.g. John Lee" />
						</label>
					</div>
				</div>

				<div class="p-4">
					<p class="text-xs font-medium uppercase tracking-wide text-slate-500">Invoice info</p>
					<div class="mt-3 grid grid-cols-3 gap-2">
						<label class="block text-xs text-slate-600">
							Invoice no.
							<input class="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm" bind:value={invoiceNo} />
						</label>
						<label class="block text-xs text-slate-600">
							Issue date
							<input class="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm" type="date" bind:value={issueDate} />
						</label>
						<label class="block text-xs text-slate-600">
							Due date
							<input class="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm" type="date" bind:value={dueDate} />
						</label>
					</div>
					<div class="mt-2 grid grid-cols-2 gap-2">
						<label class="block text-xs text-slate-600">
							Project ref.
							<input class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" bind:value={projectRef} />
						</label>
						<label class="block text-xs text-slate-600">
							PO number
							<input class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" bind:value={poNumber} placeholder="Optional" />
						</label>
					</div>
				</div>

				<div class="p-4">
					<p class="text-xs font-medium uppercase tracking-wide text-slate-500">Line items</p>
					<div class="mt-2 grid grid-cols-[1fr_70px_70px_90px_28px] gap-2 pb-1 text-[11px] font-medium text-slate-500">
						<span>Item</span>
						<span class="text-right">Qty</span>
						<span class="text-center">UOM</span>
						<span class="text-right">Unit price</span>
						<span></span>
					</div>
					{#each lineItems as it (it.id)}
						<div class="mb-2 grid grid-cols-[1fr_70px_70px_90px_28px] items-center gap-2">
							<input class="rounded-md border border-slate-200 px-2 py-1.5 text-sm" placeholder="Item name" bind:value={it.itemName} />
							<input class="rounded-md border border-slate-200 px-2 py-1.5 text-right text-sm" type="number" min="0" step="any" bind:value={it.qty} />
							<input class="rounded-md border border-slate-200 px-2 py-1.5 text-sm" placeholder="EA" bind:value={it.uom} />
							<input class="rounded-md border border-slate-200 px-2 py-1.5 text-right text-sm" type="number" min="0" step="any" bind:value={it.unitPrice} />
							<button
								type="button"
								class="flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-slate-500 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
								onclick={() => removeLine(it.id)}
								aria-label="Remove line"
							>
								×
							</button>
						</div>
						<label class="mb-2 block text-xs text-slate-600">
							Description
							<textarea
								class="mt-1 w-full resize-none rounded-md border border-slate-200 px-3 py-2 text-sm leading-relaxed"
								rows="2"
								placeholder="More detailed description"
								bind:value={it.description}
							></textarea>
						</label>
						{#if customCols.length > 0}
							<div class="mb-3 grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
								{#each customCols as col (col.id)}
									<label class="block text-xs text-slate-600">
										{col.label}
										<input
											class="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
											value={it.extras[col.key] ?? ''}
											oninput={(e) => {
												const v = (e.currentTarget as HTMLInputElement).value;
												it.extras = { ...(it.extras ?? {}), [col.key]: v };
												lineItems = [...lineItems];
											}}
										/>
									</label>
								{/each}
							</div>
						{/if}
					{/each}
					<button type="button" class="mt-1 text-xs font-medium text-indigo-600 hover:underline" onclick={addLine}>+ Add line item</button>
					<div class="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
						<p class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Custom columns</p>
						<div class="mt-2 flex flex-wrap items-center gap-2">
							<input
								class="w-56 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
								placeholder="New column label (e.g. Service period)"
								onkeydown={(e) => {
									if (e.key !== 'Enter') return;
									e.preventDefault();
									addCustomCol((e.currentTarget as HTMLInputElement).value);
									(e.currentTarget as HTMLInputElement).value = '';
								}}
							/>
							<button
								type="button"
								class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-100"
								onclick={() => {
									const el = document.activeElement;
									if (el && el instanceof HTMLInputElement) {
										addCustomCol(el.value);
										el.value = '';
									}
								}}
							>
								Add column
							</button>
						</div>
						{#if customCols.length > 0}
							<div class="mt-2 flex flex-wrap gap-2">
								{#each customCols as col (col.id)}
									<span class="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700">
										{col.label}
										<button
											type="button"
											class="rounded-full border border-slate-300 px-1.5 text-[10px] text-slate-500 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
											onclick={() => removeCustomCol(col.id)}
											aria-label={`Remove column ${col.label}`}
										>
											×
										</button>
									</span>
								{/each}
							</div>
						{:else}
							<p class="mt-2 text-xs text-slate-500">Required columns ({REQUIRED_COLS.length}) are fixed; add optional columns here.</p>
						{/if}
					</div>
				</div>

				<div class="p-4">
					<p class="text-xs font-medium uppercase tracking-wide text-slate-500">Tax &amp; totals</p>
					<div class="mt-3 grid grid-cols-2 gap-2">
						<label class="block text-xs text-slate-600">
							Invoice type
							<select class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" bind:value={taxType}>
								<option value="gst">Tax invoice (9% GST)</option>
								<option value="nongst">Non-tax invoice</option>
							</select>
						</label>
						<label class="block text-xs text-slate-600">
							Currency
							<select class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" bind:value={currency}>
								<option>SGD</option>
								<option>USD</option>
								<option>CNY</option>
							</select>
						</label>
					</div>
					<div class="mt-3 space-y-1 text-sm">
						<div class="flex justify-between text-slate-600">
							<span>Subtotal</span>
							<span>{currency} {fmtMoney(totals.sub)}</span>
						</div>
						{#if totals.isGst}
							<div class="flex justify-between text-slate-600">
								<span>GST 9%</span>
								<span>{currency} {fmtMoney(totals.gst)}</span>
							</div>
						{/if}
						<div class="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-900">
							<span>Total</span>
							<span>{currency} {fmtMoney(totals.total)}</span>
						</div>
					</div>
				</div>

				<div class="p-4">
					<p class="text-xs font-medium uppercase tracking-wide text-slate-500">Notes</p>
					<div class="mt-3 space-y-2">
						<label class="block text-xs text-slate-600">
							Notes (optional)
							<textarea class="mt-1 w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm" rows="2" bind:value={notes} placeholder="e.g. Thank you for your business."></textarea>
						</label>
					</div>
				</div>
			</div>

			<div class="flex flex-wrap gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3">
				<button
					type="button"
					class="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-100 disabled:opacity-50"
					disabled={saveBusy}
					onclick={() => void saveDraft()}
				>
					Save draft
				</button>
				<button
					type="button"
					class="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-100"
					onclick={printPreview}
				>
					Preview PDF (print)
				</button>
				<button
					type="button"
					class="ml-auto rounded-md bg-[var(--sf-green)] px-4 py-2 text-sm font-medium text-white hover:bg-[#2f5e2c] disabled:opacity-50"
					disabled={saveBusy}
					onclick={() => void generateAndSend()}
				>
					Generate &amp; send →
				</button>
			</div>
			{#if saveMessage}
				<p class="border-t border-slate-100 px-4 py-2 text-xs text-slate-700">{saveMessage}</p>
			{/if}
		</div>

		<div class="lg:sticky lg:top-4 lg:self-start">
			<div class="rounded-t-xl border border-b-0 border-slate-200 bg-slate-50 px-4 py-3 sf-no-print">
				<div class="flex items-center justify-between gap-3">
					<p class="text-sm font-medium text-slate-600">Live preview</p>
					<div class="flex items-center gap-2">
						<button
							type="button"
							class="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
							onclick={zoomOut}
							aria-label="Zoom out"
						>
							-
						</button>
						<button
							type="button"
							class="min-w-[56px] rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
							onclick={zoomReset}
						>
							{previewZoom}%
						</button>
						<button
							type="button"
							class="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
							onclick={zoomIn}
							aria-label="Zoom in"
						>
							+
						</button>
					</div>
				</div>
			</div>
			<div class="sf-preview-frame" style={`--preview-zoom: ${previewZoom / 100};`}>
				<div bind:this={printRootEl} class="sf-print-root bg-white text-xs leading-relaxed text-slate-800">
				<div class="flex justify-end">
					<div class="min-w-[280px] text-right">
						<img src={companyLogo} alt="Axiom logo" class="mb-2 ml-auto h-10 w-10 object-contain" />
						<p class="text-sm font-semibold text-slate-900">{fromName}</p>
						<p class="mt-1 whitespace-pre-line text-xs text-slate-600">{fromAddr}</p>
						{#if gstReg.trim()}
							<p class="mt-2 text-xs text-slate-600">GST Reg No: <span class="font-medium text-slate-900">{gstReg}</span></p>
						{/if}
					</div>
				</div>

				<div class="mt-4">
					<p class="text-2xl font-semibold text-slate-900">{totals.isGst ? 'Tax Invoice' : 'Invoice'}</p>
				</div>

				<div class="mt-6 grid gap-6 sm:grid-cols-2">
					<div>
						<p class="text-[11px] uppercase tracking-wide text-slate-500">
							<span class="font-medium">Bill To</span>
							<span class="ml-2 normal-case font-semibold text-slate-900">{toName || 'Customer'}</span>
						</p>
						{#if toAttn}
							<p class="text-xs text-slate-600">Attn: {toAttn}</p>
						{/if}
						<p class="mt-2 whitespace-pre-line text-xs text-slate-600">{toAddr}</p>
					</div>
					<div class="text-left">
						<p class="text-xs font-semibold text-slate-700">
							Invoice Number: <span class="font-medium text-slate-900">{invoiceNo || '—'}</span>
						</p>
						<p class="mt-1 text-xs font-semibold text-slate-700">
							Invoice Date: <span class="font-medium text-slate-900">{fmtPreviewDate(issueDate)}</span>
						</p>
						{#if projectRef || poNumber}
							<p class="mt-3 text-[11px] font-medium uppercase tracking-wide text-slate-500">Reference</p>
							{#if projectRef}
								<p class="text-xs text-slate-600">{projectRef}</p>
							{/if}
							{#if poNumber}
								<p class="text-xs text-slate-600">PO: {poNumber}</p>
							{/if}
						{/if}
					</div>
				</div>

				<table class="mt-10 w-full border-collapse text-xs">
					<thead>
						<tr class="border-b border-slate-200 text-left text-[11px] font-medium uppercase tracking-wide text-slate-600">
							<th class="w-24 pb-2 pr-2">Item</th>
							<th class="pb-2 pr-2">Description</th>
							<th class="w-16 pb-2 text-right">Qty</th>
							<th class="w-10 pb-2 text-center">UOM</th>
							{#each customCols as col (col.id)}
								<th class="w-28 pb-2 pr-2">{col.label}</th>
							{/each}
							<th class="w-28 pb-2 text-right">Unit Price (SGD)</th>
							<th class="w-28 pb-2 text-right">Net Value (SGD)</th>
						</tr>
					</thead>
					<tbody>
						{#each totals.rows as r}
							<tr class="border-b border-slate-100">
								<td class="py-2 pr-2 align-top whitespace-pre-wrap break-words font-medium text-slate-800">{r.itemName || '—'}</td>
								<td class="py-2 pr-2 align-top whitespace-pre-wrap break-words text-slate-700">{r.description || '—'}</td>
								<td class="py-2 text-right align-top whitespace-pre-wrap break-words">{r.qty}</td>
								<td class="py-2 text-center align-top whitespace-pre-wrap break-words">{r.uom || ''}</td>
								{#each customCols as col (col.id)}
									<td class="py-2 pr-2 align-top whitespace-pre-wrap break-words text-slate-600">{r.extras?.[col.key] ?? ''}</td>
								{/each}
								<td class="py-2 text-right align-top whitespace-pre-wrap break-words">{fmtMoney(r.unitPrice)}</td>
								<td class="py-2 text-right align-top whitespace-pre-wrap break-words">{fmtMoney(r.net)}</td>
							</tr>
						{/each}
					</tbody>
				</table>

				<div class="mt-8 flex justify-end">
					<div class="w-[200px]">
						<div class="flex justify-between py-1 text-xs text-slate-600">
							<span>Subtotal</span><span>{currency} {fmtMoney(totals.sub)}</span>
						</div>
						{#if totals.isGst}
							<div class="flex justify-between py-1 text-xs text-slate-600">
								<span>GST (9%)</span><span>{currency} {fmtMoney(totals.gst)}</span>
							</div>
						{/if}
						<div class="mt-2 flex justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-900">
							<span>Total</span><span>{currency} {fmtMoney(totals.total)}</span>
						</div>
					</div>
				</div>

				<div class="mt-10 border-t border-slate-200 pt-5 text-xs text-slate-700">
					<p class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Bank Details</p>
					<div class="grid gap-x-6 gap-y-1 sm:grid-cols-2">
						<p><span class="text-slate-500">Account Name:</span> {bankDetails.accountName}</p>
						<p><span class="text-slate-500">SGD Account Number:</span> {bankDetails.sgdAccountNumber}</p>
						<p><span class="text-slate-500">Bank Name:</span> {bankDetails.bankName}</p>
						<p><span class="text-slate-500">Back Address:</span> {bankDetails.bankAddress}</p>
						<p><span class="text-slate-500">SWIFT Code:</span> {bankDetails.swift}</p>
						<p><span class="text-slate-500">Payment Term:</span> {bankDetails.paymentTerm}</p>
					</div>
				</div>
				{#if notes}
					<div class="mt-4 text-xs text-slate-600">
						<p class="mb-1 font-medium text-slate-900">Notes</p>
						<p class="whitespace-pre-line">{notes}</p>
					</div>
				{/if}

				<div class="mt-10">
					<div class="flex justify-end">
						<div class="w-[260px] text-center">
							<div class="border-b border-slate-300 pb-10"></div>
							<p class="mt-2 text-xs text-slate-600">Signature and Company Stamp</p>
						</div>
					</div>
				</div>
				</div>
			</div>
		</div>
	</div>
</PageShell>
