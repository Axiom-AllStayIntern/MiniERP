<script lang="ts">
	import PageShell from '$app-layer/components/PageShell.svelte';

	const modules = [
		{
			title: 'Contracts',
			description: 'Manage contract archive and contract-related records.',
			href: '/finance/doc-hub/contracts'
		},
		{
			title: 'Quotations',
			description: 'Manage quotation records and follow-up revisions.',
			href: '/finance/doc-hub/quotations'
		},
		{
			title: 'Purchase Orders',
			description: 'Manage purchase order records and supplier workflow.',
			href: '/finance/doc-hub/purchase-orders'
		},
		{
			title: 'Customer Invoices',
			description: 'Manage outgoing invoices and customer billing workflow.',
			href: '/finance/doc-hub/customer-invoices'
		},
		{
			title: 'Supplier Invoices',
			description: 'Manage incoming invoices and OCR-related processing states.',
			href: '/finance/doc-hub/supplier-invoices'
		}
	];
</script>

<PageShell
	eyebrow="Finance"
	title="Document Hub"
	description="Single entry point for contracts, quotations, POs, invoices, and document archive uploads."
>
	<section class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
		{#each modules as module}
			<a
				href={module.href}
				class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300"
			>
				<h2 class="text-base font-semibold text-slate-900">{module.title}</h2>
				<p class="mt-2 text-sm text-slate-600">{module.description}</p>
				<p class="mt-4 text-sm font-medium text-[var(--sf-green)]">Open module</p>
			</a>
		{/each}

		<article
			class="upload-card relative overflow-hidden rounded-xl border border-[var(--sf-green)] bg-[var(--sf-green)] p-5 text-white shadow-sm transition hover:-translate-y-0.5"
		>
			<h2 class="text-base font-semibold text-white">Document Upload</h2>
			<p class="mt-2 text-sm text-white/90">Hover to choose upload type.</p>
			<p class="mt-4 text-sm font-medium text-white">Start upload</p>

			<div class="upload-overlay absolute inset-0">
				<div class="grid h-full grid-cols-2">
					<a
						href="/finance/doc-hub/upload/project"
						class="flex h-full flex-col justify-center border-r border-[rgba(56,114,52,0.55)] px-5 text-slate-900 transition hover:bg-[rgba(255,255,255,0.10)]"
					>
						<p class="text-sm font-semibold">Upload Project File</p>
						<p class="mt-1 text-xs text-slate-700">Belongs to a specific project</p>
					</a>
					<a
						href="/finance/doc-hub/upload/record"
						class="flex h-full flex-col justify-center px-5 text-slate-900 transition hover:bg-[rgba(255,255,255,0.10)]"
					>
						<p class="text-sm font-semibold">Upload Other File</p>
						<p class="mt-1 text-xs text-slate-700">Standalone archive record only</p>
					</a>
				</div>
			</div>
		</article>
	</section>
</PageShell>

<style>
	.upload-card {
		min-height: 152px;
	}

	.upload-overlay {
		background: linear-gradient(180deg, #f4c84d 0%, #eabc3c 100%);
		transform: translateY(102%);
		opacity: 0.98;
		transition: transform 260ms ease-out;
		pointer-events: none;
	}

	.upload-card:hover .upload-overlay {
		transform: translateY(0);
		pointer-events: auto;
	}
</style>


