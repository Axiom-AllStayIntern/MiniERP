<script lang="ts">
	import PageShell from '$app-layer/components/PageShell.svelte';

	type ProjectRow = {
		id: string;
		name: string;
		customerId: string | null;
		customerName: string | null;
		customerAddress: string | null;
		customerContact: string | null;
		customerCurrency: string | null;
		customerGstRegNo: string | null;
	};

	type LineItem = {
		id: string;
		itemName: string;
		description: string;
		qty: string;
		uom: string;
		unitPrice: string;
	};

	let { data, form } = $props();

	const today = new Date();
	const ymd = (d: Date) => d.toISOString().slice(0, 10);
	const addDays = (d: Date, n: number) => {
		const next = new Date(d);
		next.setDate(next.getDate() + n);
		return next;
	};

	function newLine(): LineItem {
		return {
			id: crypto.randomUUID(),
			itemName: '',
			description: '',
			qty: '1',
			uom: 'EA',
			unitPrice: '0'
		};
	}

	const initialInvoiceNumber = () => data.defaultInvoiceNumber;
	const initialDate = () => data.defaultDate;
	const initialDueDate = () => ymd(addDays(today, 45));
	const initialProjectId = () => data.preselectProjectId ?? '';

	let fromName = $state('AXIOM TECH PTE LTD');
	let fromAddr = $state('5008 Ang Mo Kio Ave 5, #04-09 (Mo4)\nTechplace II, Singapore 569874');
	let gstReg = $state('{replace by GST Reg No}');
	let toName = $state('');
	let toAddr = $state('');
	let toAttn = $state('');
	let invoiceNo = $state(initialInvoiceNumber());
	let issueDate = $state(initialDate());
	let dueDate = $state(initialDueDate());
	let projectRef = $state('');
	let poNumber = $state('');
	let taxType = $state<'gst' | 'nongst'>('gst');
	let currency = $state('SGD');
	let notes = $state('');
	let selectedProjectId = $state(initialProjectId());
	let lastBillToProjectId = $state('');

	let lineItems = $state<LineItem[]>([
		{
			id: crypto.randomUUID(),
			itemName: 'Engineering services',
			description: 'Phase 1',
			qty: '1',
			uom: 'EA',
			unitPrice: '8000'
		},
		{
			id: crypto.randomUUID(),
			itemName: 'Hardware supply',
			description: 'Installation and materials',
			qty: '1',
			uom: 'EA',
			unitPrice: '3200'
		}
	]);

	const bankDetails = {
		accountName: 'AXIOM TECH PTE LTD',
		sgdAccountNumber: '5965 1039 6001',
		bankName: 'OCBC Bank Ltd',
		bankAddress: '65 Chulia Street, OCBC Centre, Singapore 049513',
		swift: 'OCBCSGSG',
		paymentTerm: 'net 45 days'
	};

	function projectById(id: string): ProjectRow | undefined {
		return data.projects.find((project: ProjectRow) => project.id === id);
	}

	$effect(() => {
		const project = projectById(selectedProjectId);
		if (!project) return;
		if (selectedProjectId === lastBillToProjectId) return;
		lastBillToProjectId = selectedProjectId;
		toName = project.customerName ?? '';
		toAddr = project.customerAddress ?? '';
		toAttn = project.customerContact ?? '';
		projectRef = project.name;
		if (project.customerCurrency) currency = project.customerCurrency;
	});

	const invoiceType = $derived(taxType === 'gst' ? 'tax_invoice' : 'zero_rate');

	const totals = $derived.by(() => {
		const rows = lineItems.map((item) => {
			const qty = Number.parseFloat(item.qty) || 0;
			const unitPrice = Number.parseFloat(item.unitPrice) || 0;
			return {
				...item,
				qtyNumber: qty,
				unitPriceNumber: unitPrice,
				net: qty * unitPrice
			};
		});
		const subtotal = rows.reduce((sum, item) => sum + item.net, 0);
		const gst = taxType === 'gst' ? subtotal * 0.09 : 0;
		return { rows, subtotal, gst, total: subtotal + gst };
	});

	const metadataJson = $derived.by(() =>
		JSON.stringify({
			generator: {
				fromName,
				fromAddr,
				gstReg,
				toName,
				toAddr,
				toAttn,
				projectRef,
				poNumber,
				dueDate,
				taxType,
				bankDetails,
				lineItems: totals.rows.map((item) => ({
					itemName: item.itemName,
					description: item.description,
					qty: item.qtyNumber,
					uom: item.uom,
					unitPrice: item.unitPriceNumber,
					net: item.net
				}))
			}
		})
	);

	function addLine() {
		lineItems = [...lineItems, newLine()];
	}

	function removeLine(id: string) {
		lineItems = lineItems.filter((item) => item.id !== id);
		if (lineItems.length === 0) lineItems = [newLine()];
	}

	function fmtMoney(value: number): string {
		return value.toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	}

	function fmtPreviewDate(raw: string): string {
		if (!raw) return '-';
		const [year, month, day] = raw.split('-').map((part) => Number.parseInt(part, 10));
		if (!year || !month || !day) return raw;
		const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
		return `${day} ${months[month - 1]} ${year}`;
	}

	function printPreview() {
		window.print();
	}
</script>

<svelte:head>
	<style>
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
				inset: 0 auto auto 0 !important;
				width: 100% !important;
				max-width: none !important;
				margin: 0 !important;
				padding: 16mm 14mm !important;
				border: 0 !important;
				border-radius: 0 !important;
				box-shadow: none !important;
				background: #fff !important;
			}

			.sf-no-print {
				display: none !important;
			}
		}
	</style>
</svelte:head>

<PageShell
	eyebrow="Finance / Revenue"
	title="Generate Customer Invoice"
	description="Prepare a customer-facing invoice with line items, live preview, print/PDF output, and revenue recording."
>
	<p class="sf-no-print -mt-2 text-sm">
		<a class="font-medium text-[var(--sf-green)] hover:underline" href="/finance/revenue">Back to All Revenue</a>
	</p>

	<div class="grid gap-5 lg:grid-cols-2 lg:items-start">
		<form method="POST" action="?/save" class="sf-no-print overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
			<input type="hidden" name="projectId" value={selectedProjectId} />
			<input type="hidden" name="invoiceType" value={invoiceType} />
			<input type="hidden" name="invoiceNumber" value={invoiceNo} />
			<input type="hidden" name="clientName" value={toName} />
			<input type="hidden" name="date" value={issueDate} />
			<input type="hidden" name="currency" value={currency} />
			<input type="hidden" name="amount" value={totals.total} />
			<input type="hidden" name="gstAmount" value={totals.gst} />
			<input type="hidden" name="notes" value={notes} />
			<input type="hidden" name="metadata" value={metadataJson} />

			<div class="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600">Invoice details</div>

			{#if form?.error}
				<div class="border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{form.error}</div>
			{/if}
			{#if form?.success}
				<div class="border-b border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Revenue record saved.</div>
			{/if}

			<div class="space-y-0 divide-y divide-slate-200">
				<div class="p-4">
					<label class="block text-xs font-medium uppercase tracking-wide text-slate-500" for="project">Project</label>
					<select id="project" class="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--sf-green)]" bind:value={selectedProjectId}>
						{#if data.projects.length === 0}
							<option value="">No projects - create one first</option>
						{:else}
							{#each data.projects as project}
								<option value={project.id}>{project.name} - {project.customerName ?? project.customerId ?? 'No customer'}</option>
							{/each}
						{/if}
					</select>
					<p class="mt-1 text-[11px] text-slate-500">Bill-to fields fill from the project's customer. Edit them before saving if needed.</p>
				</div>

				<div class="p-4">
					<p class="text-xs font-medium uppercase tracking-wide text-slate-500">From</p>
					<div class="mt-3 space-y-2">
						<label class="block text-xs text-slate-600" for="fromName">
							Company name
							<input id="fromName" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" bind:value={fromName} />
						</label>
						<label class="block text-xs text-slate-600" for="fromAddr">
							Address
							<textarea id="fromAddr" class="mt-1 w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm leading-relaxed" rows="2" bind:value={fromAddr}></textarea>
						</label>
						<label class="block text-xs text-slate-600" for="gstReg">
							GST Reg No.
							<input id="gstReg" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" bind:value={gstReg} />
						</label>
					</div>
				</div>

				<div class="p-4">
					<p class="text-xs font-medium uppercase tracking-wide text-slate-500">Bill to</p>
					<div class="mt-3 space-y-2">
						<label class="block text-xs text-slate-600" for="toName">
							Company / Name
							<input id="toName" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" bind:value={toName} />
						</label>
						<label class="block text-xs text-slate-600" for="toAddr">
							Address
							<textarea id="toAddr" class="mt-1 w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm leading-relaxed" rows="2" bind:value={toAddr}></textarea>
						</label>
						<label class="block text-xs text-slate-600" for="toAttn">
							Attention to
							<input id="toAttn" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" bind:value={toAttn} />
						</label>
					</div>
				</div>

				<div class="p-4">
					<p class="text-xs font-medium uppercase tracking-wide text-slate-500">Invoice info</p>
					<div class="mt-3 grid grid-cols-3 gap-2">
						<label class="block text-xs text-slate-600" for="invoiceNo">
							Invoice no.
							<input id="invoiceNo" class="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm" bind:value={invoiceNo} />
						</label>
						<label class="block text-xs text-slate-600" for="issueDate">
							Issue date
							<input id="issueDate" class="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm" type="date" bind:value={issueDate} />
						</label>
						<label class="block text-xs text-slate-600" for="dueDate">
							Due date
							<input id="dueDate" class="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm" type="date" bind:value={dueDate} />
						</label>
					</div>
					<div class="mt-2 grid grid-cols-2 gap-2">
						<label class="block text-xs text-slate-600" for="projectRef">
							Project ref.
							<input id="projectRef" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" bind:value={projectRef} />
						</label>
						<label class="block text-xs text-slate-600" for="poNumber">
							PO number
							<input id="poNumber" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" bind:value={poNumber} placeholder="Optional" />
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
					{#each lineItems as item (item.id)}
						<div class="mb-2 grid grid-cols-[1fr_70px_70px_90px_28px] items-center gap-2">
							<input class="rounded-md border border-slate-200 px-2 py-1.5 text-sm" placeholder="Item name" bind:value={item.itemName} />
							<input class="rounded-md border border-slate-200 px-2 py-1.5 text-right text-sm" type="number" min="0" step="any" bind:value={item.qty} />
							<input class="rounded-md border border-slate-200 px-2 py-1.5 text-sm" placeholder="EA" bind:value={item.uom} />
							<input class="rounded-md border border-slate-200 px-2 py-1.5 text-right text-sm" type="number" min="0" step="any" bind:value={item.unitPrice} />
							<button type="button" class="flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-slate-500 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700" onclick={() => removeLine(item.id)} aria-label="Remove line">
								x
							</button>
						</div>
						<label class="mb-2 block text-xs text-slate-600">
							Description
							<textarea class="mt-1 w-full resize-none rounded-md border border-slate-200 px-3 py-2 text-sm leading-relaxed" rows="2" placeholder="More detailed description" bind:value={item.description}></textarea>
						</label>
					{/each}
					<button type="button" class="mt-1 text-xs font-medium text-indigo-600 hover:underline" onclick={addLine}>+ Add line item</button>
				</div>

				<div class="p-4">
					<p class="text-xs font-medium uppercase tracking-wide text-slate-500">Tax and totals</p>
					<div class="mt-3 grid grid-cols-2 gap-2">
						<label class="block text-xs text-slate-600" for="taxType">
							Invoice type
							<select id="taxType" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" bind:value={taxType}>
								<option value="gst">Tax invoice (9% GST)</option>
								<option value="nongst">Zero-rate / non-tax invoice</option>
							</select>
						</label>
						<label class="block text-xs text-slate-600" for="currency">
							Currency
							<select id="currency" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" bind:value={currency}>
								<option>SGD</option>
								<option>USD</option>
								<option>CNY</option>
							</select>
						</label>
					</div>
					<div class="mt-3 space-y-1 text-sm">
						<div class="flex justify-between text-slate-600">
							<span>Subtotal</span>
							<span>{currency} {fmtMoney(totals.subtotal)}</span>
						</div>
						{#if taxType === 'gst'}
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
					<label class="block text-xs font-medium uppercase tracking-wide text-slate-500" for="notes">Notes</label>
					<textarea id="notes" class="mt-2 w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm" rows="2" bind:value={notes} placeholder="Optional"></textarea>
				</div>
			</div>

			<div class="flex flex-wrap gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3">
				<button type="button" class="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-100" onclick={printPreview}>
					Print / Save PDF
				</button>
				<button type="submit" class="ml-auto rounded-md bg-[var(--sf-green)] px-4 py-2 text-sm font-medium text-white hover:bg-[#2f5e2c]">
					Save Revenue
				</button>
			</div>
		</form>

		<div class="lg:sticky lg:top-4 lg:self-start">
			<div class="rounded-t-xl border border-b-0 border-slate-200 bg-slate-50 px-4 py-3 sf-no-print">
				<p class="text-sm font-medium text-slate-600">Live preview</p>
			</div>
			<div class="sf-print-root rounded-b-xl border border-slate-200 bg-white p-8 text-xs leading-relaxed text-slate-800 shadow-sm">
				<div class="flex justify-end">
					<div class="min-w-[280px] text-right">
						<p class="text-sm font-semibold text-slate-900">{fromName}</p>
						<p class="mt-1 whitespace-pre-line text-xs text-slate-600">{fromAddr}</p>
						{#if gstReg.trim()}
							<p class="mt-2 text-xs text-slate-600">GST Reg No: <span class="font-medium text-slate-900">{gstReg}</span></p>
						{/if}
					</div>
				</div>

				<div class="mt-4">
					<p class="text-2xl font-semibold text-slate-900">{taxType === 'gst' ? 'Tax Invoice' : 'Invoice'}</p>
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
							Invoice Number: <span class="font-medium text-slate-900">{invoiceNo || '-'}</span>
						</p>
						<p class="mt-1 text-xs font-semibold text-slate-700">
							Invoice Date: <span class="font-medium text-slate-900">{fmtPreviewDate(issueDate)}</span>
						</p>
						<p class="mt-1 text-xs font-semibold text-slate-700">
							Due Date: <span class="font-medium text-slate-900">{fmtPreviewDate(dueDate)}</span>
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
							<th class="w-28 pb-2 text-right">Unit Price</th>
							<th class="w-28 pb-2 text-right">Net Value</th>
						</tr>
					</thead>
					<tbody>
						{#each totals.rows as row}
							<tr class="border-b border-slate-100">
								<td class="py-2 pr-2 align-top font-medium text-slate-800">{row.itemName || '-'}</td>
								<td class="py-2 pr-2 align-top whitespace-pre-wrap text-slate-700">{row.description || '-'}</td>
								<td class="py-2 text-right align-top">{row.qtyNumber}</td>
								<td class="py-2 text-center align-top">{row.uom || ''}</td>
								<td class="py-2 text-right align-top">{fmtMoney(row.unitPriceNumber)}</td>
								<td class="py-2 text-right align-top">{fmtMoney(row.net)}</td>
							</tr>
						{/each}
					</tbody>
				</table>

				<div class="mt-8 flex justify-end">
					<div class="w-[220px]">
						<div class="flex justify-between py-1 text-xs text-slate-600">
							<span>Subtotal</span><span>{currency} {fmtMoney(totals.subtotal)}</span>
						</div>
						{#if taxType === 'gst'}
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
						<p><span class="text-slate-500">Bank Address:</span> {bankDetails.bankAddress}</p>
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

				<div class="mt-10 flex justify-end">
					<div class="w-[260px] text-center">
						<div class="border-b border-slate-300 pb-10"></div>
						<p class="mt-2 text-xs text-slate-600">Signature and Company Stamp</p>
					</div>
				</div>
			</div>
		</div>
	</div>
</PageShell>
