<script lang="ts">
	import PageShell from '$lib/components/PageShell.svelte';
</script>

<PageShell
	eyebrow="Dashboard"
	title="SmartFin 控制台"
	description="当前阶段先完善系统外壳和项目管理模块，其他模块先保持结构化占位。"
>
	<section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
		{#each ['总收入', '总支出', '净利润', '待收款/待付款'] as metric}
			<article class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
				<p class="text-sm text-slate-500">{metric}</p>
				<p class="mt-3 text-2xl font-semibold text-slate-900">--</p>
			</article>
		{/each}
	</section>

	<section class="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
		项目管理模块优先级最高：先完成项目列表、创建、详情与利润拆解闭环。
	</section>
</PageShell>
