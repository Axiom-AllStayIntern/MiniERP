<script lang="ts">
	import { page } from '$app/state';

	const navItems = [
		{ href: '/dashboard', label: 'Dashboard', prefix: '/dashboard' },
		{ href: '/ar', label: 'AR', prefix: '/ar' },
		{ href: '/projects', label: 'Projects', prefix: '/projects' },
		{ href: '/employees', label: 'Employees', prefix: '/employees' },
		{ href: '/tax', label: 'Tax', prefix: '/tax' },
		{ href: '/reports', label: 'Reports', prefix: '/reports' },
		{ href: '/settings', label: 'Settings', prefix: '/settings' }
	];
	const arItems = [
		{ href: '/ar/contracts', label: 'Contracts' },
		{ href: '/ar/quotations', label: 'Quotations' },
		{ href: '/ar/purchase-orders', label: 'Purchase Orders' },
		{ href: '/ar/customer-invoices', label: 'Customer Invoices' },
		{ href: '/ar/supplier-invoices', label: 'Supplier Invoices' }
	];

	let { children, data } = $props();
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
					{#each navItems as item}
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
					<form method="POST" action="/auth/logout">
						<button class="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100" type="submit">
							Logout
						</button>
					</form>
				{/if}
			</div>
		</div>
	</header>
	{#if page.url.pathname.startsWith('/ar')}
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
	<main class="mx-auto w-full max-w-7xl px-6 py-6">
		{@render children()}
	</main>
</div>
