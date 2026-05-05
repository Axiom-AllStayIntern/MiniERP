<script lang="ts">
	import { onMount } from 'svelte';

	let { fileViewUrl } = $props<{ fileViewUrl: string }>();

	let loading = $state(true);
	let error = $state<string | null>(null);
	let text = $state<string | null>(null);
	let truncated = $state(false);
	let empty = $state(false);

	function keyFromFileViewUrl(href: string): string | null {
		try {
			const u = href.startsWith('/') ? new URL(href, 'http://dummy.local') : new URL(href);
			return u.searchParams.get('key')?.trim() ?? null;
		} catch {
			return null;
		}
	}

	onMount(async () => {
		const key = keyFromFileViewUrl(fileViewUrl);
		if (!key) {
			loading = false;
			error = 'Missing file key.';
			return;
		}
		try {
			const r = await fetch(`/api/files/text-preview?key=${encodeURIComponent(key)}`);
			const j = (await r.json()) as {
				ok?: boolean;
				data?: { text?: string; truncated?: boolean; empty?: boolean };
				error?: string;
			};
			if (!r.ok || j.ok === false) {
				throw new Error(j.error ?? `HTTP ${r.status}`);
			}
			const payload = j.data;
			if (!payload) throw new Error('Invalid response');
			text = payload.text ?? '';
			truncated = payload.truncated ?? false;
			empty = payload.empty === true;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load preview';
		} finally {
			loading = false;
		}
	});
</script>

{#if loading}
	<p class="text-sm text-slate-500">Loading text preview...</p>
{:else if error}
	<p class="text-sm text-amber-900">
		{error}
		<span class="text-slate-600"> You can still use Download or open the file on your device.</span>
	</p>
{:else}
	<div class="max-h-[min(75vh,900px)] overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-4">
		<pre class="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-slate-800">{text}</pre>
	</div>
	{#if truncated}
		<p class="mt-2 text-xs text-slate-500">Showing the first 120,000 characters.</p>
	{/if}
	{#if empty}
		<p class="mt-2 text-xs text-slate-500">No extractable text (e.g. scan-only or image-based document).</p>
	{/if}
{/if}
