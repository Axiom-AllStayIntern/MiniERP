<script lang="ts">
	import PageShell from '$lib/components/PageShell.svelte';

	const modules = [
		{
			title: 'Contracts',
			description: 'Manage contract archive and contract-related records.',
			href: '/ar/contracts'
		},
		{
			title: 'Quotations',
			description: 'Manage quotation records and follow-up revisions.',
			href: '/ar/quotations'
		},
		{
			title: 'Purchase Orders',
			description: 'Manage purchase order records and supplier workflow.',
			href: '/ar/purchase-orders'
		},
		{
			title: 'Customer Invoices',
			description: 'Manage outgoing invoices and customer billing workflow.',
			href: '/ar/customer-invoices'
		},
		{
			title: 'Supplier Invoices',
			description: 'Manage incoming invoices and OCR-related processing states.',
			href: '/ar/supplier-invoices'
		}
	];
</script>

<PageShell
	eyebrow="AR"
	title="AR Module Hub"
	description="Use this hub to enter each AR submodule."
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
	</section>
</PageShell>
