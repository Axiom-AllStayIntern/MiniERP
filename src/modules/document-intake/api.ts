import type { ModuleContext } from '../../lib/server/modules/types';
import { createDocumentIntakeLegacySource } from './adapters';
import type { DocumentIntakeSource } from './contracts';

export type DocumentIntakeApi = ReturnType<typeof createDocumentIntakePublicApi>;

export function createDocumentIntakePublicApi(source: DocumentIntakeSource) {
	return {
		getDocumentStatus: source.getDocumentStatus,
		getSupplierInvoiceOcrStatus: source.getSupplierInvoiceOcrStatus,
		confirmSupplierInvoiceOcr: source.confirmSupplierInvoiceOcr,
		uploadReferenceDocument: source.uploadReferenceDocument,
		confirmUploadedObject: source.confirmUploadedObject,
		saveDocHubUpload: source.saveDocHubUpload,
		savePanelIntake: source.savePanelIntake
	};
}

export function createDocumentIntakeApi(ctx: ModuleContext) {
	return createDocumentIntakePublicApi(createDocumentIntakeLegacySource(ctx));
}
