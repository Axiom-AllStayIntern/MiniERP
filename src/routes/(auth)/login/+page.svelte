<script lang="ts">
	let { form } = $props();
</script>

<main class="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-6 py-12">
	<div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
		<h1 class="text-2xl font-semibold text-slate-900">Sign in to SmartFin</h1>
		<p class="mt-2 text-sm text-slate-600">Local authentication is enabled for role-based access control.</p>
		{#if form?.message}
			<p class="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{form.message}</p>
		{/if}
		<form class="mt-6 space-y-4" method="POST">
			<label class="block text-sm font-medium text-slate-700">
				Name
				<input
					type="text"
					name="name"
					required
					class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-[var(--sf-green)] focus:ring-2"
					placeholder="Aki"
				/>
			</label>
			<label class="block text-sm font-medium text-slate-700">
				Email
				<input
					type="email"
					name="email"
					required
					class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-[var(--sf-green)] focus:ring-2"
					placeholder="name@company.com"
				/>
			</label>
			<label class="block text-sm font-medium text-slate-700">
				Role
				<select
					name="role"
					class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-[var(--sf-green)] focus:ring-2"
				>
					<option value="owner">owner</option>
					<option value="finance">finance</option>
					<option value="project_manager">project_manager</option>
					<option value="employee">employee</option>
				</select>
			</label>
			<button
				type="submit"
				class="w-full rounded-md bg-[var(--sf-green)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#2f5e2c]"
			>
				Sign In
			</button>
		</form>
	</div>
</main>
