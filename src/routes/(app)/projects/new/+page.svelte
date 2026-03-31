<script lang="ts">
	import PageShell from '$lib/components/PageShell.svelte';

	let { data, form } = $props();
</script>

<PageShell eyebrow="Project Management" title="创建项目" description="创建后将自动跳转到项目详情页。">
	<form class="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm" method="POST">
		{#if form?.message}
			<p class="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{form.message}</p>
		{/if}

		<div class="grid gap-4 md:grid-cols-2">
			<label class="space-y-1 text-sm">
				<span class="text-slate-700">客户</span>
				<select
					name="customerId"
					class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
					required
				>
					<option value="" disabled selected>请选择客户</option>
					{#each data.customers as customer}
						<option value={customer.id}>{customer.name}</option>
					{/each}
				</select>
			</label>

			<label class="space-y-1 text-sm">
				<span class="text-slate-700">项目名称</span>
				<input
					name="name"
					required
					class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
					placeholder="例如：2026 Q2 海运贸易项目"
				/>
			</label>

			<label class="space-y-1 text-sm">
				<span class="text-slate-700">状态</span>
				<select
					name="status"
					class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
				>
					<option value="active">active</option>
					<option value="on_hold">on_hold</option>
					<option value="completed">completed</option>
				</select>
			</label>

			<label class="space-y-1 text-sm">
				<span class="text-slate-700">开始日期</span>
				<input
					type="date"
					name="startDate"
					class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
				/>
			</label>

			<label class="space-y-1 text-sm">
				<span class="text-slate-700">结束日期</span>
				<input
					type="date"
					name="endDate"
					class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
				/>
			</label>
		</div>

		<label class="block space-y-1 text-sm">
			<span class="text-slate-700">项目描述</span>
			<textarea
				name="description"
				rows="4"
				class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
				placeholder="可填写项目背景、目标、注意事项。"
			></textarea>
		</label>

		<div class="flex gap-3">
			<button class="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700" type="submit">
				创建项目
			</button>
			<a class="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50" href="/projects">
				返回列表
			</a>
		</div>
	</form>
</PageShell>
