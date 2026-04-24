import { DocumentIntakeService } from '../../lib/server/modules/document-intake/service';

type LegacyDocumentIntakeService = InstanceType<typeof DocumentIntakeService>;

export interface DocumentIntakeSource {
	getDocumentStatus: LegacyDocumentIntakeService['getDocumentStatus'];
	getSupplierInvoiceOcrStatus: LegacyDocumentIntakeService['getSupplierInvoiceOcrStatus'];
	confirmSupplierInvoiceOcr: LegacyDocumentIntakeService['confirmSupplierInvoiceOcr'];
	uploadReferenceDocument: LegacyDocumentIntakeService['uploadReferenceDocument'];
	confirmUploadedObject: LegacyDocumentIntakeService['confirmUploadedObject'];
	saveDocHubUpload: LegacyDocumentIntakeService['saveDocHubUpload'];
	savePanelIntake: LegacyDocumentIntakeService['savePanelIntake'];
}
