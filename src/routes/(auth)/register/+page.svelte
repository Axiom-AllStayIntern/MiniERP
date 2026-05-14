<script lang="ts">
	import { authClient } from '$platform/auth/client';
	import type { AuthRole } from '$platform/auth/config';

	const roleOptions: Array<{ value: AuthRole; label: string; note: string }> = [
		{ value: 'owner', label: 'Owner', note: 'Full suite access' },
		{ value: 'finance', label: 'Finance', note: 'Finance and document intake' },
		{ value: 'project_manager', label: 'Project manager', note: 'Project workspace' },
		{ value: 'hr', label: 'HR', note: 'Employee workspace' },
		{ value: 'employee', label: 'Employee', note: 'Project entry access' }
	];

	let name = $state('');
	let email = $state('');
	let password = $state('');
	let role = $state<AuthRole>('owner');
	let loading = $state(false);
	let error = $state('');
	let done = $state(false);

	async function onSubmit(e: Event) {
		e.preventDefault();
		loading = true;
		error = '';
		const callbackURL = `${window.location.origin}/login?verified=1`;
		const payload: Parameters<typeof authClient.signUp.email>[0] & { role: AuthRole } = {
			name: name.trim(),
			email: email.trim().toLowerCase(),
			password,
			role,
			callbackURL
		};
		const { error: err } = await authClient.signUp.email(payload);
		loading = false;
		if (err) {
			error = err.message || 'Registration failed.';
			return;
		}
		done = true;
	}
</script>

<main class="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-6 py-12">
	<div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
		<h1 class="text-2xl font-semibold text-slate-900">Create your SmartFin account</h1>
		<p class="mt-2 text-sm text-slate-600">
			We will send a verification link to your email. You can sign in only after verifying.
		</p>
		{#if done}
			<p class="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
				If this email was new, check your inbox to verify. If the address was already registered, we sent a short
				notice to that inbox instead.
			</p>
			<a class="mt-4 inline-block text-sm font-medium text-[var(--sf-green)] underline" href="/login?notice=check-email"
				>Back to sign in</a
			>
		{:else}
			{#if error}
				<p class="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
			{/if}
			<form class="mt-6 space-y-4" onsubmit={onSubmit}>
				<label class="block text-sm font-medium text-slate-700">
					Name
					<input
						type="text"
						autocomplete="name"
						bind:value={name}
						required
						class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-[var(--sf-green)] focus:ring-2"
					/>
				</label>
				<label class="block text-sm font-medium text-slate-700">
					Email
					<input
						type="email"
						autocomplete="email"
						bind:value={email}
						required
						class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-[var(--sf-green)] focus:ring-2"
					/>
				</label>
				<label class="block text-sm font-medium text-slate-700">
					Password
					<input
						type="password"
						autocomplete="new-password"
						bind:value={password}
						required
						minlength="8"
						class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-[var(--sf-green)] focus:ring-2"
					/>
					<span class="mt-1 block text-xs text-slate-500">At least 8 characters.</span>
				</label>
				<label class="block text-sm font-medium text-slate-700">
					Test identity
					<select
						bind:value={role}
						class="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-[var(--sf-green)] focus:ring-2"
					>
						{#each roleOptions as option}
							<option value={option.value}>{option.label} - {option.note}</option>
						{/each}
					</select>
				</label>
				<button
					type="submit"
					disabled={loading}
					class="w-full rounded-md bg-[var(--sf-green)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#2f5e2c] disabled:opacity-60"
				>
					{loading ? 'Creating...' : 'Register'}
				</button>
			</form>
			<p class="mt-4 text-center text-sm text-slate-600">
				Already have an account?
				<a class="font-medium text-[var(--sf-green)] underline" href="/login">Sign in</a>
			</p>
		{/if}
	</div>
</main>
