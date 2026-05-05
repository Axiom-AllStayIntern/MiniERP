import type { PageServerLoad } from './$types';

import { createBusinessPartnerApi } from '$modules/legacy/server-modules/business-partner/api';
import { createModuleContext } from '$platform/modules';

export const load: PageServerLoad = async (event) => {
	const q = (event.url.searchParams.get('q') ?? '').trim().toLowerCase();
	const project = (event.url.searchParams.get('project') ?? '').trim().toLowerCase();

	if (!event.platform) {
		return {
			filters: { q, project },
			projectOptions: [] as string[],
			suppliers: [] as {
				id: string;
				name: string;
				contact: string | null;
				address: string | null;
				itemDescription: string | null;
				dateCreate: string | null;
				projectRelated: string | null;
				contacts: Array<{
					id: string;
					name: string;
					phoneEmail: string | null;
					wechat: string | null;
					position: string | null;
				}>;
			}[]
		};
	}

	const ctx = await createModuleContext(event);
	const bp = createBusinessPartnerApi(ctx);
	const rows = await bp.listSuppliers();
	const contacts = await bp.listPartnerContacts(rows.map((r) => r.id));
	const byPartnerId = new Map<string, typeof contacts>();
	for (const c of contacts) {
		const list = byPartnerId.get(c.partnerId) ?? [];
		list.push(c);
		byPartnerId.set(c.partnerId, list);
	}
	const suppliers = [...rows].sort(
		(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
	);
	const normalized = suppliers.map((s) => ({
		id: s.id,
		name: s.name,
		contact: s.contact ?? null,
		address: s.address ?? null,
		itemDescription: s.itemDescription ?? null,
		dateCreate: s.dateCreate ?? null,
		projectRelated: s.projectRelated ?? null,
		contacts: (byPartnerId.get(s.id) ?? []).map((c) => ({
			id: c.id,
			name: c.name,
			phoneEmail: c.phoneEmail ?? null,
			wechat: c.wechat ?? null,
			position: c.position ?? null
		}))
	}));
	const projectOptions = Array.from(
		new Set(
			normalized
				.map((s) => s.projectRelated?.trim() ?? '')
				.filter((v) => v.length > 0)
		)
	).sort((a, b) => a.localeCompare(b));
	const filtered = normalized.filter((s) => {
		if (project && (s.projectRelated ?? '').toLowerCase() !== project) return false;
		if (!q) return true;
		const haystack = [
			s.name,
			s.contact ?? '',
			s.itemDescription ?? '',
			s.projectRelated ?? '',
			s.address ?? '',
			...s.contacts.flatMap((c) => [c.name, c.phoneEmail ?? '', c.wechat ?? '', c.position ?? ''])
		]
			.join(' ')
			.toLowerCase();
		return haystack.includes(q);
	});

	return {
		filters: { q, project },
		projectOptions,
		suppliers: filtered
	};
};

