<script lang="ts">
	import PageShell from '$lib/components/PageShell.svelte';

	let { data, form } = $props();
</script>

<PageShell eyebrow="Project Management" title="Create Project" description="After submission, you will be redirected to the project detail page.">
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
				>
					<option value="" disabled selected>Select a customer</option>
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
				/>
			</label>

			<label class="space-y-1 text-sm">
				<span class="text-slate-700">Status</span>
				<select
					name="status"
					class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--sf-green)]"
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
				/>
			</label>

			<label class="space-y-1 text-sm">
				<span class="text-slate-700">End Date</span>
				<input
					type="date"
					name="endDate"
					class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--sf-green)]"
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
