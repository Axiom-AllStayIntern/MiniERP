import type { ModuleContext } from '$platform/modules/types';
import { createDocumentIntakeLegacySource } from './adapters';
import type { DocumentIntakeSource } from './contracts';

export type DocumentIntakeApi = ReturnType<typeof createDocumentIntakePublicApi>;

export function createDocumentIntakePublicApi(source: DocumentIntakeSource) {
	return {
		getDocumentStatus: source.getDocumentStatus,
		uploadReferenceDocument: source.uploadReferenceDocument,
		saveDocHubUpload: source.saveDocHubUpload,
		savePanelIntake: source.savePanelIntake
	};
}

export function createDocumentIntakeApi(ctx: ModuleContext) {
	return createDocumentIntakePublicApi(createDocumentIntakeLegacySource(ctx));
}
