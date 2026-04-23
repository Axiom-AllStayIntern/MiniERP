import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import { writeAuditLog } from '$lib/server/audit';
import { createModuleContext } from '$lib/server/modules';
import { createTaxApi } from '$lib/server/modules/tax/api';

const MANUAL_BOX_KEYS = ['gst_box9_manual', 'gst_box10_manual', 'gst_box11_manual', 'gst_box12_manual'] as const;

type ManualBoxKey = (typeof MANUAL_BOX_KEYS)[number];

function getDefaultQuarter() {
	const now = new Date();
	const year = now.getUTCFullYear();
	const quarter = Math.floor(now.getUTCMonth() / 3) + 1;
	return { year, quarter };
}

const emptyManualValues: Record<ManualBoxKey, number> = {
	gst_box9_manual: 0,
	gst_box10_manual: 0,
	gst_box11_manual: 0,
	gst_box12_manual: 0
};

export const load: PageServerLoad = async (event) => {
	const { platform, url } = event;
	const fallback = getDefaultQuarter();
	const year = Number.parseInt(url.searchParams.get('year') ?? `${fallback.year}`, 10);
	const quarter = Number.parseInt(url.searchParams.get('quarter') ?? `${fallback.quarter}`, 10);
	const safeYear = Number.isFinite(year) ? year : fallback.year;
	const safeQuarter = [1, 2, 3, 4].includes(quarter) ? quarter : fallback.quarter;

	if (!platform) {
		return {
			year: safeYear,
			quarter: safeQuarter,
			values: emptyManualValues
		};
	}

	const ctx = await createModuleContext(event);
	const tax = createTaxApi(ctx);
	const values = await tax.getGstManualBoxValues();

	return {
		year: safeYear,
		quarter: safeQuarter,
		values
	};
};

export const actions: Actions = {
	default: async (event) => {
		const { request, platform, locals } = event;
		if (!platform) {
			return fail(500, { message: 'Cloudflare platform bindings are required' });
		}

		const form = await request.formData();
		const year = Number.parseInt(String(form.get('year') ?? ''), 10);
		const quarter = Number.parseInt(String(form.get('quarter') ?? ''), 10);
		if (!Number.isFinite(year) || ![1, 2, 3, 4].includes(quarter)) {
			return fail(400, { message: 'Invalid year or quarter' });
		}

		const values = Object.fromEntries(
			MANUAL_BOX_KEYS.map((key) => {
				const raw = String(form.get(key) ?? '0');
				const value = Number.parseFloat(raw);
				return [key, Number.isFinite(value) ? value : 0];
			})
		) as Record<ManualBoxKey, number>;

		const ctx = await createModuleContext(event);
		const tax = createTaxApi(ctx);
		await tax.saveGstManualBoxValues(values);

		await writeAuditLog(platform, locals.user, {
			action: 'tax.manual_boxes.update',
			entityType: 'tax_settings',
			entityId: `gst_${year}_q${quarter}`,
			metadata: {
				year,
				quarter,
				values
			}
		});

		return { ok: true, year, quarter };
	}
};
