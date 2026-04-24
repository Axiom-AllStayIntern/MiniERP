import type { ModuleDefinition } from '../../lib/server/modules/types';
import { registerDocumentIntakeHandlers } from './handlers';

export const documentIntakeModule: ModuleDefinition = {
	manifest: {
		id: 'document-intake',
		name: 'Document Intake',
		layer: 'feature',
		dependencies: ['core', 'ar', 'expense']
	},
	registerHandlers: registerDocumentIntakeHandlers
};

export { createDocumentIntakeApi, type DocumentIntakeApi } from './api';
export type { DocumentIntakeSource } from './contracts';
