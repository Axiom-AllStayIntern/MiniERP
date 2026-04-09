import { and, eq, inArray, isNull } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import { writeAuditLog } from '$lib/server/audit';
import { getDb, schema } from '$lib/server/modules/legacy-db';

const MANUAL_BOX_KEYS = [
	'gst_box9_manual',
	'gst_box10_manual',
	'gst_box11_manual',
	'gst_box12_manual'
] as const;

type ManualBoxKey = (typeof MANUAL_BOX_KEYS)[number];

export const load: PageServerLoad = async ({ platform }) => {
	if (!platform) {
		return {
			values: {
				gst_box9_manual: 0,
				gst_box10_manual: 0,
				gst_box11_manual: 0,
				gst_box12_manual: 0
			}
		};
	}

	const db = getDb(platform.env);
	const rows = await db
		.select({ key: schema.companySettings.key, value: schema.companySettings.value })
		.from(schema.companySettings)
		.where(and(inArray(schema.companySettings.key, [...MANUAL_BOX_KEYS]), isNull(schema.companySettings.deletedAt)));

	const valueMap = new Map(rows.map((row) => [row.key, Number.parseFloat(row.value)]));
	return {
		values: {
			gst_box9_manual: valueMap.get('gst_box9_manual') ?? 0,
			gst_box10_manual: valueMap.get('gst_box10_manual') ?? 0,
			gst_box11_manual: valueMap.get('gst_box11_manual') ?? 0,
			gst_box12_manual: valueMap.get('gst_box12_manual') ?? 0
		}
	};
};

export const actions: Actions = {
	default: async ({ request, platform, locals }) => {
		if (!platform) {
			return fail(500, { message: 'Cloudflare platform bindings are required' });
		}

		const form = await request.formData();
		const db = getDb(platform.env);
		const now = new Date().toISOString();

		for (const key of MANUAL_BOX_KEYS) {
			const raw = String(form.get(key) ?? '0');
			const value = Number.parseFloat(raw);
			const normalized = Number.isFinite(value) ? value : 0;

			const [existing] = await db
				.select({ key: schema.companySettings.key })
				.from(schema.companySettings)
				.where(eq(schema.companySettings.key, key))
				.limit(1);

			if (existing) {
				await db
					.update(schema.companySettings)
					.set({
						value: `${normalized}`,
						deletedAt: null,
						updatedAt: now
					})
					.where(eq(schema.companySettings.key, key));
			} else {
				await db.insert(schema.companySettings).values({
					key: key as ManualBoxKey,
					value: `${normalized}`,
					createdAt: now,
					updatedAt: now
				});
			}
		}

		await writeAuditLog(platform, locals.user, {
			action: 'tax.manual_boxes.update',
			entityType: 'tax_settings',
			entityId: 'gst_manual_boxes',
			metadata: Object.fromEntries(
				MANUAL_BOX_KEYS.map((key) => [
					key,
					Number.parseFloat(String(form.get(key) ?? '0')) || 0
				])
			)
		});

		return { ok: true };
	}
};
