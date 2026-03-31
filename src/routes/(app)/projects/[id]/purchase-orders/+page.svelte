<script lang="ts">
	import PageShell from '$lib/components/PageShell.svelte';
	let { data, form } = $props();
</script>

<PageShell
	eyebrow="Project / Purchase Orders"
	title={`${data.project.name} - 采购单管理`}
	description="当前版本支持手工录入采购单基础信息，用于后续供应商发票匹配。"
>
	{#if form?.message}
		<p class="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{form.message}</p>
	{/if}
	<form class="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-5" method="POST" action="?/create">
		<input class="rounded border border-slate-300 px-3 py-2 text-sm" name="poNumber" placeholder="PO编号（可空自动生成）" />
		<input class="rounded border border-slate-300 px-3 py-2 text-sm" name="supplierName" placeholder="供应商名称" required />
		<input class="rounded border border-slate-300 px-3 py-2 text-sm" name="amount" type="number" step="0.01" placeholder="金额" />
		<input class="rounded border border-slate-300 px-3 py-2 text-sm" name="currency" value="SGD" />
		<input class="rounded border border-slate-300 px-3 py-2 text-sm" name="date" type="date" />
		<button class="rounded bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-700 md:col-span-5" type="submit">新增采购单</button>
	</form>

	<div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
		<table class="min-w-full divide-y divide-slate-200 text-sm">
			<thead class="bg-slate-50 text-left text-slate-600">
				<tr><th class="px-4 py-3">PO编号</th><th class="px-4 py-3">供应商</th><th class="px-4 py-3">金额</th><th class="px-4 py-3">日期</th></tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#if data.purchaseOrders.length === 0}
					<tr><td class="px-4 py-6 text-slate-500" colspan="4">暂无采购单记录</td></tr>
				{:else}
					{#each data.purchaseOrders as item}
						<tr><td class="px-4 py-3">{item.poNumber}</td><td class="px-4 py-3">{item.supplierName ?? '--'}</td><td class="px-4 py-3">{item.amount ?? 0} {item.currency ?? 'SGD'}</td><td class="px-4 py-3">{item.date ?? '--'}</td></tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>
</PageShell>
