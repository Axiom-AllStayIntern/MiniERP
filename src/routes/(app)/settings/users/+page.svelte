<script lang="ts">
	import PageShell from '$app-layer/components/PageShell.svelte';

	let { data, form } = $props();

	let editingUserId = $state<string | null>(null);

	function roleBadgeClass(role: string) {
		const m: Record<string, string> = {
			owner: 'bg-purple-50 text-purple-700 border-purple-200',
			admin: 'bg-indigo-50 text-indigo-700 border-indigo-200',
			finance: 'bg-emerald-50 text-emerald-700 border-emerald-200',
			project_manager: 'bg-blue-50 text-blue-700 border-blue-200',
			hr: 'bg-amber-50 text-amber-700 border-amber-200',
			staff: 'bg-slate-50 text-slate-600 border-slate-200',
			employee: 'bg-gray-50 text-gray-600 border-gray-200'
		};
		return m[role] ?? 'bg-gray-50 text-gray-600 border-gray-200';
	}
</script>

<PageShell
	eyebrow="Settings"
	title="Team Members"
	description="Manage team members and their roles. Role changes take effect on next login."
>
	{#if form?.message}
		<p
			class={`mb-4 rounded-md border px-3 py-2 text-sm ${
				form.saved
					? 'border-emerald-200 bg-emerald-50 text-emerald-700'
					: 'border-rose-200 bg-rose-50 text-rose-700'
			}`}
		>
			{form.message}
		</p>
	{/if}

	<div class="rounded-xl border border-slate-200 bg-white shadow-sm">
		<div class="border-b border-slate-200 px-6 py-4">
			<div class="flex items-center justify-between">
				<h2 class="text-base font-semibold text-slate-800">{data.users.length} members</h2>
				<a
					href="/settings/invites"
					class="rounded-md bg-[var(--sf-green)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#2f5e2c]"
				>
					Invite new member
				</a>
			</div>
		</div>

		<div class="divide-y divide-slate-100">
			{#each data.users as u (u.id)}
				<div class="px-6 py-4">
					<div class="flex items-start justify-between gap-4">
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2">
								<p class="text-sm font-medium text-slate-800">{u.name}</p>
								{#if !u.isActive}
									<span class="rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] uppercase text-rose-600">Deactivated</span>
								{/if}
							</div>
							<p class="mt-0.5 text-xs text-slate-500">{u.email}</p>
							<div class="mt-2 flex flex-wrap gap-1">
								{#each u.roles as role}
									<span class={`rounded border px-2 py-0.5 text-[11px] font-medium ${roleBadgeClass(role)}`}>{role}</span>
								{/each}
							</div>
						</div>
						<div class="flex gap-2">
							{#if editingUserId !== u.id}
								<button
									type="button"
									onclick={() => (editingUserId = u.id)}
									class="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
								>Edit roles</button>
								{#if u.isActive}
									<form method="POST" action="?/deactivate">
										<input type="hidden" name="userId" value={u.id} />
										<button type="submit" class="rounded border border-rose-200 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50">Deactivate</button>
									</form>
								{:else}
									<form method="POST" action="?/reactivate">
										<input type="hidden" name="userId" value={u.id} />
										<button type="submit" class="rounded border border-emerald-200 px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50">Reactivate</button>
									</form>
								{/if}
							{:else}
								<button
									type="button"
									onclick={() => (editingUserId = null)}
									class="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
								>Cancel</button>
							{/if}
						</div>
					</div>

					{#if editingUserId === u.id}
						<form method="POST" action="?/updateRoles" class="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
							<input type="hidden" name="userId" value={u.id} />
							<div class="flex flex-wrap gap-3">
								{#each data.allRoles as role}
									<label class="flex items-center gap-1.5 text-xs">
										<input
											type="checkbox"
											name="role"
											value={role}
											checked={u.roles.includes(role)}
											class="h-3.5 w-3.5 rounded border-slate-300 text-[var(--sf-green)] focus:ring-[var(--sf-green)]"
										/>
										{role}
									</label>
								{/each}
							</div>
							<button
								type="submit"
								class="mt-3 rounded-md bg-[var(--sf-green)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#2f5e2c]"
							>
								Save Roles
							</button>
						</form>
					{/if}
				</div>
			{/each}
		</div>
	</div>
</PageShell>
