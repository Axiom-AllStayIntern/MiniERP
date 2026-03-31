<script lang="ts">
	import PageShell from '$lib/components/PageShell.svelte';
	let { data } = $props();
</script>

<PageShell
	eyebrow="Project / Contracts"
	title={`${data.project.name} - 合同管理`}
	description="当前版本支持手工录入合同金额与日期，文件上传后续接入。"
>
	<form class="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-5" method="POST" action="?/create">
		<input class="rounded border border-slate-300 px-3 py-2 text-sm" name="amount" type="number" step="0.01" placeholder="金额" />
		<input class="rounded border border-slate-300 px-3 py-2 text-sm" name="currency" placeholder="币种 SGD" value="SGD" />
		<input class="rounded border border-slate-300 px-3 py-2 text-sm" name="date" type="date" />
		<input class="rounded border border-slate-300 px-3 py-2 text-sm md:col-span-2" name="notes" placeholder="备注（可选）" />
		<button class="rounded bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-700 md:col-span-5" type="submit">新增合同记录</button>
	</form>

	<div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
		<table class="min-w-full divide-y divide-slate-200 text-sm">
			<thead class="bg-slate-50 text-left text-slate-600">
				<tr><th class="px-4 py-3">日期</th><th class="px-4 py-3">金额</th><th class="px-4 py-3">币种</th><th class="px-4 py-3">来源</th></tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#if data.contracts.length === 0}
					<tr><td class="px-4 py-6 text-slate-500" colspan="4">暂无合同记录</td></tr>
				{:else}
					{#each data.contracts as item}
						<tr><td class="px-4 py-3">{item.date ?? '--'}</td><td class="px-4 py-3">{item.amount ?? 0}</td><td class="px-4 py-3">{item.currency ?? 'SGD'}</td><td class="px-4 py-3 text-slate-500">manual</td></tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>
</PageShell>
