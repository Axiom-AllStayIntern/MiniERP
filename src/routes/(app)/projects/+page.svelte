<script lang="ts">
	let { data } = $props();

	const listHref = (page: number) => {
		const p = new URLSearchParams();
		p.set('page', String(page));
		if (data.filters.q) p.set('q', data.filters.q);
		if (data.filters.status) p.set('status', data.filters.status);
		if (data.filters.startedAfter) p.set('startedAfter', data.filters.startedAfter);
		const qs = p.toString();
		return qs ? `/projects?${qs}` : '/projects';
	};
</script>

<div class="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-6">
	<aside
		class="w-full shrink-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm lg:w-[220px] lg:rounded-lg lg:p-3"
		style="border-color: rgba(56, 114, 52, 0.15);"
	>
		<p class="px-2.5 pb-1 pt-1 text-[11px] font-medium uppercase tracking-wider text-slate-400">
			Projects
		</p>
		<nav class="flex flex-col gap-0.5">
			<a
				class="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] text-slate-600 hover:bg-slate-50"
				href="/projects"
			>
				<span class="opacity-70" aria-hidden="true">▦</span>
				All projects
				<span class="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
					{data.projectListCounts.all}
				</span>
			</a>
			<a
				class="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] text-slate-600 hover:bg-slate-50"
				href="/projects?status=active"
			>
				<span class="opacity-70" aria-hidden="true">◷</span>
				Active
				<span class="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
					{data.projectListCounts.active}
				</span>
			</a>
			<a
				class="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] text-slate-600 hover:bg-slate-50"
				href="/projects/new"
			>
				<span class="opacity-70" aria-hidden="true">+</span>
				New project
			</a>
		</nav>
	</aside>

	<div class="min-w-0 flex-1 space-y-5">
		<header class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
			<div class="min-w-0">
				<nav class="mb-1.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
					<a class="hover:text-[var(--sf-green)] hover:underline" href="/dashboard">Dashboard</a>
					<span class="text-slate-300">/</span>
					<span class="text-slate-600">Projects</span>
				</nav>
				<h1 class="text-xl font-medium text-slate-900">Projects</h1>
				<p class="mt-1 text-[13px] text-slate-600">
					Search and filter the project list, then open a project for profit breakdown and AR documents.
				</p>
			</div>
			<a
				href="/projects/new"
				class="inline-flex shrink-0 items-center justify-center rounded-md bg-[var(--sf-green)] px-3.5 py-2 text-[13px] font-medium text-white hover:bg-[#2f5e2c]"
			>
				Create project
			</a>
		</header>

		<section class="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
			<form class="grid gap-3 lg:grid-cols-[2fr_1fr_1.3fr_auto_auto]" method="GET" data-sveltekit-noscroll>
				<input type="hidden" name="page" value="1" />
				<label class="space-y-1">
					<span class="text-xs font-medium text-slate-600">Project search</span>
					<input
						class="w-full rounded border border-slate-300 px-3 py-2 text-sm"
						name="q"
						value={data.filters.q}
						placeholder="Project name / Project ID / Customer name"
					/>
				</label>
				<label class="space-y-1">
					<span class="text-xs font-medium text-slate-600">Status</span>
					<select class="w-full rounded border border-slate-300 px-3 py-2 text-sm" name="status">
						<option value="">All status</option>
						<option value="active" selected={data.filters.status === 'active'}>active</option>
						<option value="on_hold" selected={data.filters.status === 'on_hold'}>on_hold</option>
						<option value="completed" selected={data.filters.status === 'completed'}>completed</option>
						<option value="archived" selected={data.filters.status === 'archived'}>archived</option>
					</select>
				</label>
				<label class="space-y-1">
					<span class="text-xs font-medium text-slate-600">Started on or after</span>
					<input
						class="w-full rounded border border-slate-300 px-3 py-2 text-sm"
						name="startedAfter"
						type="date"
						value={data.filters.startedAfter}
					/>
				</label>
				<button
					class="h-10 rounded border border-[var(--sf-green)] bg-[var(--sf-green)] px-4 text-sm font-medium text-white hover:bg-[#2f5e2c] lg:mt-6"
					type="submit"
				>
					Apply
				</button>
				<a
					class="inline-flex h-10 items-center justify-center rounded border border-[var(--sf-gold)] bg-[var(--sf-gold-soft)] px-4 text-center text-sm font-medium text-[#7a5a07] hover:bg-[#f6e8b8] lg:mt-6"
					href="/projects"
					data-sveltekit-noscroll
				>
					Reset
				</a>
			</form>

			<div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
				<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Matched projects</p>
				{#if data.projects.length === 0}
					<p class="mt-2 text-sm text-slate-500">No projects found. Try another keyword or filter.</p>
				{:else}
					<div class="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white">
						<table class="min-w-full divide-y divide-slate-200 text-xs">
							<thead class="bg-slate-50 text-left text-slate-600">
								<tr>
									<th class="px-3 py-2">Project</th>
									<th class="px-3 py-2">Customer</th>
									<th class="px-3 py-2">Status</th>
									<th class="px-3 py-2">Start / End</th>
									<th class="px-3 py-2">Invoices</th>
									<th class="px-3 py-2">Action</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-slate-100">
								{#each data.projects as project}
									<tr class="hover:bg-slate-50/80">
										<td class="px-3 py-2">
											<p class="font-medium text-slate-800">{project.name}</p>
											<p class="text-slate-500">{project.id}</p>
											<p class="mt-0.5 text-[11px] text-slate-400">
												Updated {project.updatedAt.slice(0, 10)}
											</p>
										</td>
										<td class="px-3 py-2">{project.customerName ?? '--'}</td>
										<td class="px-3 py-2">
											<span class="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
												{project.status}
											</span>
										</td>
										<td class="px-3 py-2">
											{project.startDate ?? '--'} / {project.endDate ?? '--'}
										</td>
										<td class="px-3 py-2">{project.invoiceCount}</td>
										<td class="px-3 py-2">
											<a
												class="rounded border border-[var(--sf-green)] bg-[var(--sf-green-soft)] px-2 py-1 text-[var(--sf-green)] hover:bg-[#dcefd8]"
												href={`/projects/${project.id}`}
											>
												View details
											</a>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
					<div class="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
						<p>
							Page {data.pagination.page} / {data.pagination.totalPages} — Total projects:
							{data.pagination.total}
						</p>
						<div class="flex items-center gap-2">
							{#if data.pagination.hasPrev}
								<a
									class="rounded border border-slate-300 bg-white px-2 py-1 hover:bg-slate-100"
									href={listHref(data.pagination.page - 1)}
									data-sveltekit-noscroll
								>
									Previous
								</a>
							{/if}
							{#if data.pagination.hasNext}
								<a
									class="rounded border border-slate-300 bg-white px-2 py-1 hover:bg-slate-100"
									href={listHref(data.pagination.page + 1)}
									data-sveltekit-noscroll
								>
									Next
								</a>
							{/if}
						</div>
					</div>
				{/if}
			</div>
		</section>
	</div>
</div>
