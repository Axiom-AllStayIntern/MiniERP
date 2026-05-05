import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { timeFields } from '$platform/modules/schema-helpers';

/**
 * Document artifacts â€?the standardized representation of any file received
 * by SmartFin (manual upload now, email/drive/etc. later). Owned by the
 * Document Intake module per ref_files/v4/phase0-6/04 Â§6.
 *
 * JSON columns hold richer typed payloads (see
 * `../schemas/document-artifact.schema.ts` for the zod shapes); keeping them
 * as JSON keeps the migration footprint minimal while leaving room for the
 * future processing pipeline to add fields without per-column migrations.
 */
export const documentArtifacts = sqliteTable('document_artifacts', {
	id: text('id').primaryKey(),
	tenantId: text('tenant_id').notNull().default('default'),

	source: text('source', {
		enum: [
			'manual_upload',
			'email_attachment',
			'google_drive',
			'dropbox',
			'whatsapp_upload',
			'mobile_scan',
			'accounting_export',
			'bulk_zip_upload',
			'api_upload'
		]
	}).notNull(),

	processingStatus: text('processing_status', {
		enum: [
			'received',
			'stored',
			'text_extraction_pending',
			'text_extracted',
			'ocr_pending',
			'ocr_completed',
			'classification_pending',
			'classified',
			'ready_for_workflow',
			'needs_manual_review',
			'failed'
		]
	})
		.notNull()
		.default('received'),

	documentType: text('document_type', {
		enum: [
			'supplier_invoice',
			'receipt',
			'purchase_order',
			'customer_invoice',
			'logistics_document',
			'contract',
			'quotation',
			'bank_statement',
			'tax_document',
			'unknown'
		]
	}),

	/** {@link OriginalFileMeta} JSON */
	originalFile: text('original_file').notNull(),
	/** {@link DocumentSourceMetadata} JSON */
	sourceMetadata: text('source_metadata'),
	/** {@link TextExtractionResult} JSON */
	textExtraction: text('text_extraction'),
	/** {@link DocumentClassificationResult} JSON */
	classification: text('classification'),
	/** Free-form normalized metadata JSON */
	normalizedMetadata: text('normalized_metadata'),
	/** {@link DocumentSecurityFlag}[] JSON */
	securityFlags: text('security_flags'),

	/** Soft retention bytes for analytics â€?duplicated from originalFile.sizeBytes for fast filters. */
	sizeBytes: integer('size_bytes'),

	...timeFields
});
