<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { authClient } from '$platform/auth/client';

	let password = $state('');
	let password2 = $state('');
	let loading = $state(false);
	let error = $state('');

	const token = $derived(page.url.searchParams.get('token'));
	const tokenError = $derived(page.url.searchParams.get('error'));

	$effect(() => {
		if (tokenError === 'INVALID_TOKEN') {
			error = 'This reset link is invalid or has expired. Request a new one from “Forgot password�?';
		}
	});

	async function onSubmit(e: Event) {
		e.preventDefault();
		error = '';
		if (!token) {
			error = 'Missing token. Open the link from your email.';
			return;
		}
		if (password !== password2) {
			error = 'Passwords do not match.';
			return;
		}
		loading = true;
		const { error: err } = await authClient.resetPassword({
			newPassword: password,
			token
		});
		loading = false;
		if (err) {
			error = err.message || 'Could not reset password.';
			return;
		}
		await goto('/login?notice=reset');
	}
</script>

<main class="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-6 py-12">
	<div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
		<h1 class="text-2xl font-semibold text-slate-900">Set a new password</h1>
		{#if error}
			<p class="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
		{/if}
		{#if token || tokenError}
			<form class="mt-6 space-y-4" onsubmit={onSubmit}>
				<label class="block text-sm font-medium text-slate-700">
					New password
					<input
						type="password"
						autocomplete="new-password"
						bind:value={password}
						required
						minlength="8"
						class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-[var(--sf-green)] focus:ring-2"
					/>
				</label>
				<label class="block text-sm font-medium text-slate-700">
					Confirm password
					<input
						type="password"
						autocomplete="new-password"
						bind:value={password2}
						required
						minlength="8"
						class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-[var(--sf-green)] focus:ring-2"
					/>
				</label>
				<button
					type="submit"
					disabled={loading || !token}
					class="w-full rounded-md bg-[var(--sf-green)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#2f5e2c] disabled:opacity-60"
				>
					{loading ? 'Saving...' : 'Update password'}
				</button>
			</form>
		{/if}
		<a class="mt-4 inline-block text-sm text-[var(--sf-green)] underline" href="/login">Back to sign in</a>
	</div>
</main>


