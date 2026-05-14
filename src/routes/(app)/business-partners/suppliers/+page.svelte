<script lang="ts">
	import PageShell from '$app-layer/components/PageShell.svelte';

	let { data } = $props();
</script>

<PageShell
	eyebrow="Business partners"
	title="Suppliers"
	description="Vendor and supplier master data used on purchase orders, supplier invoices, and AP-related documents."
>
	<div class="mb-4 flex flex-wrap items-center gap-3">
		<a
			class="rounded-md bg-[var(--sf-green)] px-4 py-2 text-sm font-medium text-white hover:bg-[#2f5e2c]"
			href="/business-partners/suppliers/new"
		>
			New supplier
		</a>
		<a
			class="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
			href="/finance/expenses"
		>
			Supplier invoice expenses
		</a>
	</div>

	<form class="mb-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-3" method="GET">
		<label class="space-y-1 text-sm md:col-span-2">
			<span class="text-slate-700">Search</span>
			<input
				name="q"
				value={data.filters.q}
				class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--sf-green)]"
				placeholder="Name, item description, contact, WeChat..."
			/>
		</label>
		<label class="space-y-1 text-sm">
			<span class="text-slate-700">Project Related</span>
			<select
				name="project"
				class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--sf-green)]"
			>
				<option value="">All projects</option>
				{#each data.projectOptions as p}
					<option value={p} selected={data.filters.project === p.toLowerCase()}>{p}</option>
				{/each}
			</select>
		</label>
		<div class="md:col-span-3 flex gap-2">
			<button class="rounded-md bg-[var(--sf-green)] px-3 py-2 text-sm font-medium text-white hover:bg-[#2f5e2c]" type="submit">
				Apply filters
			</button>
			<a class="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" href="/business-partners/suppliers">
				Reset
			</a>
		</div>
	</form>

	<div class="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
		<table class="min-w-full divide-y divide-slate-200 text-sm">
			<thead class="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
				<tr>
					<th class="px-4 py-3">Name</th>
					<th class="px-4 py-3">Main Contact</th>
					<th class="px-4 py-3">Item Description</th>
					<th class="px-4 py-3">Date Create</th>
					<th class="px-4 py-3">Project Related</th>
					<th class="px-4 py-3">Address</th>
					<th class="px-4 py-3">Contacts</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#if data.suppliers.length === 0}
					<tr>
						<td colspan="7" class="px-4 py-8 text-center text-slate-500">
							No suppliers yet.
							<a class="font-medium text-[var(--sf-green)] hover:underline" href="/business-partners/suppliers/new">Add your first supplier</a>
							or open
							<a class="font-medium text-[var(--sf-green)] hover:underline" href="/finance/expenses">supplier invoice expenses</a>.
						</td>
					</tr>
				{:else}
					{#each data.suppliers as s}
						<tr class="hover:bg-slate-50/80">
							<td class="px-4 py-3 font-medium text-slate-900">
								<a class="hover:text-[var(--sf-green)] hover:underline" href={`/business-partners/suppliers/${s.id}`}>{s.name}</a>
							</td>
							<td class="px-4 py-3 text-slate-600">{s.contact ?? '-'}</td>
							<td class="px-4 py-3 text-slate-600">{s.itemDescription ?? '-'}</td>
							<td class="px-4 py-3 text-slate-600">{s.dateCreate ?? '-'}</td>
							<td class="px-4 py-3 text-slate-600">{s.projectRelated ?? '-'}</td>
							<td class="max-w-md truncate px-4 py-3 text-slate-600" title={s.address ?? ''}>{s.address ?? '-'}</td>
							<td class="px-4 py-3 text-slate-600">
								{#if s.contacts.length === 0}
									�?
								{:else}
									{#each s.contacts as c, i}
										<div class="text-xs">
											<span class="font-medium text-slate-800">{c.name}</span>
											{#if c.position}<span class="text-slate-500"> ({c.position})</span>{/if}
											{#if c.phoneEmail}<span class="text-slate-500"> · {c.phoneEmail}</span>{/if}
											{#if c.wechat}<span class="text-slate-500"> · WeChat: {c.wechat}</span>{/if}
										</div>
										{#if i < s.contacts.length - 1}
											<div class="my-1 h-px w-full bg-slate-100"></div>
										{/if}
									{/each}
								{/if}
							</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>
</PageShell>

