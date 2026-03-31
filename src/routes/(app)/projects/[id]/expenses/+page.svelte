<script lang="ts">
	import PageShell from '$lib/components/PageShell.svelte';
	let { data, form } = $props();
</script>

<PageShell
	eyebrow="Project / Expenses"
	title={`${data.project.name} - 费用管理`}
	description="当前版本支持手工录入费用，用于项目成本与利润计算。"
>
	{#if form?.message}
		<p class="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{form.message}</p>
	{/if}
	<form class="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-6" method="POST" action="?/create">
		<input class="rounded border border-slate-300 px-3 py-2 text-sm" name="category" placeholder="类别 (Trip/Logistics...)" required />
		<input class="rounded border border-slate-300 px-3 py-2 text-sm" name="subcategory" placeholder="子类（可选）" />
		<input class="rounded border border-slate-300 px-3 py-2 text-sm" name="amount" type="number" step="0.01" placeholder="金额" />
		<input class="rounded border border-slate-300 px-3 py-2 text-sm" name="currency" value="SGD" />
		<input class="rounded border border-slate-300 px-3 py-2 text-sm" name="date" type="date" required />
		<input class="rounded border border-slate-300 px-3 py-2 text-sm" name="staffName" placeholder="员工（可选）" />
		<input class="rounded border border-slate-300 px-3 py-2 text-sm md:col-span-5" name="notes" placeholder="备注（可选）" />
		<button class="rounded bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-700" type="submit">新增费用</button>
	</form>

	<div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
		<table class="min-w-full divide-y divide-slate-200 text-sm">
			<thead class="bg-slate-50 text-left text-slate-600">
				<tr><th class="px-4 py-3">日期</th><th class="px-4 py-3">类别</th><th class="px-4 py-3">金额</th><th class="px-4 py-3">员工</th></tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#if data.expenses.length === 0}
					<tr><td class="px-4 py-6 text-slate-500" colspan="4">暂无费用记录</td></tr>
				{:else}
					{#each data.expenses as item}
						<tr><td class="px-4 py-3">{item.date}</td><td class="px-4 py-3">{item.category}{item.subcategory ? ` / ${item.subcategory}` : ''}</td><td class="px-4 py-3">{item.amount} {item.currency}</td><td class="px-4 py-3">{item.staffName ?? '--'}</td></tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>
</PageShell>
