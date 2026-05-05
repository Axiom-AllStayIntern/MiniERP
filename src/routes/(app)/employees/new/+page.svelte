<script lang="ts">
	import PageShell from '$app-layer/components/PageShell.svelte';
	import { agentPrefill, consumePrefill, parseDateToPrefill } from '$app-layer/ai-panel/state/prefill';

	let { form } = $props();

	let name = $state('');
	let type = $state('full_time');
	let status = $state('active');
	let startDate = $state('');
	let endDate = $state('');
	let contact = $state('');
	let taxId = $state('');

	let lastPrefillVersion = $state(-1);

	$effect(() => {
		const state = $agentPrefill;
		if (state.version === lastPrefillVersion) return;
		lastPrefillVersion = state.version;

		const prefill = consumePrefill();
		if (Object.keys(prefill).length === 0) return;

		if (typeof prefill.name === 'string') name = prefill.name;
		if (typeof prefill.employee_name === 'string') name = prefill.employee_name;
		if (typeof prefill.type === 'string') type = prefill.type;
		if (typeof prefill.status === 'string') status = prefill.status;
		if (prefill.start_date !== undefined) {
			const parsed = parseDateToPrefill(prefill.start_date);
			if (parsed) startDate = parsed;
		}
		if (prefill.end_date !== undefined) {
			const parsed = parseDateToPrefill(prefill.end_date);
			if (parsed) endDate = parsed;
		}
		if (typeof prefill.contact === 'string') contact = prefill.contact;
		if (typeof prefill.email === 'string') contact = prefill.email;
		if (typeof prefill.tax_id === 'string') taxId = prefill.tax_id;
	});
</script>

<PageShell eyebrow="HR" title="Create Employee" description="Create a new employee profile and continue to salary records.">
	<form class="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm" method="POST">
		{#if form?.message}
			<p class="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{form.message}</p>
		{/if}

		<div class="grid gap-4 md:grid-cols-2">
			<label class="space-y-1 text-sm">
				<span class="text-slate-700">Name</span>
				<input name="name" required class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--sf-green)]" bind:value={name} />
			</label>

			<label class="space-y-1 text-sm">
				<span class="text-slate-700">Type</span>
				<select name="type" class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--sf-green)]" bind:value={type}>
					<option value="full_time">full_time</option>
					<option value="part_time">part_time</option>
					<option value="freelancer">freelancer</option>
					<option value="advisor">advisor</option>
					<option value="overseas_staff">overseas_staff</option>
				</select>
			</label>

			<label class="space-y-1 text-sm">
				<span class="text-slate-700">Status</span>
				<select name="status" class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--sf-green)]" bind:value={status}>
					<option value="active">active</option>
					<option value="inactive">inactive</option>
				</select>
			</label>

			<label class="space-y-1 text-sm">
				<span class="text-slate-700">Start Date</span>
				<input type="date" name="startDate" class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--sf-green)]" bind:value={startDate} />
			</label>

			<label class="space-y-1 text-sm">
				<span class="text-slate-700">End Date</span>
				<input type="date" name="endDate" class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--sf-green)]" bind:value={endDate} />
			</label>

			<label class="space-y-1 text-sm">
				<span class="text-slate-700">Contact</span>
				<input name="contact" class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--sf-green)]" bind:value={contact} />
			</label>

			<label class="space-y-1 text-sm md:col-span-2">
				<span class="text-slate-700">Tax ID</span>
				<input name="taxId" class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--sf-green)]" bind:value={taxId} />
			</label>
		</div>

		<div class="flex gap-3">
			<button class="rounded-md bg-[var(--sf-green)] px-4 py-2 text-sm font-medium text-white hover:bg-[#2f5e2c]" type="submit">Create Employee</button>
			<a class="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50" href="/employees">Back to List</a>
		</div>
	</form>
</PageShell>


