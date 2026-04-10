<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { get } from 'svelte/store';
	import { agentPageContext } from '$lib/agent/context';

	type Message = {
		role: 'user' | 'assistant';
		text: string;
		action?: {
			entry: string;
			layer: number;
		} | null;
		prefill?: Record<string, unknown>;
	};
	type AgentIntentResponse = {
		reply?: string;
		action?: { entry: string; layer: number } | null;
		prefill?: Record<string, unknown>;
	};

	let open = $state(false);
	let input = $state('');
	let loading = $state(false);
	let messages = $state<Message[]>([]);

	async function send() {
		if (!input.trim() || loading) return;

		const userMessage = input.trim();
		input = '';
		messages = [...messages, { role: 'user', text: userMessage }];
		loading = true;

		try {
			const res = await fetch('/api/agent/intent', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					message: userMessage,
					context: {
						currentPath: page.url.pathname,
						...get(agentPageContext)
					}
				})
			});
			const data = (await res.json()) as AgentIntentResponse;

			messages = [
				...messages,
				{
					role: 'assistant',
					text: data.reply ?? '我没有理解你的意思，能换个方式说吗？',
					action: data.action ?? null,
					prefill: data.prefill ?? {}
				}
			];
		} catch {
			messages = [...messages, { role: 'assistant', text: '出现了一些问题，请稍后再试。' }];
		} finally {
			loading = false;
		}
	}

	function navigate(entry: string, prefill: Record<string, unknown>) {
		const params = new URLSearchParams();
		for (const [k, v] of Object.entries(prefill)) {
			if (v !== null && v !== undefined) {
				params.set(k, String(v));
			}
		}
		const url = params.size > 0 ? `${entry}?${params.toString()}` : entry;
		goto(url);
		open = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			void send();
		}
	}
</script>

<button
	class="fixed right-6 bottom-6 z-50 flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg transition-opacity hover:opacity-90"
	style="background: var(--sf-green);"
	aria-label="AI 助手"
	onclick={() => (open = !open)}
>
	{#if open}✕{:else}✦{/if}
</button>

{#if open}
	<div
		class="fixed right-6 bottom-20 z-50 flex w-80 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
		style="max-height: 480px;"
	>
		<div class="px-4 py-3 text-sm font-semibold text-white" style="background: var(--sf-green);">SmartFin 助手</div>

		<div class="flex-1 space-y-2 overflow-y-auto p-3 text-sm">
			{#if messages.length === 0}
				<p class="mt-8 text-center text-gray-400">你好！有什么可以帮你的？</p>
			{/if}

			{#each messages as msg}
				<div class={msg.role === 'user' ? 'text-right' : 'text-left'}>
					<span
						class={`inline-block max-w-[90%] rounded-lg px-3 py-2 ${
							msg.role === 'user' ? 'text-white' : 'bg-gray-100 text-gray-800'
						}`}
						style={msg.role === 'user' ? 'background: var(--sf-green);' : ''}
					>
						{msg.text}
					</span>

					{#if msg.role === 'assistant' && msg.action}
						<div class="mt-1">
							<button
								class="rounded-full px-3 py-1 text-xs transition-colors"
								style="border: 1px solid rgba(56, 114, 52, 0.25); background: var(--sf-green-soft); color: var(--sf-green);"
								onclick={() => navigate(msg.action!.entry, msg.prefill ?? {})}
							>
								前往 →
							</button>
						</div>
					{/if}
				</div>
			{/each}

			{#if loading}
				<div class="text-left">
					<span class="inline-block rounded-lg bg-gray-100 px-3 py-2 text-xs text-gray-400">思考中...</span>
				</div>
			{/if}
		</div>

		<div class="flex gap-2 border-t border-gray-200 p-2">
			<input
				class="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-green-700 focus:outline-none"
				placeholder="输入你想做什么..."
				bind:value={input}
				onkeydown={handleKeydown}
				disabled={loading}
			/>
			<button
				class="rounded-lg px-3 py-2 text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-40"
				style="background: var(--sf-green);"
				onclick={() => void send()}
				disabled={loading || !input.trim()}
			>
				发送
			</button>
		</div>
	</div>
{/if}
