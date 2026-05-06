import type { ModuleDefinition } from '$platform/modules/types';
import { registerCoreHandlers } from './handlers';

/**
 * Core platform module — owns audit-log fanout, company settings access,
 * and shared utility surface. Has no business semantics; exists as a module
 * only so its event handlers participate in the registry lifecycle.
 */
export const coreModule: ModuleDefinition = {
	manifest: {
		id: 'core',
		name: 'Core',
		layer: 'base',
		dependencies: []
	},
	registerHandlers: registerCoreHandlers
};

export { createCoreApi, type CoreApi } from './api';
