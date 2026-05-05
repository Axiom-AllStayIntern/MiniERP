import type { ModuleDefinition } from '$platform/modules/types';
import { registerCoreHandlers } from './handlers';

export const coreModule: ModuleDefinition = {
	manifest: {
		id: 'core',
		name: 'Core',
		layer: 'core',
		dependencies: []
	},
	registerHandlers: registerCoreHandlers
};

export { createCoreApi, type CoreApi } from './api';
