<script lang="ts">
	import PageShell from '$app-layer/components/PageShell.svelte';
</script>

<PageShell
	eyebrow="Finance / Document Upload"
	title="Document Upload Journey"
	description="Choose whether this document belongs to a project or is only for standalone archive record."
>
	<section class="grid gap-4 md:grid-cols-2">
		<a
			href="/finance/doc-hub/upload/project"
			class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--sf-green)]"
		>
			<h2 class="text-base font-semibold text-slate-900">Belongs to a Project</h2>
			<p class="mt-2 text-sm text-slate-600">
				Select this option if the document should be linked to an existing project before extraction and storage.
			</p>
			<p class="mt-4 text-sm font-medium text-[var(--sf-green)]">Continue</p>
		</a>

		<a
			href="/finance/doc-hub/upload/record"
			class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--sf-gold)]"
		>
			<h2 class="text-base font-semibold text-slate-900">Standalone Record Only</h2>
			<p class="mt-2 text-sm text-slate-600">
				Select this option if the document is not tied to a project and should be stored only as a record.
			</p>
			<p class="mt-4 text-sm font-medium text-[#7a5a07]">Continue</p>
		</a>
	</section>
</PageShell>


