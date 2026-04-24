import type { ModuleContext } from '../../lib/server/modules/types';
import { DocumentIntakeService } from '../../lib/server/modules/document-intake/service';
import type { DocumentIntakeSource } from './contracts';

export function createDocumentIntakeLegacySource(ctx: ModuleContext): DocumentIntakeSource {
	const svc = new DocumentIntakeService(ctx);

	return {
		getDocumentStatus: svc.getDocumentStatus.bind(svc),
		getSupplierInvoiceOcrStatus: svc.getSupplierInvoiceOcrStatus.bind(svc),
		confirmSupplierInvoiceOcr: svc.confirmSupplierInvoiceOcr.bind(svc),
		uploadReferenceDocument: svc.uploadReferenceDocument.bind(svc),
		confirmUploadedObject: svc.confirmUploadedObject.bind(svc),
		saveDocHubUpload: svc.saveDocHubUpload.bind(svc),
		savePanelIntake: svc.savePanelIntake.bind(svc)
	};
}
