import type { ModuleContext } from '$platform/modules/types';
import { NotFoundError } from '$platform/modules/errors';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { AuditService } from '$platform/audit/audit-service';
import { SupplierRepository } from './repository';
import {
	partnerContacts,
	partnerSupplierAttachments,
	partnerSupplierComplianceRecords,
	partnerSupplierEvaluations,
	partnerSupplierProfiles
} from './repositories/supplier.schema';

type SupplierType = 'individual' | 'corporate_local' | 'corporate_international';
type SupplierStatus = 'approved' | 'preferred' | 'on_hold' | 'blacklisted';
type GstRegistrationStatus = 'registered' | 'not_registered' | 'exempt' | 'unknown';
type TaxCode = 'SR' | 'ZR' | 'ES' | 'OP';
type SupplierRating = 'gold' | 'silver' | 'bronze' | 'not_approved';

type ScoreWeights = {
	quality: number;
	delivery: number;
	price: number;
	service: number;
	compliance: number;
	financialStability: number;
	sustainability: number;
};

type RatingThresholds = {
	gold: number;
	silver: number;
	bronze: number;
};

type SupplierProfileInput = {
	supplierType?: SupplierType;
	supplierStatus?: SupplierStatus;
	acraUen?: string;
	businessRegistrationNo?: string;
	gstRegistrationStatus?: GstRegistrationStatus;
	taxCode?: TaxCode;
	billingAddress?: string;
	shippingAddress?: string;
	bankName?: string;
	bankAccountNo?: string;
	swiftCode?: string;
	creditTerms?: string;
	paymentTerms?: string;
	preferredCurrency?: string;
	supplierCategory?: string;
};

type SupplierContactInput = {
	name: string;
	phoneEmail?: string;
	wechat?: string;
	position?: string;
};

type SupplierComplianceInput = {
	recordType: 'licence' | 'permit' | 'insurance' | 'certificate' | 'other';
	title: string;
	issuer?: string;
	referenceNo?: string;
	issueDate?: string;
	expiryDate?: string;
	status?: 'valid' | 'expiring' | 'expired' | 'pending_review';
	notes?: string;
};

type SupplierAttachmentInput = {
	attachmentType: 'mou' | 'nda' | 'contract' | 'certificate' | 'licence' | 'permit' | 'insurance' | 'other';
	title: string;
	fileName?: string;
	fileUrl?: string;
	expiryDate?: string;
	notes?: string;
};

export type SupplierEvaluationInput = {
	evaluationDate?: string;
	evaluationCategory?: string;
	defectRate?: number;
	returnRate?: number;
	onTimeDeliveryPct?: number;
	leadTimeReliabilityScore?: number;
	priceCompetitivenessScore?: number;
	paymentTermsScore?: number;
	responsivenessScore?: number;
	afterSalesSupportScore?: number;
	certificationScore?: number;
	creditCheckScore?: number;
	environmentalComplianceScore?: number;
	weights?: Partial<ScoreWeights>;
	thresholds?: Partial<RatingThresholds>;
	notes?: string;
};

function nullable(value?: string) {
	const trimmed = value?.trim();
	return trimmed ? trimmed : null;
}

const DEFAULT_WEIGHTS: ScoreWeights = {
	quality: 20,
	delivery: 20,
	price: 15,
	service: 15,
	compliance: 15,
	financialStability: 10,
	sustainability: 5
};

const DEFAULT_THRESHOLDS: RatingThresholds = {
	gold: 85,
	silver: 70,
	bronze: 55
};

function clampScore(value?: number) {
	if (!Number.isFinite(value)) return 0;
	return Math.max(0, Math.min(100, Number(value)));
}

function clampRate(value?: number) {
	if (!Number.isFinite(value)) return 0;
	return Math.max(0, Number(value));
}

function scoreFromInverseRate(rate: number, unacceptableRate: number) {
	return clampScore(100 - (clampRate(rate) / unacceptableRate) * 100);
}

function roundScore(value: number) {
	return Math.round(value * 10) / 10;
}

function normalizeWeights(input?: Partial<ScoreWeights>): ScoreWeights {
	const raw: ScoreWeights = {
		quality: Math.max(0, input?.quality ?? DEFAULT_WEIGHTS.quality),
		delivery: Math.max(0, input?.delivery ?? DEFAULT_WEIGHTS.delivery),
		price: Math.max(0, input?.price ?? DEFAULT_WEIGHTS.price),
		service: Math.max(0, input?.service ?? DEFAULT_WEIGHTS.service),
		compliance: Math.max(0, input?.compliance ?? DEFAULT_WEIGHTS.compliance),
		financialStability: Math.max(0, input?.financialStability ?? DEFAULT_WEIGHTS.financialStability),
		sustainability: Math.max(0, input?.sustainability ?? DEFAULT_WEIGHTS.sustainability)
	};
	const total = Object.values(raw).reduce((sum, value) => sum + value, 0);
	if (total <= 0) return DEFAULT_WEIGHTS;
	return Object.fromEntries(
		Object.entries(raw).map(([key, value]) => [key, roundScore((value / total) * 100)])
	) as ScoreWeights;
}

function normalizeThresholds(input?: Partial<RatingThresholds>): RatingThresholds {
	const gold = clampScore(input?.gold ?? DEFAULT_THRESHOLDS.gold);
	const silver = Math.min(gold, clampScore(input?.silver ?? DEFAULT_THRESHOLDS.silver));
	const bronze = Math.min(silver, clampScore(input?.bronze ?? DEFAULT_THRESHOLDS.bronze));
	return { gold, silver, bronze };
}

function ratingFromScore(score: number, thresholds: RatingThresholds): SupplierRating {
	if (score >= thresholds.gold) return 'gold';
	if (score >= thresholds.silver) return 'silver';
	if (score >= thresholds.bronze) return 'bronze';
	return 'not_approved';
}

export class ProcurementService {
	private suppliers: SupplierRepository;
	private db: ModuleContext['db'];
	private audit: AuditService;
	private user: ModuleContext['user'];

	constructor(ctx: ModuleContext) {
		this.db = ctx.db;
		this.suppliers = new SupplierRepository(ctx.db);
		this.audit = new AuditService(ctx);
		this.user = ctx.user;
	}

	async listSuppliers() {
		const rows = await this.suppliers.findAll();
		const profiles = await this.getProfilesByPartnerId(rows.map((r) => r.id));
		return rows.map((supplier) => ({
			...supplier,
			profile: profiles.get(supplier.id) ?? null
		}));
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
		const [profile, contacts, complianceRecords, attachments, scorecard] = await Promise.all([
			this.getProfileByPartnerId(id),
			this.db
				.select()
				.from(partnerContacts)
				.where(and(eq(partnerContacts.partnerId, id), isNull(partnerContacts.deletedAt)))
				.orderBy(desc(partnerContacts.createdAt)),
			this.db
				.select()
				.from(partnerSupplierComplianceRecords)
				.where(
					and(
						eq(partnerSupplierComplianceRecords.partnerId, id),
						isNull(partnerSupplierComplianceRecords.deletedAt)
					)
				)
				.orderBy(desc(partnerSupplierComplianceRecords.createdAt)),
			this.db
				.select()
				.from(partnerSupplierAttachments)
				.where(
					and(
						eq(partnerSupplierAttachments.partnerId, id),
						isNull(partnerSupplierAttachments.deletedAt)
					)
				)
				.orderBy(desc(partnerSupplierAttachments.createdAt)),
			this.getSupplierScorecard(id)
		]);
		return { supplier, profile, contacts, complianceRecords, attachments, scorecard };
	}

	async deleteSupplier(id: string) {
		const supplier = await this.suppliers.findById(id);
		if (!supplier) throw new NotFoundError('Supplier', id);
		const now = new Date().toISOString();
		await Promise.all([
			this.db
				.update(partnerContacts)
				.set({ deletedAt: now, updatedAt: now })
				.where(and(eq(partnerContacts.partnerId, id), isNull(partnerContacts.deletedAt))),
			this.db
				.update(partnerSupplierProfiles)
				.set({ deletedAt: now, updatedAt: now })
				.where(and(eq(partnerSupplierProfiles.partnerId, id), isNull(partnerSupplierProfiles.deletedAt))),
			this.db
				.update(partnerSupplierComplianceRecords)
				.set({ deletedAt: now, updatedAt: now })
				.where(
					and(
						eq(partnerSupplierComplianceRecords.partnerId, id),
						isNull(partnerSupplierComplianceRecords.deletedAt)
					)
				),
			this.db
				.update(partnerSupplierAttachments)
				.set({ deletedAt: now, updatedAt: now })
				.where(
					and(eq(partnerSupplierAttachments.partnerId, id), isNull(partnerSupplierAttachments.deletedAt))
				)
		]);
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
		profile?: SupplierProfileInput;
		contacts?: SupplierContactInput[];
		complianceRecords?: SupplierComplianceInput[];
		attachments?: SupplierAttachmentInput[];
	}) {
		const profile = data.profile ?? {};
		const row = await this.suppliers.create({
			name: data.name,
			address: data.address ?? null,
			contact: data.contact ?? null,
			itemDescription: data.itemDescription ?? null,
			dateCreate: data.dateCreate ?? null,
			projectRelated: data.projectRelated ?? null,
			gstRegNo: data.gstRegNo ?? null,
			metadata: data.metadata ?? null,
			registrationNo: nullable(profile.businessRegistrationNo) ?? nullable(profile.acraUen),
			country: null,
			currency: profile.preferredCurrency?.trim() || 'SGD'
		});
		const partnerId = row.id as string;
		const now = row.updatedAt as string;
		await this.upsertProfile(partnerId, profile, now);
		await Promise.all([
			this.insertContacts(partnerId, data.contacts ?? [], now),
			this.insertComplianceRecords(partnerId, data.complianceRecords ?? [], now),
			this.insertAttachments(partnerId, data.attachments ?? [], now)
		]);
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
			profile?: SupplierProfileInput;
			contacts?: SupplierContactInput[];
			complianceRecords?: SupplierComplianceInput[];
			attachments?: SupplierAttachmentInput[];
		}
	) {
		await this.suppliers.update(id, {
			name: data.name,
			address: data.address ?? null,
			contact: data.contact ?? null,
			itemDescription: data.itemDescription ?? null,
			dateCreate: data.dateCreate ?? null,
			projectRelated: data.projectRelated ?? null,
			gstRegNo: data.gstRegNo ?? null,
			...(data.profile
				? {
						registrationNo:
							nullable(data.profile.businessRegistrationNo) ?? nullable(data.profile.acraUen),
						currency: data.profile.preferredCurrency?.trim() || 'SGD'
					}
				: {})
		});
		const now = new Date().toISOString();
		await this.db
			.update(partnerContacts)
			.set({ deletedAt: now, updatedAt: now })
			.where(and(eq(partnerContacts.partnerId, id), isNull(partnerContacts.deletedAt)));
		await this.db
			.update(partnerSupplierComplianceRecords)
			.set({ deletedAt: now, updatedAt: now })
			.where(
				and(
					eq(partnerSupplierComplianceRecords.partnerId, id),
					isNull(partnerSupplierComplianceRecords.deletedAt)
				)
			);
		await this.db
			.update(partnerSupplierAttachments)
			.set({ deletedAt: now, updatedAt: now })
			.where(and(eq(partnerSupplierAttachments.partnerId, id), isNull(partnerSupplierAttachments.deletedAt)));
		if (data.profile) await this.upsertProfile(id, data.profile, now);
		await Promise.all([
			this.insertContacts(id, data.contacts ?? [], now),
			this.insertComplianceRecords(id, data.complianceRecords ?? [], now),
			this.insertAttachments(id, data.attachments ?? [], now)
		]);
	}

	async createSupplierEvaluation(partnerId: string, input: SupplierEvaluationInput) {
		const supplier = await this.suppliers.findById(partnerId);
		if (!supplier) throw new NotFoundError('Supplier', partnerId);
		const now = new Date().toISOString();
		const weights = normalizeWeights(input.weights);
		const thresholds = normalizeThresholds(input.thresholds);
		const metrics = {
			defectRate: clampRate(input.defectRate),
			returnRate: clampRate(input.returnRate),
			onTimeDeliveryPct: clampScore(input.onTimeDeliveryPct),
			leadTimeReliabilityScore: clampScore(input.leadTimeReliabilityScore),
			priceCompetitivenessScore: clampScore(input.priceCompetitivenessScore),
			paymentTermsScore: clampScore(input.paymentTermsScore),
			responsivenessScore: clampScore(input.responsivenessScore),
			afterSalesSupportScore: clampScore(input.afterSalesSupportScore),
			certificationScore: clampScore(input.certificationScore),
			creditCheckScore: clampScore(input.creditCheckScore),
			environmentalComplianceScore: clampScore(input.environmentalComplianceScore)
		};
		const categoryScores = {
			qualityScore: roundScore(
				(scoreFromInverseRate(metrics.defectRate, 10) + scoreFromInverseRate(metrics.returnRate, 20)) / 2
			),
			deliveryScore: roundScore(
				(metrics.onTimeDeliveryPct + metrics.leadTimeReliabilityScore) / 2
			),
			priceScore: roundScore(
				(metrics.priceCompetitivenessScore + metrics.paymentTermsScore) / 2
			),
			serviceScore: roundScore(
				(metrics.responsivenessScore + metrics.afterSalesSupportScore) / 2
			),
			complianceScore: roundScore(metrics.certificationScore),
			financialStabilityScore: roundScore(metrics.creditCheckScore),
			sustainabilityScore: roundScore(metrics.environmentalComplianceScore)
		};
		const overallScore = roundScore(
			(categoryScores.qualityScore * weights.quality +
				categoryScores.deliveryScore * weights.delivery +
				categoryScores.priceScore * weights.price +
				categoryScores.serviceScore * weights.service +
				categoryScores.complianceScore * weights.compliance +
				categoryScores.financialStabilityScore * weights.financialStability +
				categoryScores.sustainabilityScore * weights.sustainability) /
				100
		);
		const overallRating = ratingFromScore(overallScore, thresholds);
		const row = {
			id: crypto.randomUUID(),
			partnerId,
			evaluationDate: nullable(input.evaluationDate) ?? now.slice(0, 10),
			evaluationCategory: nullable(input.evaluationCategory),
			evaluatorUserId: this.user?.id ?? null,
			evaluatorEmail: this.user?.email ?? null,
			...metrics,
			...categoryScores,
			qualityWeight: weights.quality,
			deliveryWeight: weights.delivery,
			priceWeight: weights.price,
			serviceWeight: weights.service,
			complianceWeight: weights.compliance,
			financialStabilityWeight: weights.financialStability,
			sustainabilityWeight: weights.sustainability,
			goldThreshold: thresholds.gold,
			silverThreshold: thresholds.silver,
			bronzeThreshold: thresholds.bronze,
			overallScore,
			overallRating,
			notes: nullable(input.notes),
			createdAt: now,
			updatedAt: now
		};
		await this.db.insert(partnerSupplierEvaluations).values(row);
		await this.audit.writeLog({
			module: 'procurement',
			actionType: 'create',
			action: 'supplier.evaluation.created',
			entityType: 'supplier_evaluation',
			entityId: row.id,
			newValue: {
				partnerId,
				supplierName: supplier.name,
				overallScore,
				overallRating,
				weights,
				thresholds
			},
			metadata: {
				partnerId,
				supplierName: supplier.name,
				evaluationDate: row.evaluationDate,
				evaluationCategory: row.evaluationCategory
			}
		});
		return row;
	}

	async listSupplierEvaluations(partnerId: string) {
		return this.db
			.select()
			.from(partnerSupplierEvaluations)
			.where(
				and(
					eq(partnerSupplierEvaluations.partnerId, partnerId),
					isNull(partnerSupplierEvaluations.deletedAt)
				)
			)
			.orderBy(desc(partnerSupplierEvaluations.evaluationDate), desc(partnerSupplierEvaluations.createdAt));
	}

	async getSupplierScorecard(partnerId: string) {
		const evaluations = await this.listSupplierEvaluations(partnerId);
		const latest = evaluations[0] ?? null;
		const chronological = [...evaluations].reverse();
		const trend = chronological.map((evaluation, index) => {
			const previous = chronological[index - 1];
			return {
				...evaluation,
				scoreDelta: previous ? roundScore(evaluation.overallScore - previous.overallScore) : null,
				ratingChanged: previous ? previous.overallRating !== evaluation.overallRating : false
			};
		});
		return { latest, evaluations, trend };
	}

	private async getProfilesByPartnerId(partnerIds: string[]) {
		if (partnerIds.length === 0) return new Map<string, typeof partnerSupplierProfiles.$inferSelect>();
		const rows = await this.db
			.select()
			.from(partnerSupplierProfiles)
			.where(
				and(
					inArray(partnerSupplierProfiles.partnerId, partnerIds),
					isNull(partnerSupplierProfiles.deletedAt)
				)
			);
		return new Map(rows.map((row) => [row.partnerId, row]));
	}

	private async getProfileByPartnerId(partnerId: string) {
		const rows = await this.db
			.select()
			.from(partnerSupplierProfiles)
			.where(and(eq(partnerSupplierProfiles.partnerId, partnerId), isNull(partnerSupplierProfiles.deletedAt)))
			.limit(1);
		return rows[0] ?? null;
	}

	private async upsertProfile(partnerId: string, profile: SupplierProfileInput, now: string) {
		const values = {
			supplierType: profile.supplierType ?? 'corporate_local',
			supplierStatus: profile.supplierStatus ?? 'approved',
			acraUen: nullable(profile.acraUen),
			businessRegistrationNo: nullable(profile.businessRegistrationNo),
			gstRegistrationStatus: profile.gstRegistrationStatus ?? 'unknown',
			taxCode: profile.taxCode ?? null,
			billingAddress: nullable(profile.billingAddress),
			shippingAddress: nullable(profile.shippingAddress),
			bankName: nullable(profile.bankName),
			bankAccountNo: nullable(profile.bankAccountNo),
			swiftCode: nullable(profile.swiftCode),
			creditTerms: nullable(profile.creditTerms),
			paymentTerms: nullable(profile.paymentTerms),
			preferredCurrency: nullable(profile.preferredCurrency) ?? 'SGD',
			supplierCategory: nullable(profile.supplierCategory),
			updatedAt: now
		};
		const existing = await this.getProfileByPartnerId(partnerId);
		if (existing) {
			await this.db
				.update(partnerSupplierProfiles)
				.set(values as any)
				.where(eq(partnerSupplierProfiles.id, existing.id));
			return;
		}
		await this.db.insert(partnerSupplierProfiles).values({
			id: crypto.randomUUID(),
			partnerId,
			...values,
			createdAt: now
		} as any);
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

	private async insertComplianceRecords(
		partnerId: string,
		records: SupplierComplianceInput[],
		now: string
	) {
		for (const record of records) {
			const title = record.title.trim();
			if (!title) continue;
			await this.db.insert(partnerSupplierComplianceRecords).values({
				id: crypto.randomUUID(),
				partnerId,
				recordType: record.recordType,
				title,
				issuer: nullable(record.issuer),
				referenceNo: nullable(record.referenceNo),
				issueDate: nullable(record.issueDate),
				expiryDate: nullable(record.expiryDate),
				status: record.status ?? 'pending_review',
				notes: nullable(record.notes),
				createdAt: now,
				updatedAt: now
			});
		}
	}

	private async insertAttachments(partnerId: string, attachments: SupplierAttachmentInput[], now: string) {
		for (const attachment of attachments) {
			const title = attachment.title.trim();
			if (!title) continue;
			await this.db.insert(partnerSupplierAttachments).values({
				id: crypto.randomUUID(),
				partnerId,
				attachmentType: attachment.attachmentType,
				title,
				fileName: nullable(attachment.fileName),
				fileUrl: nullable(attachment.fileUrl),
				expiryDate: nullable(attachment.expiryDate),
				notes: nullable(attachment.notes),
				createdAt: now,
				updatedAt: now
			});
		}
	}
}
