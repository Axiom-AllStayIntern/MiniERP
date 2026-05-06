import type { ModuleContext } from '$platform/modules/types';
import { DocumentIntakeService } from './services/legacy-document-intake-service';
import type { DocumentIntakeSource } from './contracts';

export function createDocumentIntakeLegacySource(ctx: ModuleContext): DocumentIntakeSource {
	const svc = new DocumentIntakeService(ctx);

	return {
		getDocumentStatus: svc.getDocumentStatus.bind(svc),
		uploadReferenceDocument: svc.uploadReferenceDocument.bind(svc),
		saveDocHubUpload: svc.saveDocHubUpload.bind(svc),
		savePanelIntake: svc.savePanelIntake.bind(svc)
	};
}
