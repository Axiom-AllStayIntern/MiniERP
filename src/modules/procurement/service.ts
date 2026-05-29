import type { ModuleContext } from '$platform/modules/types';
import { NotFoundError } from '$platform/modules/errors';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { SupplierRepository } from './repository';
import { partnerContacts, partnerSupplierProfiles } from './repositories/supplier.schema';

export class ProcurementService {
	private suppliers: SupplierRepository;
	private db: ModuleContext['db'];

	constructor(ctx: ModuleContext) {
		this.db = ctx.db;
		this.suppliers = new SupplierRepository(ctx.db);
	}

	async listSuppliers() {
		return this.suppliers.findAll();
	}

	async listPartnerContacts(partnerIds?: string[]) {
		const ids = (partnerIds ?? []).filter(Boolean);
		if (ids.length === 0) return [];
		return this.db
			.select()
			.from(partnerContacts)
			.where(and(inArray(partnerContacts.partnerId, ids), isNull(partnerContacts.deletedAt)));
	}

	async getSupplierDetail(id: string) {
		const supplier = await this.suppliers.findById(id);
		if (!supplier) throw new NotFoundError('Supplier', id);
		const contacts = await this.db
			.select()
			.from(partnerContacts)
			.where(and(eq(partnerContacts.partnerId, id), isNull(partnerContacts.deletedAt)));
		return { supplier, contacts };
	}

	async deleteSupplier(id: string) {
		const supplier = await this.suppliers.findById(id);
		if (!supplier) throw new NotFoundError('Supplier', id);
		await this.suppliers.softDelete(id);
	}

	async createSupplier(data: {
		name: string;
		address?: string;
		contact?: string;
		itemDescription?: string;
		dateCreate?: string;
		projectRelated?: string;
		gstRegNo?: string;
		metadata?: string;
		contacts?: Array<{ name: string; phoneEmail?: string; wechat?: string; position?: string }>;
	}) {
		const row = await this.suppliers.create({
			name: data.name,
			address: data.address ?? null,
			contact: data.contact ?? null,
			itemDescription: data.itemDescription ?? null,
			dateCreate: data.dateCreate ?? null,
			projectRelated: data.projectRelated ?? null,
			gstRegNo: data.gstRegNo ?? null,
			metadata: data.metadata ?? null,
			registrationNo: null,
			country: null,
			currency: 'SGD'
		});
		const partnerId = row.id as string;
		const now = row.updatedAt as string;
		await this.db.insert(partnerSupplierProfiles).values({
			id: crypto.randomUUID(),
			partnerId,
			paymentTerms: null,
			preferredCurrency: 'SGD',
			supplierCategory: null,
			createdAt: now,
			updatedAt: now
		});
		await this.insertContacts(partnerId, data.contacts ?? [], new Date().toISOString());
		return row;
	}

	async updateSupplierWithContacts(
		id: string,
		data: {
			name: string;
			address?: string;
			contact?: string;
			itemDescription?: string;
			dateCreate?: string;
			projectRelated?: string;
			gstRegNo?: string;
			contacts?: Array<{ name: string; phoneEmail?: string; wechat?: string; position?: string }>;
		}
	) {
		await this.suppliers.update(id, {
			name: data.name,
			address: data.address ?? null,
			contact: data.contact ?? null,
			itemDescription: data.itemDescription ?? null,
			dateCreate: data.dateCreate ?? null,
			projectRelated: data.projectRelated ?? null,
			gstRegNo: data.gstRegNo ?? null
		});
		const now = new Date().toISOString();
		await this.db
			.update(partnerContacts)
			.set({ deletedAt: now, updatedAt: now })
			.where(and(eq(partnerContacts.partnerId, id), isNull(partnerContacts.deletedAt)));
		await this.insertContacts(id, data.contacts ?? [], now);
	}

	private async insertContacts(
		partnerId: string,
		contacts: Array<{ name: string; phoneEmail?: string; wechat?: string; position?: string }>,
		now: string
	) {
		for (const c of contacts) {
			const name = c.name.trim();
			if (!name) continue;
			await this.db.insert(partnerContacts).values({
				id: crypto.randomUUID(),
				partnerId,
				name,
				phoneEmail: c.phoneEmail?.trim() || null,
				wechat: c.wechat?.trim() || null,
				position: c.position?.trim() || null,
				createdAt: now,
				updatedAt: now
			});
		}
	}
}
