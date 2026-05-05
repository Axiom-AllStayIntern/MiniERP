<script lang="ts">
	import { authClient } from '$platform/auth/client';

	let email = $state('');
	let loading = $state(false);
	let message = $state('');
	let error = $state('');

	async function onSubmit(e: Event) {
		e.preventDefault();
		loading = true;
		error = '';
		message = '';
		const redirectTo = `${window.location.origin}/reset-password`;
		const { error: err } = await authClient.requestPasswordReset({
			email: email.trim().toLowerCase(),
			redirectTo
		});
		loading = false;
		if (err) {
			error = err.message || 'Request failed.';
			return;
		}
		message = 'If an account exists for this email, we sent reset instructions.';
	}
</script>

<main class="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-6 py-12">
	<div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
		<h1 class="text-2xl font-semibold text-slate-900">Forgot password</h1>
		<p class="mt-2 text-sm text-slate-600">We will email you a link to set a new password.</p>
		{#if message}
			<p class="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>
		{/if}
		{#if error}
			<p class="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
		{/if}
		<form class="mt-6 space-y-4" onsubmit={onSubmit}>
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
			<button
				type="submit"
				disabled={loading}
				class="w-full rounded-md bg-[var(--sf-green)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#2f5e2c] disabled:opacity-60"
			>
				{loading ? 'Sending...' : 'Send reset link'}
			</button>
		</form>
		<a class="mt-4 inline-block text-sm text-[var(--sf-green)] underline" href="/login">Back to sign in</a>
	</div>
</main>


