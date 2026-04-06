<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';

	let { data, children } = $props();

	type ArPickKind = 'contracts' | 'quotations' | 'purchaseOrders' | 'expenses';
	let settingsOpen = $state(false);

	const formatStatus = (s: string) =>
		s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

	const formatShortDate = (d: string | null | undefined) => {
		if (!d) return '';
		const dt = new Date(d);
		if (Number.isNaN(dt.getTime())) return d;
		return dt.toLocaleDateString('en-SG', { month: 'short', day: 'numeric', year: 'numeric' });
	};

	const dateRangeLabel = $derived.by(() => {
		const a = data.project.startDate;
		const b = data.project.endDate;
		if (a && b) return `${formatShortDate(a)} – ${formatShortDate(b)}`;
		if (a) return `From ${formatShortDate(a)}`;
		if (b) return `Until ${formatShortDate(b)}`;
		return '';
	});

	const base = $derived(`/projects/${data.project.id}`);
	const path = $derived(page.url.pathname);
	const docQ = $derived(page.url.searchParams.get('doc') ?? '');
	const onProjectOverview = $derived(path === base);

	const isEmployeesNav = $derived(path.includes('/employees'));
	const isInvoicesNav = $derived(path.includes('/invoices'));
	const isDocumentsSection = $derived(!isEmployeesNav && !isInvoicesNav);

	const isContractsNav = $derived(
		path.startsWith(`${base}/contracts`) || (onProjectOverview && docQ === 'contracts')
	);
	const isQuotationsNav = $derived(
		path.startsWith(`${base}/quotations`) || (onProjectOverview && docQ === 'quotations')
	);
	const isPoNav = $derived(
		path.startsWith(`${base}/purchase-orders`) || (onProjectOverview && docQ === 'purchaseOrders')
	);
	const isExpensesNav = $derived(
		path.startsWith(`${base}/expenses`) || (onProjectOverview && docQ === 'expenses')
	);

	const goDocSection = (kind: ArPickKind) => {
		goto(`${base}?doc=${encodeURIComponent(kind)}`, { noScroll: true, replaceState: true });
	};

	const projectAction = (action: string) => `${base}?/${action}`;

	const formMessage = $derived(
		page.form && typeof page.form === 'object' && page.form !== null && 'message' in page.form
			? String((page.form as { message?: string }).message ?? '')
			: ''
	);

	const tabBtn = (active: boolean) =>
		`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] transition ${
			active
				? 'bg-[var(--sf-green-soft)] font-medium text-[var(--sf-green)]'
				: 'text-slate-600 hover:bg-slate-50'
		}`;

	const docSubBtn = (active: boolean) =>
		`flex w-full cursor-pointer items-center gap-2 rounded-md py-2 pl-3 pr-2 text-left text-xs ${
			active ? 'bg-white font-medium text-[var(--sf-green)] shadow-sm' : 'text-slate-600 hover:bg-slate-50/80'
		}`;
</script>

<div class="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-6">
	<aside
		class="w-full shrink-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm lg:w-[248px] lg:rounded-lg lg:p-3"
		style="border-color: rgba(56, 114, 52, 0.15);"
	>
		<p class="px-2.5 pb-1 pt-1 text-[11px] font-medium uppercase tracking-wider text-slate-400">Projects</p>
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
		<div class="my-2 h-px bg-slate-200"></div>
		<p class="px-2.5 pb-2 pt-1 text-[11px] font-medium uppercase tracking-wider text-slate-400">This project</p>

		<nav class="flex flex-col gap-1.5">
			<div class="rounded-lg border border-slate-100 bg-slate-50/80 p-1">
				<a class={tabBtn(isDocumentsSection)} href={base}>
					<span class="opacity-70" aria-hidden="true">▤</span>
					Document
				</a>
				{#if isDocumentsSection}
					<div class="mt-1 space-y-0.5 border-t border-slate-200/80 pt-1.5">
						<button type="button" class={docSubBtn(isContractsNav)} onclick={() => goDocSection('contracts')}>
							<span aria-hidden="true">›</span>
							Contracts
							<span
								class={`ml-auto rounded-full px-2 py-0.5 text-[11px] ${
									isContractsNav ? 'bg-[var(--sf-green-soft)] text-[var(--sf-green)]' : 'bg-white text-slate-600'
								}`}
							>
								{data.submoduleCounts.contracts}
							</span>
						</button>
						<button type="button" class={docSubBtn(isQuotationsNav)} onclick={() => goDocSection('quotations')}>
							<span aria-hidden="true">›</span>
							Quotations
							<span
								class={`ml-auto rounded-full px-2 py-0.5 text-[11px] ${
									isQuotationsNav ? 'bg-[var(--sf-green-soft)] text-[var(--sf-green)]' : 'bg-white text-slate-600'
								}`}
							>
								{data.submoduleCounts.quotations}
							</span>
						</button>
						<button type="button" class={docSubBtn(isPoNav)} onclick={() => goDocSection('purchaseOrders')}>
							<span aria-hidden="true">›</span>
							Purchase orders
							<span
								class={`ml-auto rounded-full px-2 py-0.5 text-[11px] ${
									isPoNav ? 'bg-[var(--sf-green-soft)] text-[var(--sf-green)]' : 'bg-white text-slate-600'
								}`}
							>
								{data.submoduleCounts.purchaseOrders}
							</span>
						</button>
						<button type="button" class={docSubBtn(isExpensesNav)} onclick={() => goDocSection('expenses')}>
							<span aria-hidden="true">›</span>
							Expenses
							<span
								class={`ml-auto rounded-full px-2 py-0.5 text-[11px] ${
									isExpensesNav ? 'bg-[var(--sf-green-soft)] text-[var(--sf-green)]' : 'bg-white text-slate-600'
								}`}
							>
								{data.submoduleCounts.expenses}
							</span>
						</button>
					</div>
				{/if}
			</div>

			<a class={tabBtn(isEmployeesNav)} href={`${base}/employees`}>
				<span class="opacity-70" aria-hidden="true">◎</span>
				Project employee
			</a>
			<a class={tabBtn(isInvoicesNav)} href={`${base}/invoices`}>
				<span class="opacity-70" aria-hidden="true">¥</span>
				Invoices
			</a>
		</nav>
	</aside>

	<div class="flex min-w-0 flex-1 flex-col gap-5 lg:flex-row lg:items-start lg:gap-5">
		<div class="min-w-0 flex-1 space-y-5">
			<header class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div class="min-w-0">
					<nav class="mb-1.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
						<a class="hover:text-[var(--sf-green)] hover:underline" href="/dashboard">Dashboard</a>
						<span class="text-slate-300">/</span>
						<a class="hover:text-[var(--sf-green)] hover:underline" href="/projects">Projects</a>
						<span class="text-slate-300">/</span>
						<span class="text-slate-600">{data.project.name}</span>
					</nav>
					<h1 class="text-xl font-medium text-slate-900">{data.project.name}</h1>
					<div class="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-slate-600">
						<span>{data.customerName}</span>
						<span
							class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
							style="background: var(--sf-green-soft); color: var(--sf-green);"
						>
							<span class="h-1.5 w-1.5 rounded-full bg-[var(--sf-green)]"></span>
							{formatStatus(data.project.status)}
						</span>
						{#if dateRangeLabel}
							<span class="text-slate-400">{dateRangeLabel}</span>
						{/if}
					</div>
				</div>
				<button
					type="button"
					class="shrink-0 rounded-md border border-slate-200 bg-white px-3.5 py-1.5 text-[13px] font-medium text-slate-800 hover:bg-slate-50"
					onclick={() => {
						settingsOpen = true;
					}}
				>
					修改项目信息
				</button>
			</header>

			<div class="min-w-0 space-y-5">
				{@render children?.()}
			</div>
		</div>

		<div class="w-full shrink-0 self-start lg:sticky lg:top-24 lg:z-10 lg:w-72">
			<section
				class="flex max-h-[min(70vh,640px)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
			>
				<div class="shrink-0 border-b border-slate-200 px-4 py-3">
					<h2 class="text-[13px] font-semibold text-slate-900">Recent updates</h2>
					<p class="mt-0.5 text-[11px] text-slate-500">项目最近动态与通知（审计日志）</p>
				</div>
				<div class="min-h-0 flex-1 overflow-y-auto px-3 py-3">
					{#if data.activityFeed.length === 0}
						<p class="px-2 py-8 text-center text-xs text-slate-500">
							暂无动态。编辑本项目或 AR 子模块后会显示在这里。
						</p>
					{:else}
						<div class="flex flex-col gap-2.5">
							{#each data.activityFeed as item}
								<div
									class="rounded-lg border px-3 py-2.5 {item.variant === 'success'
										? 'border-emerald-100 bg-emerald-50/50'
										: item.variant === 'warn'
											? 'border-amber-100 bg-amber-50/40'
											: 'border-sky-100 bg-sky-50/40'}"
								>
									<p class="text-[12px] leading-snug text-slate-800">{item.summary}</p>
									<p class="mt-1.5 text-[10px] text-slate-500">
										<span class="font-medium text-slate-600">{item.actor}</span>
										<span class="text-slate-300"> · </span>
										{item.timeLabel}
									</p>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</section>
		</div>
	</div>
</div>

{#if settingsOpen}
	<div class="fixed inset-0 z-[70] flex items-center justify-center p-4">
		<button
			type="button"
			class="absolute inset-0 bg-slate-900/50"
			aria-label="Close settings"
			onclick={() => {
				settingsOpen = false;
			}}
		></button>
		<div
			class="relative max-h-[90vh] w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
			role="dialog"
			aria-modal="true"
			aria-labelledby="project-settings-title"
		>
			<div class="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
				<h2 id="project-settings-title" class="text-sm font-semibold text-slate-900">Project settings</h2>
				<button
					type="button"
					class="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
					onclick={() => {
						settingsOpen = false;
					}}
				>
					Close
				</button>
			</div>
			<div class="max-h-[calc(90vh-8rem)] overflow-y-auto p-5">
				<form
					id="project-settings-form"
					class="space-y-4"
					method="POST"
					action={projectAction('update')}
					use:enhance={() => {
						return async ({ result }) => {
							if (result.type === 'success') {
								settingsOpen = false;
								await invalidateAll();
							}
						};
					}}
				>
					{#if formMessage}
						<p class="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{formMessage}</p>
					{/if}

					<label class="block space-y-1.5 text-xs font-medium text-slate-700">
						Project name
						<input
							name="name"
							required
							value={data.project.name}
							class="h-9 w-full rounded-md border border-slate-300 px-2.5 text-[13px] font-normal outline-none focus:border-[var(--sf-green)] focus:ring-1 focus:ring-[var(--sf-green)]"
						/>
					</label>

					<label class="block space-y-1.5 text-xs font-medium text-slate-700">
						Customer
						<input
							readonly
							value={data.customerName}
							class="h-9 w-full cursor-not-allowed rounded-md border border-slate-200 bg-slate-50 px-2.5 text-[13px] font-normal text-slate-600"
						/>
					</label>

					<label class="block space-y-1.5 text-xs font-medium text-slate-700">
						Status
						<select
							name="status"
							class="h-9 w-full rounded-md border border-slate-300 px-2.5 text-[13px] font-normal outline-none focus:border-[var(--sf-green)] focus:ring-1 focus:ring-[var(--sf-green)]"
							value={data.project.status}
						>
							<option value="active">active</option>
							<option value="on_hold">on_hold</option>
							<option value="completed">completed</option>
							<option value="archived">archived</option>
						</select>
					</label>

					<div class="grid grid-cols-2 gap-3">
						<label class="block space-y-1.5 text-xs font-medium text-slate-700">
							Start date
							<input
								type="date"
								name="startDate"
								value={data.project.startDate ?? ''}
								class="h-9 w-full rounded-md border border-slate-300 px-2.5 text-[13px] font-normal outline-none focus:border-[var(--sf-green)] focus:ring-1 focus:ring-[var(--sf-green)]"
							/>
						</label>
						<label class="block space-y-1.5 text-xs font-medium text-slate-700">
							End date
							<input
								type="date"
								name="endDate"
								value={data.project.endDate ?? ''}
								class="h-9 w-full rounded-md border border-slate-300 px-2.5 text-[13px] font-normal outline-none focus:border-[var(--sf-green)] focus:ring-1 focus:ring-[var(--sf-green)]"
							/>
						</label>
					</div>

					<label class="block space-y-1.5 text-xs font-medium text-slate-700">
						Description
						<textarea
							name="description"
							rows="4"
							class="w-full resize-none rounded-md border border-slate-300 px-2.5 py-2 text-[13px] font-normal outline-none focus:border-[var(--sf-green)] focus:ring-1 focus:ring-[var(--sf-green)]"
						>{data.project.description ?? ''}</textarea>
					</label>

					<div class="flex gap-2 pt-2">
						<button
							type="submit"
							class="flex-1 rounded-md bg-[var(--sf-green)] py-2 text-[13px] font-medium text-white hover:bg-[#2f5e2c]"
						>
							Save changes
						</button>
						<button
							type="button"
							class="rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-800 hover:bg-slate-50"
							onclick={() => invalidateAll()}
						>
							Reset
						</button>
					</div>
				</form>

				<div class="mt-6 flex flex-wrap gap-2 border-t border-slate-200 pt-4">
					<form
						method="POST"
						action={projectAction('archive')}
						use:enhance={() => {
							return async ({ result }) => {
								if (result.type === 'success') {
									settingsOpen = false;
									await invalidateAll();
								}
							};
						}}
					>
						<button
							type="submit"
							class="rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
						>
							Archive project
						</button>
					</form>
					<form method="POST" action={projectAction('remove')}>
						<button
							type="submit"
							class="rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100"
						>
							Remove project
						</button>
					</form>
				</div>
			</div>
		</div>
	</div>
{/if}
