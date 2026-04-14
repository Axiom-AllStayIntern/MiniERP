<script lang="ts">
	import PageShell from '$lib/components/PageShell.svelte';
	import { agentPrefill, consumePrefill, parseDateToPrefill } from '$lib/agent/prefill';

	let { data, form } = $props();

	let projectName = $state('');
	let selectedCustomerId = $state('');
	let startDate = $state('');
	let endDate = $state('');
	let description = $state('');
	let status = $state('active');

	let lastPrefillVersion = $state(-1);

	$effect(() => {
		const state = $agentPrefill;
		if (state.version === lastPrefillVersion) return;
		lastPrefillVersion = state.version;

		const prefill = consumePrefill();
		if (Object.keys(prefill).length === 0) return;

		if (typeof prefill.project_name === 'string') {
			projectName = prefill.project_name;
		}
		if (prefill.start_date !== undefined) {
			const parsed = parseDateToPrefill(prefill.start_date);
			if (parsed) startDate = parsed;
		}
		if (prefill.end_date !== undefined) {
			const parsed = parseDateToPrefill(prefill.end_date);
			if (parsed) endDate = parsed;
		}
		if (typeof prefill.description === 'string') {
			description = prefill.description;
		}

		if (typeof prefill.customer_name === 'string') {
			const needle = prefill.customer_name.toLowerCase();
			const match = data.customers.find(
				(c: { id: string; name: string }) =>
					c.name.toLowerCase() === needle || c.name.toLowerCase().includes(needle)
			);
			if (match) {
				selectedCustomerId = match.id;
			}
		}
	});
</script>

<PageShell eyebrow="Project Management" title="Create Project" description="After submission, you will be redirected to the project detail page.">
	{#if data.customers.length === 0}
		<div class="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
			There are no customers yet.{' '}
			<a class="font-medium text-[var(--sf-green)] underline" href="/customers/new">Add a customer</a>
			first, then return here to create a project.
		</div>
	{:else}
		<p class="mb-4 text-sm text-slate-600">
			Need another billing party?
			<a class="font-medium text-[var(--sf-green)] hover:underline" href="/customers/new">New customer</a>
			·
			<a class="font-medium text-slate-600 hover:underline" href="/customers">All customers</a>
		</p>
	{/if}
	<form class="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm" method="POST">
		{#if form?.message}
			<p class="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{form.message}</p>
		{/if}

		<div class="grid gap-4 md:grid-cols-2">
			<label class="space-y-1 text-sm">
				<span class="text-slate-700">Customer</span>
				<select
					name="customerId"
					class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--sf-green)]"
					required
					bind:value={selectedCustomerId}
				>
					<option value="" disabled>Select a customer</option>
					{#each data.customers as customer}
						<option value={customer.id}>{customer.name}</option>
					{/each}
				</select>
			</label>

			<label class="space-y-1 text-sm">
				<span class="text-slate-700">Project Name</span>
				<input
					name="name"
					required
					class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--sf-green)]"
					placeholder="e.g. 2026 Q2 Sea Freight Project"
					bind:value={projectName}
				/>
			</label>

			<label class="space-y-1 text-sm">
				<span class="text-slate-700">Status</span>
				<select
					name="status"
					class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--sf-green)]"
					bind:value={status}
				>
					<option value="active">active</option>
					<option value="on_hold">on_hold</option>
					<option value="completed">completed</option>
				</select>
			</label>

			<label class="space-y-1 text-sm">
				<span class="text-slate-700">Start Date</span>
				<input
					type="date"
					name="startDate"
					class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--sf-green)]"
					bind:value={startDate}
				/>
			</label>

			<label class="space-y-1 text-sm">
				<span class="text-slate-700">End Date</span>
				<input
					type="date"
					name="endDate"
					class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--sf-green)]"
					bind:value={endDate}
				/>
			</label>
		</div>

		<label class="block space-y-1 text-sm">
			<span class="text-slate-700">Project Description</span>
			<textarea
				name="description"
				rows="4"
				class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--sf-green)]"
				placeholder="Add project background, goals, and notes."
				bind:value={description}
			></textarea>
		</label>

		<div class="flex gap-3">
			<button class="rounded-md bg-[var(--sf-green)] px-4 py-2 text-sm font-medium text-white hover:bg-[#2f5e2c]" type="submit">
				Create Project
			</button>
			<a class="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50" href="/projects">
				Back to List
			</a>
		</div>
	</form>
</PageShell>
