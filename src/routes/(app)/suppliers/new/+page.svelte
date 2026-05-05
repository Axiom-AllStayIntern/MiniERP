<script lang="ts">
	import PageShell from '$app-layer/components/PageShell.svelte';

	let { form } = $props();
	let contacts = $state([{ id: crypto.randomUUID() }]);

	function addContact() {
		contacts = [...contacts, { id: crypto.randomUUID() }];
	}

	function removeContact(id: string) {
		contacts = contacts.filter((c) => c.id !== id);
	}
</script>

<PageShell
	eyebrow="Business partners"
	title="New supplier"
	description="Creates a supplier record for purchase orders, incoming invoices, and vendor-facing documents."
>
	<form class="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm" method="POST">
		{#if form?.message}
			<p class="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{form.message}</p>
		{/if}

		<div class="grid gap-4 md:grid-cols-2">
			<label class="space-y-1 text-sm md:col-span-2">
				<span class="text-slate-700">Legal / display name</span>
				<input
					name="name"
					required
					class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--sf-green)]"
					placeholder="e.g. Acme Supplies Pte Ltd"
				/>
			</label>

			<label class="space-y-1 text-sm md:col-span-2">
				<span class="text-slate-700">Registered / remit-to address</span>
				<textarea
					name="address"
					rows="3"
					class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--sf-green)]"
					placeholder="Vendor address or pay-to line"
				></textarea>
			</label>

			<label class="space-y-1 text-sm">
				<span class="text-slate-700">Contact</span>
				<input
					name="contact"
					class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--sf-green)]"
					placeholder="Phone / email"
				/>
			</label>

			<label class="space-y-1 text-sm md:col-span-2">
				<span class="text-slate-700">Item Description</span>
				<input
					name="itemDescription"
					class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--sf-green)]"
					placeholder="e.g. Motor, Encoder, CNC machine parts"
				/>
			</label>

			<label class="space-y-1 text-sm">
				<span class="text-slate-700">Date Create</span>
				<input
					name="dateCreate"
					type="date"
					class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--sf-green)]"
				/>
			</label>

			<label class="space-y-1 text-sm">
				<span class="text-slate-700">Project Related</span>
				<input
					name="projectRelated"
					class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--sf-green)]"
					placeholder="Project name / code / remarks"
				/>
			</label>

			<label class="space-y-1 text-sm">
				<span class="text-slate-700">GST registration no.</span>
				<input
					name="gstRegNo"
					class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--sf-green)]"
					placeholder="Optional (e.g. M90371234X)"
				/>
			</label>
		</div>

		<div class="space-y-3 rounded-lg border border-slate-200 p-4">
			<div class="flex items-center justify-between">
				<p class="text-sm font-medium text-slate-800">Supplier Contacts (sub-table)</p>
				<button
					type="button"
					class="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
					onclick={addContact}
				>
					Add contact
				</button>
			</div>

			{#each contacts as c}
				<div class="grid gap-3 rounded-md border border-slate-200 p-3 md:grid-cols-5">
					<label class="space-y-1 text-xs md:col-span-1">
						<span class="text-slate-600">Name</span>
						<input
							name="contactName"
							class="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--sf-green)]"
							placeholder="Contact person"
						/>
					</label>
					<label class="space-y-1 text-xs md:col-span-1">
						<span class="text-slate-600">Phone / Email</span>
						<input
							name="contactPhoneEmail"
							class="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--sf-green)]"
							placeholder="+65 ... / user@..."
						/>
					</label>
					<label class="space-y-1 text-xs md:col-span-1">
						<span class="text-slate-600">WeChat</span>
						<input
							name="contactWechat"
							class="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--sf-green)]"
							placeholder="wechat id"
						/>
					</label>
					<label class="space-y-1 text-xs md:col-span-1">
						<span class="text-slate-600">Position</span>
						<input
							name="contactPosition"
							class="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--sf-green)]"
							placeholder="Purchaser / Manager..."
						/>
					</label>
					<div class="flex items-end justify-end md:col-span-1">
						<button
							type="button"
							class="rounded border border-rose-200 px-2.5 py-2 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-40"
							disabled={contacts.length <= 1}
							onclick={() => removeContact(c.id)}
						>
							Remove
						</button>
					</div>
				</div>
			{/each}
		</div>

		<div class="flex flex-wrap gap-3">
			<button class="rounded-md bg-[var(--sf-green)] px-4 py-2 text-sm font-medium text-white hover:bg-[#2f5e2c]" type="submit">
				Save supplier
			</button>
			<a class="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50" href="/suppliers">
				Back to list
			</a>
		</div>
	</form>
</PageShell>


