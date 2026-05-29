<script lang="ts">
	import PageShell from '$app-layer/components/PageShell.svelte';

	let { data, form } = $props();
	type ContactDraft = {
		_key: string;
		name: string;
		phoneEmail: string;
		wechat: string;
		position: string;
	};
	const toDraft = (c?: Partial<ContactDraft>): ContactDraft => ({
		_key: c?._key ?? crypto.randomUUID(),
		name: c?.name ?? '',
		phoneEmail: c?.phoneEmail ?? '',
		wechat: c?.wechat ?? '',
		position: c?.position ?? ''
	});
	let contacts = $state<ContactDraft[]>(
		data.contacts.length > 0
			? data.contacts.map((c) =>
					toDraft({
						_key: c.id,
						name: c.name,
						phoneEmail: c.phoneEmail ?? '',
						wechat: c.wechat ?? '',
						position: c.position ?? ''
					})
				)
			: [toDraft()]
	);

	function addContact() {
		contacts = [...contacts, toDraft()];
	}

	function removeContact(k: string) {
		contacts = contacts.filter((c) => c._key !== k);
		if (contacts.length === 0) addContact();
	}
</script>

<PageShell
	eyebrow="Procurement"
	title={`Supplier: ${data.supplier.name}`}
	description="Supplier master profile with contacts (supply chain initial data entry)."
>
	<div class="mb-4 flex gap-2">
		<a class="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" href="/procurement/suppliers">
			Back to suppliers
		</a>
	</div>

	<form class="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm" method="POST" action="?/update">
		{#if form?.message}
			<p class="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{form.message}</p>
		{/if}

		<div class="grid gap-4 md:grid-cols-2">
			<label class="space-y-1 text-sm md:col-span-2">
				<span class="text-slate-700">Legal / display name</span>
				<input name="name" required value={data.supplier.name} class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--sf-green)]" />
			</label>

			<label class="space-y-1 text-sm md:col-span-2">
				<span class="text-slate-700">Registered / remit-to address</span>
				<textarea name="address" rows="3" class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--sf-green)]">{data.supplier.address ?? ''}</textarea>
			</label>

			<label class="space-y-1 text-sm">
				<span class="text-slate-700">Main Contact</span>
				<input name="contact" value={data.supplier.contact ?? ''} class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--sf-green)]" />
			</label>

			<label class="space-y-1 text-sm">
				<span class="text-slate-700">GST registration no.</span>
				<input name="gstRegNo" value={data.supplier.gstRegNo ?? ''} class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--sf-green)]" />
			</label>

			<label class="space-y-1 text-sm md:col-span-2">
				<span class="text-slate-700">Item Description</span>
				<input name="itemDescription" value={data.supplier.itemDescription ?? ''} class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--sf-green)]" />
			</label>

			<label class="space-y-1 text-sm">
				<span class="text-slate-700">Date Create</span>
				<input type="date" name="dateCreate" value={data.supplier.dateCreate ?? ''} class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--sf-green)]" />
			</label>

			<label class="space-y-1 text-sm">
				<span class="text-slate-700">Project Related</span>
				<input name="projectRelated" value={data.supplier.projectRelated ?? ''} class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--sf-green)]" />
			</label>
		</div>

		<div class="space-y-3 rounded-lg border border-slate-200 p-4">
			<div class="flex items-center justify-between">
				<p class="text-sm font-medium text-slate-800">Supplier Contacts</p>
				<button type="button" class="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50" onclick={addContact}>Add contact</button>
			</div>
			{#each contacts as c}
				<div class="grid gap-3 rounded-md border border-slate-200 p-3 md:grid-cols-5">
					<label class="space-y-1 text-xs">
						<span class="text-slate-600">Name</span>
						<input name="contactName" value={c.name ?? ''} class="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--sf-green)]" />
					</label>
					<label class="space-y-1 text-xs">
						<span class="text-slate-600">Phone / Email</span>
						<input name="contactPhoneEmail" value={c.phoneEmail ?? ''} class="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--sf-green)]" />
					</label>
					<label class="space-y-1 text-xs">
						<span class="text-slate-600">WeChat</span>
						<input name="contactWechat" value={c.wechat ?? ''} class="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--sf-green)]" />
					</label>
					<label class="space-y-1 text-xs">
						<span class="text-slate-600">Position</span>
						<input name="contactPosition" value={c.position ?? ''} class="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--sf-green)]" />
					</label>
					<div class="flex items-end justify-end">
						<button type="button" class="rounded border border-rose-200 px-2.5 py-2 text-xs text-rose-700 hover:bg-rose-50" onclick={() => removeContact(c._key)}>
							Remove
						</button>
					</div>
				</div>
			{/each}
		</div>

		<div class="flex gap-2">
			<button class="rounded-md bg-[var(--sf-green)] px-4 py-2 text-sm font-medium text-white hover:bg-[#2f5e2c]" type="submit">
				Save changes
			</button>
			<a class="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50" href="/procurement/suppliers">
				Cancel
			</a>
		</div>
	</form>
</PageShell>



