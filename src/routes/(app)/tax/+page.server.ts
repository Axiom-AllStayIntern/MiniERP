import type { PageServerLoad } from './$types';

type ApiResult<T> = {
	ok: boolean;
	data: T;
	error?: string;
};

function getDefaultQuarter() {
	const now = new Date();
	const year = now.getUTCFullYear();
	const quarter = Math.floor(now.getUTCMonth() / 3) + 1;
	return { year, quarter };
}

export const load: PageServerLoad = async ({ fetch, url }) => {
	const fallback = getDefaultQuarter();
	const year = Number.parseInt(url.searchParams.get('year') ?? `${fallback.year}`, 10);
	const quarter = Number.parseInt(url.searchParams.get('quarter') ?? `${fallback.quarter}`, 10);

	const [gstResponse, corporateResponse] = await Promise.all([
		fetch(`/api/tax/gst/${year}/${quarter}`),
		fetch(`/api/tax/corporate/${year}`)
	]);
	const gstJson = (await gstResponse.json()) as ApiResult<{
		year: string;
		quarter: string;
		range: { start: string; end: string };
		boxes: Record<string, number>;
		meta?: { notes?: string[] };
	}>;
	const corporateJson = (await corporateResponse.json()) as ApiResult<{
		year: number;
		taxableIncome: number;
		taxPayable: number;
		effectiveRate: number;
	}>;

	return {
		year,
		quarter,
		gst: gstJson.ok
			? gstJson.data
			: {
					year: `${year}`,
					quarter: `${quarter}`,
					range: { start: '', end: '' },
					boxes: {
						box1: 0,
						box2: 0,
						box3: 0,
						box4: 0,
						box5: 0,
						box6: 0,
						box7: 0,
						box8: 0,
						box9: 0,
						box10: 0,
						box11: 0,
						box12: 0,
						box13: 0
					},
					meta: { notes: [] }
				},
		corporatePreview: corporateJson.ok
			? corporateJson.data
			: {
					year,
					taxableIncome: 0,
					taxPayable: 0,
					effectiveRate: 0
				}
	};
};

