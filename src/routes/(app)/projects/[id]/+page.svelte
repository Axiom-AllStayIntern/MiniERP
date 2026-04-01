<script lang="ts">
	import PageShell from '$lib/components/PageShell.svelte';

	let { data, form } = $props();

	const money = (value: number) =>
		new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD' }).format(value ?? 0);

	type DetailItem = {
		id: string;
		label: string | null;
		date: string | null;
		status: string | null;
		amount: number;
	};

	let selectedDetailId = $state<string | null>(null);

	const detailGroups = $derived.by(
		(): Array<{
			id: string;
			title: string;
			description: string;
			total: number;
			items: DetailItem[];
			fallback: string;
		}> => [
			{
				id: 'revenue-details',
				title: 'Revenue Breakdown',
				description: 'Composed from customer invoices (invoices_out.total).',
				total: data.breakdown.revenue,
				items: data.details.revenueItems,
				fallback: 'No revenue invoice records yet.'
			},
			{
				id: 'purchase-details',
				title: 'Purchase Cost Breakdown',
				description: 'Composed from supplier invoices (invoices_in.amount).',
				total: data.breakdown.purchaseCost,
				items: data.details.purchaseItems,
				fallback: 'No supplier invoice records yet.'
			},
			{
				id: 'staff-details',
				title: 'Staff Cost Breakdown',
				description: 'Composed from project compensations (project_compensations.amount).',
				total: data.breakdown.staffCost,
				items: data.details.staffItems,
				fallback: 'No staff compensation records yet.'
			},
			{
				id: 'expense-details',
				title: 'Expense Cost Breakdown',
				description: 'Composed from project expenses (expenses.amount).',
				total: data.breakdown.expenseCost,
				items: data.details.expenseItems,
				fallback: 'No expense records yet.'
			}
		]
	);

	const selectedDetailGroup = $derived.by(
		() => detailGroups.find((group) => group.id === selectedDetailId) ?? null
	);

	const openDetail = (id: string) => {
		selectedDetailId = id;
	};

	const closeDetail = () => {
		selectedDetailId = null;
	};
</script>

<PageShell
	eyebrow="Project Detail"
	title={data.project.name}
	description={`Customer: ${data.customerName} | Status: ${data.project.status}`}
>
	<nav class="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
		<a class="hover:text-[var(--sf-green)] hover:underline" href="/dashboard">Dashboard</a>
		<span>/</span>
		<a class="hover:text-[var(--sf-green)] hover:underline" href="/projects">Projects</a>
		<span>/</span>
		<span class="font-medium text-slate-800">{data.project.name}</span>
	</nav>

	<section class="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
		<div>
			<p class="text-xs font-semibold uppercase tracking-wide text-[var(--sf-green)]">Financial Overview</p>
			<p class="mt-1 text-sm text-slate-500">
				Click a metric card to open a detail window.
			</p>
		</div>
		<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
			<button
				type="button"
				class="rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:bg-slate-50"
				onclick={() => openDetail('revenue-details')}
			>
				<p class="text-xs text-slate-500">Revenue</p>
				<p class="mt-2 text-xl font-semibold text-slate-900">{money(data.breakdown.revenue)}</p>
			</button>
			<button
				type="button"
				class="rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:bg-slate-50"
				onclick={() => openDetail('purchase-details')}
			>
				<p class="text-xs text-slate-500">Purchase Cost</p>
				<p class="mt-2 text-xl font-semibold text-slate-900">{money(data.breakdown.purchaseCost)}</p>
			</button>
			<button
				type="button"
				class="rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:bg-slate-50"
				onclick={() => openDetail('staff-details')}
			>
				<p class="text-xs text-slate-500">Staff Cost</p>
				<p class="mt-2 text-xl font-semibold text-slate-900">{money(data.breakdown.staffCost)}</p>
			</button>
			<button
				type="button"
				class="rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:bg-slate-50"
				onclick={() => openDetail('expense-details')}
			>
				<p class="text-xs text-slate-500">Expense Cost</p>
				<p class="mt-2 text-xl font-semibold text-slate-900">{money(data.breakdown.expenseCost)}</p>
			</button>
		</div>
		<article class="rounded-xl border border-slate-200 bg-slate-50 p-4">
			<p class="text-sm text-slate-500">Project Profit</p>
			<p class="mt-2 text-2xl font-semibold {data.profit >= 0 ? 'text-emerald-700' : 'text-rose-700'}">
				{money(data.profit)}
			</p>
			<p class="mt-1 text-xs text-slate-500">
				Formula: Revenue - Purchase Cost - Staff Cost - Expense Cost
			</p>
		</article>
	</section>

	<section class="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
		<div>
			<p class="text-xs font-semibold uppercase tracking-wide text-[var(--sf-green)]">AR Document Submodules</p>
			<p class="mt-1 text-sm text-slate-500">Operational document maintenance and data entry paths.</p>
		</div>
		<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
		<a class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:bg-slate-50" href={`/projects/${data.project.id}/contracts`}>
			<p class="text-xs text-slate-500">Project Submodule</p>
			<p class="mt-1 font-medium text-slate-800">Contracts</p>
		</a>
		<a class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:bg-slate-50" href={`/projects/${data.project.id}/quotations`}>
			<p class="text-xs text-slate-500">Project Submodule</p>
			<p class="mt-1 font-medium text-slate-800">Quotations</p>
		</a>
		<a class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:bg-slate-50" href={`/projects/${data.project.id}/purchase-orders`}>
			<p class="text-xs text-slate-500">Project Submodule</p>
			<p class="mt-1 font-medium text-slate-800">Purchase Orders</p>
		</a>
		<a class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:bg-slate-50" href={`/projects/${data.project.id}/expenses`}>
			<p class="text-xs text-slate-500">Project Submodule</p>
			<p class="mt-1 font-medium text-slate-800">Expenses</p>
		</a>
		</div>
	</section>

	<form class="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm" method="POST" action="?/update">
		{#if form?.message}
			<p class="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{form.message}</p>
		{/if}

		<div class="grid gap-4 md:grid-cols-2">
			<label class="space-y-1 text-sm">
				<span class="text-slate-700">Project Name</span>
				<input
					name="name"
					required
					value={data.project.name}
					class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--sf-green)]"
				/>
			</label>

			<label class="space-y-1 text-sm">
				<span class="text-slate-700">Status</span>
				<select
					name="status"
					class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--sf-green)]"
					value={data.project.status}
				>
					<option value="active">active</option>
					<option value="on_hold">on_hold</option>
					<option value="completed">completed</option>
					<option value="archived">archived</option>
				</select>
			</label>

			<label class="space-y-1 text-sm">
				<span class="text-slate-700">Start Date</span>
				<input
					type="date"
					name="startDate"
					value={data.project.startDate ?? ''}
					class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--sf-green)]"
				/>
			</label>

			<label class="space-y-1 text-sm">
				<span class="text-slate-700">End Date</span>
				<input
					type="date"
					name="endDate"
					value={data.project.endDate ?? ''}
					class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--sf-green)]"
				/>
			</label>
		</div>

		<label class="block space-y-1 text-sm">
			<span class="text-slate-700">Project Description</span>
			<textarea
				name="description"
				rows="4"
				class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--sf-green)]"
			>{data.project.description ?? ''}</textarea>
		</label>

		<div class="flex flex-wrap gap-3">
			<button class="rounded-md bg-[var(--sf-green)] px-4 py-2 text-sm font-medium text-white hover:bg-[#2f5e2c]" type="submit">
				Save Changes
			</button>
			<a class="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50" href="/projects">
				Back to List
			</a>
		</div>
	</form>

	<div class="flex flex-wrap gap-3">
		<form method="POST" action="?/archive">
			<button
				type="submit"
				class="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100"
			>
				Archive Project
			</button>
		</form>
		<form method="POST" action="?/remove">
			<button
				type="submit"
				class="rounded-md border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100"
			>
				Remove Project
			</button>
		</form>
	</div>
</PageShell>

{#if selectedDetailGroup}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<button
			type="button"
			class="absolute inset-0 bg-[var(--sf-green)]/40"
			aria-label="Close detail dialog"
			onclick={closeDetail}
		></button>
		<div class="relative max-h-[85vh] w-full max-w-5xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
			<div class="border-b border-slate-200 bg-slate-50 px-4 py-3">
				<div class="flex items-start justify-between gap-4">
					<div>
						<h3 class="text-base font-semibold text-slate-900">{selectedDetailGroup.title}</h3>
						<p class="text-xs text-slate-500">{selectedDetailGroup.description}</p>
					</div>
					<div class="text-right">
						<p class="text-xs text-slate-500">Subtotal</p>
						<p class="text-sm font-semibold text-slate-900">{money(selectedDetailGroup.total)}</p>
					</div>
				</div>
			</div>
			<div class="max-h-[60vh] overflow-auto">
				<table class="min-w-full divide-y divide-slate-200 text-sm">
					<thead class="bg-white text-left text-slate-600">
						<tr>
							<th class="px-4 py-3">Ref</th>
							<th class="px-4 py-3">Date</th>
							<th class="px-4 py-3">Status / Note</th>
							<th class="px-4 py-3 text-right">Amount</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-100">
						{#if selectedDetailGroup.items.length === 0}
							<tr>
								<td class="px-4 py-8 text-center text-slate-500" colspan="4">
									{selectedDetailGroup.fallback}
								</td>
							</tr>
						{:else}
							{#each selectedDetailGroup.items as item}
								<tr class="hover:bg-slate-50">
									<td class="px-4 py-3 font-medium text-slate-800">{item.label || item.id}</td>
									<td class="px-4 py-3 text-slate-600">{item.date || '-'}</td>
									<td class="px-4 py-3 text-slate-600">{item.status || '-'}</td>
									<td class="px-4 py-3 text-right text-slate-800">{money(item.amount)}</td>
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			</div>
		</div>
	</div>
{/if}
