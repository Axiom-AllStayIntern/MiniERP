<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { authClient } from '$lib/auth-client';
	import AgentChat from '$lib/components/AgentChat.svelte';

	const navItems = [
		{ href: '/dashboard', label: 'Dashboard', prefix: '/dashboard', moduleId: null },
		{ href: '/ar', label: 'AR', prefix: '/ar', moduleId: 'ar' },
		{ href: '/customers', label: 'Customers', prefix: '/customers', moduleId: 'business-partner' },
		{ href: '/projects', label: 'Projects', prefix: '/projects', moduleId: 'project' },
		{ href: '/employees', label: 'Employees', prefix: '/employees', moduleId: 'employee' },
		{ href: '/tax', label: 'Tax', prefix: '/tax', moduleId: 'tax' },
		{ href: '/reports', label: 'Reports', prefix: '/reports', moduleId: 'reporting' },
		{ href: '/settings', label: 'Settings', prefix: '/settings', moduleId: 'core' }
	];
	const arItems = [
		{ href: '/ar/contracts', label: 'Contracts' },
		{ href: '/ar/quotations', label: 'Quotations' },
		{ href: '/ar/purchase-orders', label: 'Purchase Orders' },
		{ href: '/ar/customer-invoices', label: 'Customer Invoices' },
		{ href: '/ar/supplier-invoices', label: 'Supplier Invoices' },
		{ href: '/ar/document-upload', label: 'Document Upload' }
	];

	let { children, data } = $props();
	const enabledModules = $derived(new Set((data.enabledModules as string[] | undefined) ?? []));
	const visibleNavItems = $derived(
		navItems.filter((item) => item.moduleId === null || item.moduleId === 'core' || enabledModules.has(item.moduleId))
	);

	/** 单项目页：主内容区与顶栏 max-w-7xl 的左缘对齐，向右占满视口（不在更宽的盒子里居中），避免侧栏左移 */
	const wideProjectDetailMain = $derived(/^\/projects\/(?!new$)[^/]+/.test(page.url.pathname));

	async function logout() {
		await authClient.signOut();
		await goto('/login');
	}
</script>

<div class="theme-shell">
	<header class="sticky top-0 z-20 border-b bg-white/90 backdrop-blur" style="border-color: rgba(56, 114, 52, 0.2);">
		<div class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
			<div class="flex items-center gap-3">
				<a class="text-lg font-semibold theme-accent" href="/dashboard">SmartFin</a>
				<span class="rounded-full px-2 py-0.5 text-xs font-medium" style="background: #fdf7e2; color: #7a5a07;">
					Project Shell v1
				</span>
			</div>
			<div class="flex flex-wrap items-center gap-3">
				<nav class="flex flex-wrap items-center gap-2">
					{#each visibleNavItems as item}
						<a
							class={`rounded-md px-3 py-1.5 text-sm transition ${
								page.url.pathname.startsWith(item.prefix)
									? 'theme-nav-active'
									: 'text-slate-600 hover:bg-[rgba(56,114,52,0.10)]'
							}`}
							href={item.href}
						>
							{item.label}
						</a>
					{/each}
				</nav>
				{#if data.user}
					<div class="flex items-center gap-2 text-xs text-slate-600">
						<span class="rounded-full bg-slate-100 px-2 py-1 font-medium">{data.user.email}</span>
						<span class="rounded-full px-2 py-1 font-medium" style="background: #eef6ec; color: #387234;">{data.user.role}</span>
					</div>
					<button
						type="button"
						class="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
						onclick={() => logout()}
					>
						Logout
					</button>
				{/if}
			</div>
		</div>
	</header>
	{#if page.url.pathname.startsWith('/ar') && enabledModules.has('ar')}
		<div class="border-b bg-white" style="border-color: rgba(56, 114, 52, 0.15);">
			<div class="mx-auto flex max-w-7xl flex-wrap gap-2 px-6 py-3">
				{#each arItems as item}
					<a
						class={`rounded-md px-3 py-1.5 text-sm transition ${
							page.url.pathname === item.href
								? 'theme-subnav-active'
								: 'text-slate-600 hover:bg-[rgba(234,188,60,0.20)]'
						}`}
						href={item.href}
					>
						{item.label}
					</a>
				{/each}
			</div>
		</div>
	{/if}
	<main class="w-full py-6">
		{#if wideProjectDetailMain}
			<div class="pr-6 pl-[calc((100vw-min(80rem,100vw))/2+1.5rem)]">
				{@render children()}
			</div>
		{:else}
			<div class="mx-auto w-full max-w-7xl px-6">
				{@render children()}
			</div>
		{/if}
	</main>
	<AgentChat />
</div>
