import type { PageServerLoad } from './$types';

type ApiResult<T> = {
	ok: boolean;
	data: T;
	error?: string;
};

export const load: PageServerLoad = async ({ fetch, url }) => {
	const fallbackYear = new Date().getUTCFullYear();
	const year = Number.parseInt(url.searchParams.get('year') ?? `${fallbackYear}`, 10);
	const response = await fetch(`/api/tax/corporate/${year}`);
	const json = (await response.json()) as ApiResult<{
		year: number;
		range: { start: string; end: string };
		revenue: number;
		costBreakdown: { purchase: number; staff: number; expense: number };
		taxableIncome: number;
		taxPayable: number;
		effectiveRate: number;
		bands: { first10k: number; next190k: number; above200k: number };
	}>;

	return {
		year,
		corporate: json.ok
			? json.data
			: {
					year,
					range: { start: `${year}-01-01`, end: `${year}-12-31` },
					revenue: 0,
					costBreakdown: { purchase: 0, staff: 0, expense: 0 },
					taxableIncome: 0,
					taxPayable: 0,
					effectiveRate: 0,
					bands: { first10k: 0.0425, next190k: 0.085, above200k: 0.17 }
				}
	};
};

