import type { ModuleContext } from '$platform/modules/types';
import { BusinessPartnerRepository, CustomerRepository } from './repository';
import { NotFoundError } from '$platform/modules/errors';
import { partnerContacts, partnerSupplierProfiles } from './repositories/business-partner.schema';
import { and, eq, inArray, isNull } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// BusinessPartnerService
// ---------------------------------------------------------------------------

export class BusinessPartnerService {
	private bpRepo: BusinessPartnerRepository;
	private legacyCustomerRepo: CustomerRepository;
	private db: ModuleContext['db'];

	constructor(ctx: ModuleContext) {
		this.db = ctx.db;
		this.bpRepo = new BusinessPartnerRepository(ctx.db);
		this.legacyCustomerRepo = new CustomerRepository(ctx.db);
	}

	async getById(id: string) {
		const bp = await this.bpRepo.findById(id);
		if (!bp) throw new NotFoundError('BusinessPartner', id);
		return bp;
	}

	async listByType(type: 'customer' | 'supplier' | 'both') {
		return this.bpRepo.findByType(type);
	}

	async listSuppliers() {
		return this.bpRepo.findByType('supplier');
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
		const supplier = await this.getById(id);
		const contacts = await this.db
			.select()
			.from(partnerContacts)
			.where(and(eq(partnerContacts.partnerId, id), isNull(partnerContacts.deletedAt)));
		return { supplier, contacts };
	}

	async search(query: string) {
		return this.bpRepo.search(query);
	}

	async create(data: {
		name: string;
		type: 'customer' | 'supplier' | 'both';
		address?: string;
		contact?: string;
		gstRegNo?: string;
		metadata?: string;
	}) {
		return this.bpRepo.create(data);
	}

	async update(id: string, data: Record<string, unknown>) {
		return this.bpRepo.update(id, data);
	}

	async softDelete(id: string) {
		const bp = await this.bpRepo.findById(id);
		if (!bp) throw new NotFoundError('BusinessPartner', id);
		await this.bpRepo.softDelete(id);
	}

	// Legacy customer access
	async getCustomerById(id: string) {
		return this.legacyCustomerRepo.findById(id);
	}

	async listCustomers() {
		return this.legacyCustomerRepo.findAll();
	}

	async listCustomerOptions() {
		return this.legacyCustomerRepo.listOptions();
	}

	async listCustomerDirectory() {
		return this.legacyCustomerRepo.listDirectory();
	}

	async createCustomer(data: { name: string; address?: string; contact?: string; gstRegNo?: string; metadata?: string }) {
		return this.legacyCustomerRepo.create(data);
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
		contacts?: Array<{
			name: string;
			phoneEmail?: string;
			wechat?: string;
			position?: string;
		}>;
	}) {
		const row = await this.bpRepo.create({
			name: data.name,
			type: 'supplier',
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
		const nowIso = new Date().toISOString();
		for (const c of data.contacts ?? []) {
			const name = c.name.trim();
			if (!name) continue;
			await this.db.insert(partnerContacts).values({
				id: crypto.randomUUID(),
				partnerId,
				name,
				phoneEmail: c.phoneEmail?.trim() || null,
				wechat: c.wechat?.trim() || null,
				position: c.position?.trim() || null,
				createdAt: nowIso,
				updatedAt: nowIso
			});
		}
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
			contacts?: Array<{
				name: string;
				phoneEmail?: string;
				wechat?: string;
				position?: string;
			}>;
		}
	) {
		await this.bpRepo.update(id, {
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
		for (const c of data.contacts ?? []) {
			const name = c.name.trim();
			if (!name) continue;
			await this.db.insert(partnerContacts).values({
				id: crypto.randomUUID(),
				partnerId: id,
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
