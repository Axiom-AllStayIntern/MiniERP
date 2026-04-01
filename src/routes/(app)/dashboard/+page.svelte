<script lang="ts">
	import PageShell from '$lib/components/PageShell.svelte';
	import { onMount } from 'svelte';
	let { data } = $props();

	const money = (value: number) =>
		new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD' }).format(value ?? 0);

	type ApiResult<T> = { ok: boolean; data: T; error?: string };
	type OverviewData = {
		revenue: number;
		expense: number;
		netProfit: number;
		pendingReceivable: number;
		pendingPayable: number;
		range: { start: string; end: string };
		previousRange: { start: string; end: string };
		trend: { revenueDelta: number; expenseDelta: number; netProfitDelta: number };
		details: {
			revenueItems: Array<{ id: string; date: string; ref: string; note: string; amount: number }>;
			expenseItems: Array<{
				id: string;
				source: string;
				date: string;
				ref: string;
				note: string;
				amount: number;
			}>;
		};
	};
	type RankingRow = {
		projectId: string;
		projectName: string;
		projectStatus: string;
		revenue: number;
		cost: number;
		profit: number;
		profitMargin: number;
	};
	type ChartsData = {
		pie: { supplierCost: number; staffCost: number; expenseCost: number };
		quarterly: Array<{ label: string; revenue: number; expense: number }>;
		projectBars: Array<{ projectId: string; projectName: string; revenue: number; expense: number }>;
	};

	const emptyOverview: OverviewData = {
		revenue: 0,
		expense: 0,
		netProfit: 0,
		pendingReceivable: 0,
		pendingPayable: 0,
		range: { start: '', end: '' },
		previousRange: { start: '', end: '' },
		trend: { revenueDelta: 0, expenseDelta: 0, netProfitDelta: 0 },
		details: { revenueItems: [], expenseItems: [] }
	};
	const emptyCharts: ChartsData = {
		pie: { supplierCost: 0, staffCost: 0, expenseCost: 0 },
		quarterly: [],
		projectBars: []
	};

	let overview = $state<OverviewData>(emptyOverview);
	let projectRanking = $state<RankingRow[]>([]);
	let charts = $state<ChartsData>(emptyCharts);
	let loading = $state(true);
	let loadError = $state('');

	type MetricCardId = 'revenue' | 'expense' | 'netProfit' | 'receivablesPayables';
	type DetailRow = { date: string; source: string; ref: string; note: string; amount: number };
	let selectedCard = $state<MetricCardId | null>(null);
	let lastFilterKey = $state('');
let initialized = $state(false);
let activePieIndex = $state<number | null>(null);

	const filterKey = $derived(`${data.filters.status}|${data.filters.from}|${data.filters.to}`);

	const metricCards = $derived([
		{
			id: 'revenue' as const,
			label: 'Total Revenue',
			value: money(overview.revenue),
			tooltip:
				'Total sales recognized in the selected period from all customer invoices (including tax amount).'
		},
		{
			id: 'expense' as const,
			label: 'Total Expense',
			value: money(overview.expense),
			tooltip:
				'Total project-related costs in the selected period, including supplier invoices, staff costs, and operating expenses.'
		},
		{
			id: 'netProfit' as const,
			label: 'Net Profit',
			value: money(overview.netProfit),
			tooltip: 'Net result for the selected period: Total Revenue minus Total Expense.'
		},
		{
			id: 'receivablesPayables' as const,
			label: 'Receivables / Payables',
			value: `${money(overview.pendingReceivable)} / ${money(overview.pendingPayable)}`,
			tooltip:
				'Outstanding customer collections and supplier payments. This item is currently a placeholder in this phase.'
		}
	]);

	const trendClass = (value: number) => (value >= 0 ? 'text-emerald-700' : 'text-rose-700');

	const pieSegments = $derived.by(() => {
		const segments = [
			{ label: 'Supplier Cost', value: charts.pie.supplierCost, color: '#387234' },
			{ label: 'Staff Cost', value: charts.pie.staffCost, color: '#eabc3c' },
			{ label: 'Operating Expense', value: charts.pie.expenseCost, color: '#7ca977' }
		];
		const total = segments.reduce((sum, item) => sum + item.value, 0);
		let offset = 0;
		return {
			total,
			segments: segments.map((item) => {
				const share = total > 0 ? item.value / total : 0;
				const start = offset;
				offset += share;
				return { ...item, share, start };
			})
		};
	});

function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number) {
	const angle = ((angleDeg - 90) * Math.PI) / 180;
	return {
		x: cx + radius * Math.cos(angle),
		y: cy + radius * Math.sin(angle)
	};
}

function describeArc(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
	const start = polarToCartesian(cx, cy, radius, endAngle);
	const end = polarToCartesian(cx, cy, radius, startAngle);
	const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
	return `M ${cx} ${cy} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
}

const pieArcs = $derived.by(() => {
	const cx = 120;
	const cy = 120;
	const radius = 100;
	return pieSegments.segments.map((item, index) => {
		const startAngle = item.start * 360;
		const endAngle = (item.start + item.share) * 360;
		const midAngle = (startAngle + endAngle) / 2;
		const push = activePieIndex === index ? 10 : 0;
		const rad = ((midAngle - 90) * Math.PI) / 180;
		const tx = Math.cos(rad) * push;
		const ty = Math.sin(rad) * push;
		return {
			...item,
			path: describeArc(cx, cy, radius, startAngle, endAngle),
			tx,
			ty,
			scale: activePieIndex === index ? 1.06 : 1
		};
	});
});

const pieDetail = $derived.by(() => {
	if (activePieIndex === null) return null;
	const item = pieSegments.segments[activePieIndex];
	if (!item) return null;
	return {
		label: item.label,
		value: item.value,
		share: item.share
	};
});

	const quarterlySeries = $derived(charts.quarterly);
	const lineChart = $derived.by(() => {
		const points = quarterlySeries;
		if (points.length === 0) {
			return { revenuePath: '', expensePath: '', maxY: 1 };
		}
		const maxY = Math.max(1, ...points.map((item) => Math.max(item.revenue, item.expense)));
		const width = 560;
		const height = 220;
		const padX = 30;
		const padY = 20;
		const spanX = Math.max(1, points.length - 1);
		const toPoint = (value: number, index: number) => {
			const x = padX + ((width - padX * 2) * index) / spanX;
			const y = height - padY - ((height - padY * 2) * value) / maxY;
			return `${x},${y}`;
		};
		const revenuePath = points.map((item, index) => toPoint(item.revenue, index)).join(' ');
		const expensePath = points.map((item, index) => toPoint(item.expense, index)).join(' ');
		return { revenuePath, expensePath, maxY };
	});

	const projectBars = $derived.by(() => {
		const bars = charts.projectBars;
		const maxVal = Math.max(1, ...bars.map((item) => Math.max(item.revenue, item.expense)));
		return bars.map((item) => ({
			...item,
			revenueWidth: `${(item.revenue / maxVal) * 100}%`,
			expenseWidth: `${(item.expense / maxVal) * 100}%`
		}));
	});

	const revenueRows = $derived.by(
		(): DetailRow[] =>
		overview.details.revenueItems.map((item) => ({
				date: item.date || '-',
				source: 'customer_invoice',
				ref: item.ref || item.id,
				note: item.note || '-',
				amount: item.amount
			}))
	);
	const expenseRows = $derived.by(
		(): DetailRow[] =>
			overview.details.expenseItems.map((item) => ({
				date: item.date || '-',
				source: item.source,
				ref: item.ref || item.id,
				note: item.note || '-',
				amount: item.amount
			}))
	);
	const netProfitRows = $derived.by(
		(): DetailRow[] =>
			[
				...revenueRows.map((row) => ({ ...row, source: `+ ${row.source}`, amount: row.amount })),
				...expenseRows.map((row) => ({ ...row, source: `- ${row.source}`, amount: -row.amount }))
			].sort((a, b) => b.date.localeCompare(a.date))
	);
	const detailModal = $derived.by(() => {
		if (!selectedCard) return null;
		if (selectedCard === 'revenue') {
			return {
				title: 'Revenue Details',
				subtitle: 'Records inside current filter range.',
				total: overview.revenue,
				rows: revenueRows,
				empty: 'No revenue details in selected range.'
			};
		}
		if (selectedCard === 'expense') {
			return {
				title: 'Expense Details',
				subtitle: 'Supplier + staff + expense records in current range.',
				total: overview.expense,
				rows: expenseRows,
				empty: 'No expense details in selected range.'
			};
		}
		if (selectedCard === 'netProfit') {
			return {
				title: 'Net Profit Composition',
				subtitle: 'Revenue(+) and expense(-) impacts by date in current range.',
				total: overview.netProfit,
				rows: netProfitRows,
				empty: 'No net profit composition records in selected range.'
			};
		}
		return {
			title: 'Receivables / Payables',
			subtitle: 'This phase keeps receivables and payables summary as placeholder.',
			total: overview.pendingReceivable - overview.pendingPayable,
			rows: [] as DetailRow[],
			empty: 'No receivable/payable detail records yet.'
		};
	});

	async function loadDashboardData() {
		loading = true;
		loadError = '';
		try {
			const overviewQs = new URLSearchParams();
			const rankingQs = new URLSearchParams();
			if (data.filters.status) rankingQs.set('projectStatus', data.filters.status);
			if (data.filters.from) {
				overviewQs.set('from', data.filters.from);
				rankingQs.set('from', data.filters.from);
			}
			if (data.filters.to) {
				overviewQs.set('to', data.filters.to);
				rankingQs.set('to', data.filters.to);
			}

			const [overviewRes, rankingRes, chartsRes] = await Promise.all([
				fetch(`/api/dashboard/overview?${overviewQs.toString()}`),
				fetch(`/api/dashboard/projects-profit?${rankingQs.toString()}`),
				fetch(`/api/dashboard/charts?${rankingQs.toString()}`)
			]);

			const [overviewJson, rankingJson, chartsJson] = (await Promise.all([
				overviewRes.json(),
				rankingRes.json(),
				chartsRes.json()
			])) as [
				ApiResult<OverviewData>,
				ApiResult<RankingRow[]>,
				ApiResult<ChartsData>
			];

			overview = overviewJson.ok ? overviewJson.data : emptyOverview;
			projectRanking = rankingJson.ok ? rankingJson.data : [];
			charts = chartsJson.ok ? chartsJson.data : emptyCharts;
		} catch {
			loadError = 'Failed to load dashboard data. Please retry.';
			overview = emptyOverview;
			projectRanking = [];
			charts = emptyCharts;
		} finally {
			loading = false;
		}
	}

	onMount(async () => {
	lastFilterKey = filterKey;
	initialized = true;
		await loadDashboardData();
	});

	$effect(() => {
	if (!initialized) return;
		if (filterKey === lastFilterKey) return;
		lastFilterKey = filterKey;
		void loadDashboardData();
	});
</script>

<PageShell
	eyebrow="Dashboard"
	title="SmartFin Console"
	description="Operational snapshot with period-over-period trends and project profitability ranking."
>
	<div class="relative h-1 overflow-hidden rounded-full bg-slate-200">
		{#if loading}
			<div class="progress-indicator h-full w-1/3 rounded-full bg-[var(--sf-green)]"></div>
		{/if}
	</div>

	<form method="GET" class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
		<div class="flex flex-wrap items-end gap-3">
			<label class="text-sm text-slate-600">
				Project Status
				<select
					name="status"
					value={data.filters.status}
					class="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
				>
					<option value="">All</option>
					<option value="active">active</option>
					<option value="on_hold">on_hold</option>
					<option value="completed">completed</option>
					<option value="archived">archived</option>
				</select>
			</label>
			<label class="text-sm text-slate-600">
				From
				<input
					type="date"
					lang="en-GB"
					name="from"
					value={data.filters.from}
					class="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
				/>
			</label>
			<label class="text-sm text-slate-600">
				To
				<input
					type="date"
					lang="en-GB"
					name="to"
					value={data.filters.to}
					class="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
				/>
			</label>
			<button class="rounded-md bg-[var(--sf-green)] px-3 py-2 text-sm text-white hover:bg-[#2f5e2c]" type="submit">
				Apply
			</button>
			<p class="text-xs text-slate-500">
				Current period: {overview.range.start || '--'} to {overview.range.end || '--'}
			</p>
		</div>
	</form>

	{#if loadError}
		<div class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
			{loadError}
		</div>
	{/if}

	<section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
		{#each metricCards as metric}
			<div class="relative min-h-[118px] rounded-xl border border-slate-200 bg-white shadow-sm">
				<button
					type="button"
					class="w-full rounded-xl p-4 text-left transition hover:bg-slate-50"
					onclick={() => (selectedCard = metric.id)}
				>
					<p class="text-sm text-slate-500">{metric.label}</p>
					{#if loading}
						<div class="mt-3 h-8 w-32 animate-pulse rounded bg-slate-200"></div>
					{:else}
						<p class="mt-3 text-2xl font-semibold text-slate-900">{metric.value}</p>
					{/if}
				</button>
				<button
					type="button"
					class="absolute right-3 top-3 inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] text-slate-500"
					aria-label={`Show ${metric.label} calculation logic`}
					title={metric.tooltip}
				>
					i
				</button>
			</div>
		{/each}
	</section>

	<section class="grid gap-4 md:grid-cols-3">
		<article class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
			<p class="text-xs text-slate-500">Revenue Delta vs Previous Period</p>
			<p class={`mt-2 text-xl font-semibold ${trendClass(overview.trend.revenueDelta)}`}>
				{money(overview.trend.revenueDelta)}
			</p>
		</article>
		<article class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
			<p class="text-xs text-slate-500">Expense Delta vs Previous Period</p>
			<p class={`mt-2 text-xl font-semibold ${trendClass(-overview.trend.expenseDelta)}`}>
				{money(overview.trend.expenseDelta)}
			</p>
		</article>
		<article class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
			<p class="text-xs text-slate-500">Net Profit Delta vs Previous Period</p>
			<p class={`mt-2 text-xl font-semibold ${trendClass(overview.trend.netProfitDelta)}`}>
				{money(overview.trend.netProfitDelta)}
			</p>
		</article>
	</section>

<section class="grid gap-4 lg:grid-cols-[0.88fr_1.12fr]">
		<article class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm min-h-[280px]">
			<div class="flex items-start justify-between gap-4">
				<div>
					<h2 class="text-sm font-semibold text-slate-800">Cost Structure (Pie)</h2>
					<p class="text-xs text-slate-500">Expense composition within current filter range.</p>
				</div>
				<span class="rounded-full bg-[var(--sf-green-soft)] px-2 py-1 text-xs font-medium text-[var(--sf-green)]">
					{money(pieSegments.total)}
				</span>
			</div>
			{#if loading}
				<div class="mt-4 h-56 animate-pulse rounded-xl bg-slate-100"></div>
			{:else}
			<div class="mt-4 flex flex-wrap items-start justify-between gap-4 chart-fade-in">
				<div class="pie-wrap pie-pop relative h-64 w-64 rounded-full">
					<svg viewBox="0 0 240 240" class="h-64 w-64">
						{#if pieSegments.total <= 0}
							<circle cx="120" cy="120" r="100" fill="#e2e8f0"></circle>
						{:else}
							{#each pieArcs as arc, idx}
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<path
									d={arc.path}
									fill={arc.color}
									class="pie-slice"
									style={`transform: translate(${arc.tx}px, ${arc.ty}px) scale(${arc.scale}); transform-origin: 120px 120px;`}
									onmouseenter={() => (activePieIndex = idx)}
									onmouseleave={() => (activePieIndex = null)}
								></path>
							{/each}
						{/if}
					</svg>
					<div class="pie-sweep-mask"></div>
					</div>
				<div class="flex min-h-[256px] w-52 flex-col justify-between">
					<div class="space-y-2">
						{#each pieSegments.segments as item, idx}
							<button
								type="button"
								class={`flex w-full items-center gap-2 rounded px-1 py-0.5 text-sm ${
									activePieIndex === idx ? 'bg-slate-100 text-slate-900' : 'text-slate-700'
								}`}
								aria-label={`Highlight ${item.label}`}
								onmouseenter={() => (activePieIndex = idx)}
								onmouseleave={() => (activePieIndex = null)}
							>
								<span class="h-3 w-3 rounded-full" style={`background:${item.color}`}></span>
								<span>{item.label}</span>
							</button>
						{/each}
					</div>
					<div class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
						{#if pieDetail}
							<p class="font-medium text-slate-800">{pieDetail.label}</p>
							<p class="mt-1">{money(pieDetail.value)} ({(pieDetail.share * 100).toFixed(1)}%)</p>
						{:else}
							<p class="font-medium text-slate-800">Total Expense</p>
							<p class="mt-1">{money(pieSegments.total)} (100.0%)</p>
						{/if}
					</div>
				</div>
				<p class="w-full text-xs text-slate-500">Tip: Hover a pie segment to view amount and share details.</p>
			</div>
			{/if}
		</article>

		<article class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm min-h-[320px]">
			<div>
				<h2 class="text-sm font-semibold text-slate-800">Quarterly Income vs Expense (Line)</h2>
				<p class="text-xs text-slate-500">Rolling four-quarter trend ending in current selection.</p>
			</div>
			{#if loading}
				<div class="mt-4 h-56 animate-pulse rounded-xl bg-slate-100"></div>
			{:else if quarterlySeries.length === 0}
				<p class="mt-8 text-center text-sm text-slate-500">No quarterly data yet.</p>
			{:else}
				<svg viewBox="0 0 560 220" class="mt-4 w-full rounded-lg border border-slate-100 bg-slate-50 chart-fade-in">
					<polyline class="line-draw line-revenue" points={lineChart.revenuePath} fill="none" stroke="#387234" stroke-width="3"></polyline>
					<polyline class="line-draw line-expense" points={lineChart.expensePath} fill="none" stroke="#eabc3c" stroke-width="3"></polyline>
				</svg>
				<div class="mt-3 flex flex-wrap items-center gap-4 text-xs">
					<span class="inline-flex items-center gap-1 text-slate-700">
						<span class="h-2 w-2 rounded-full bg-[var(--sf-green)]"></span>Income
					</span>
					<span class="inline-flex items-center gap-1 text-slate-700">
						<span class="h-2 w-2 rounded-full bg-[var(--sf-gold)]"></span>Expense
					</span>
					<div class="flex flex-wrap gap-2 text-slate-500">
						{#each quarterlySeries as item}
							<span class="rounded border border-slate-200 bg-white px-2 py-0.5">{item.label}</span>
						{/each}
					</div>
				</div>
			{/if}
		</article>
	</section>

	<section class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
		<div class="border-b border-slate-200 bg-slate-50 px-4 py-3">
			<h2 class="text-sm font-semibold text-slate-700">Project Income vs Expense (Bar)</h2>
		</div>
		<div class="space-y-4 p-4 min-h-[260px]">
			{#if loading}
				<div class="space-y-3">
					<div class="h-12 animate-pulse rounded bg-slate-100"></div>
					<div class="h-12 animate-pulse rounded bg-slate-100"></div>
					<div class="h-12 animate-pulse rounded bg-slate-100"></div>
				</div>
			{:else if projectBars.length === 0}
				<p class="py-8 text-center text-sm text-slate-500">No project comparison data in current filter range.</p>
			{:else}
				{#each projectBars as item}
					<div class="space-y-2 chart-fade-in">
						<div class="flex flex-wrap items-center justify-between gap-2">
							<p class="text-sm font-medium text-slate-800">{item.projectName}</p>
							<p class="text-xs text-slate-500">
								Income {money(item.revenue)} / Expense {money(item.expense)}
							</p>
						</div>
						<div class="space-y-1">
							<div class="h-2 rounded bg-slate-100">
								<div class="bar-grow h-2 rounded bg-[var(--sf-green)]" style={`width:${loading ? '0%' : item.revenueWidth}`}></div>
							</div>
							<div class="h-2 rounded bg-slate-100">
								<div class="bar-grow h-2 rounded bg-[var(--sf-gold)]" style={`width:${loading ? '0%' : item.expenseWidth}`}></div>
							</div>
						</div>
					</div>
				{/each}
			{/if}
		</div>
	</section>

	<section class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
		<div class="border-b border-slate-200 bg-slate-50 px-4 py-3">
			<h2 class="text-sm font-semibold text-slate-700">Project Profit Ranking (Table)</h2>
		</div>
		<table class="min-w-full divide-y divide-slate-200 text-sm">
			<thead class="bg-white text-left text-slate-600">
				<tr>
					<th class="px-4 py-3">Project</th>
					<th class="px-4 py-3">Status</th>
					<th class="px-4 py-3">Revenue</th>
					<th class="px-4 py-3">Cost</th>
					<th class="px-4 py-3">Profit</th>
					<th class="px-4 py-3">Margin</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#if projectRanking.length === 0}
					<tr>
						<td class="px-4 py-8 text-center text-slate-500" colspan="6">
							No project ranking data yet.
						</td>
					</tr>
				{:else}
					{#each projectRanking as row}
						<tr class="hover:bg-slate-50">
							<td class="px-4 py-3 font-medium text-slate-800">{row.projectName}</td>
							<td class="px-4 py-3">{row.projectStatus}</td>
							<td class="px-4 py-3">{money(row.revenue)}</td>
							<td class="px-4 py-3">{money(row.cost)}</td>
							<td class="px-4 py-3">{money(row.profit)}</td>
							<td class="px-4 py-3">{(row.profitMargin * 100).toFixed(2)}%</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</section>
</PageShell>

{#if detailModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<button
			type="button"
			class="absolute inset-0 bg-[var(--sf-green)]/40"
			aria-label="Close detail dialog"
			onclick={() => (selectedCard = null)}
		></button>
		<div class="relative max-h-[85vh] w-full max-w-5xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
			<div class="border-b border-slate-200 bg-slate-50 px-4 py-3">
				<div class="flex items-start justify-between gap-4">
					<div>
						<h3 class="text-base font-semibold text-slate-900">{detailModal.title}</h3>
						<p class="text-xs text-slate-500">{detailModal.subtitle}</p>
					</div>
					<div class="text-right">
						<p class="text-xs text-slate-500">Current Total</p>
						<p class="text-sm font-semibold text-slate-900">{money(detailModal.total)}</p>
					</div>
				</div>
			</div>
			<div class="max-h-[60vh] overflow-auto">
				<table class="min-w-full divide-y divide-slate-200 text-sm">
					<thead class="bg-white text-left text-slate-600">
						<tr>
							<th class="px-4 py-3">Date</th>
							<th class="px-4 py-3">Source</th>
							<th class="px-4 py-3">Ref</th>
							<th class="px-4 py-3">Note</th>
							<th class="px-4 py-3 text-right">Amount</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-100">
						{#if detailModal.rows.length === 0}
							<tr>
								<td class="px-4 py-8 text-center text-slate-500" colspan="5">{detailModal.empty}</td>
							</tr>
						{:else}
							{#each detailModal.rows as row}
								<tr class="hover:bg-slate-50">
									<td class="px-4 py-3 text-slate-700">{row.date}</td>
									<td class="px-4 py-3 text-slate-700">{row.source}</td>
									<td class="px-4 py-3 font-medium text-slate-800">{row.ref}</td>
									<td class="px-4 py-3 text-slate-700">{row.note}</td>
									<td class="px-4 py-3 text-right text-slate-800">{money(row.amount)}</td>
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			</div>
		</div>
	</div>
{/if}

<style>
	.progress-indicator {
		animation: progressSlide 1.2s ease-in-out infinite;
	}

	.chart-fade-in {
		animation: chartFadeIn 0.45s ease-out;
	}

	.pie-pop {
		animation: piePop 0.5s ease-out;
	}

	.pie-wrap {
		position: relative;
	}

	.pie-sweep-mask {
		position: absolute;
		inset: 0;
		border-radius: 9999px;
		background: conic-gradient(from -90deg, transparent calc(var(--sweep) * 1turn), #ffffff 0);
		animation: pieSweepReveal 1s ease-out forwards;
		pointer-events: none;
	}

	.pie-slice {
		transition: transform 0.22s ease-out, filter 0.22s ease-out;
	}

	.pie-slice:hover {
		filter: brightness(1.05);
	}

	.line-draw {
		stroke-dasharray: 1200;
		stroke-dashoffset: 1200;
		animation: lineDraw 0.9s ease-out forwards;
	}

	.line-expense {
		animation-delay: 0.08s;
	}

	.bar-grow {
		transform-origin: left center;
		animation: barGrow 0.65s ease-out both;
	}

	@keyframes progressSlide {
		0% { transform: translateX(-120%); }
		100% { transform: translateX(420%); }
	}

	@keyframes chartFadeIn {
		from { opacity: 0; transform: translateY(4px); }
		to { opacity: 1; transform: translateY(0); }
	}

	@keyframes piePop {
		from { opacity: 0; transform: scale(0.88); }
		to { opacity: 1; transform: scale(1); }
	}

	@property --sweep {
		syntax: '<number>';
		inherits: false;
		initial-value: 0;
	}

	@keyframes pieSweepReveal {
		from { --sweep: 0; opacity: 1; }
		to { --sweep: 1; opacity: 0; }
	}

	@keyframes lineDraw {
		to { stroke-dashoffset: 0; }
	}

	@keyframes barGrow {
		from { transform: scaleX(0); }
		to { transform: scaleX(1); }
	}
</style>
