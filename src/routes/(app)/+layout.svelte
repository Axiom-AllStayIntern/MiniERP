<script lang="ts">
	import { page } from '$app/state';

	const navItems = [
		{ href: '/dashboard', label: 'Dashboard', prefix: '/dashboard' },
		{ href: '/ar/contracts', label: 'AR', prefix: '/ar' },
		{ href: '/projects', label: 'Projects', prefix: '/projects' },
		{ href: '/employees', label: 'Employees', prefix: '/employees' },
		{ href: '/tax', label: 'Tax', prefix: '/tax' },
		{ href: '/reports', label: 'Reports', prefix: '/reports' },
		{ href: '/settings', label: 'Settings', prefix: '/settings' }
	];

	let { children } = $props();
</script>

<div class="min-h-screen bg-slate-50">
	<header class="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
		<div class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
			<div class="flex items-center gap-3">
				<a class="text-lg font-semibold text-slate-900" href="/dashboard">SmartFin</a>
				<span class="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
					Project Shell v1
				</span>
			</div>
			<nav class="flex flex-wrap items-center gap-2">
				{#each navItems as item}
					<a
						class={`rounded-md px-3 py-1.5 text-sm transition ${
							page.url.pathname.startsWith(item.prefix)
								? 'bg-slate-900 text-white'
								: 'text-slate-600 hover:bg-slate-100'
						}`}
						href={item.href}
					>
						{item.label}
					</a>
				{/each}
			</nav>
		</div>
	</header>
	<main class="mx-auto w-full max-w-7xl px-6 py-6">
		{@render children()}
	</main>
</div>
