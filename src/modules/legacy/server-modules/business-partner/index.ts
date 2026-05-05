import type { ModuleDefinition } from '$platform/modules/types';
import { registerBPHandlers } from './handlers';

export const businessPartnerModule: ModuleDefinition = {
	manifest: {
		id: 'business-partner',
		name: 'Business Partner',
		layer: 'base',
		dependencies: ['core', 'person']
	},
	registerHandlers: registerBPHandlers
};

export { createBusinessPartnerApi, type BusinessPartnerApi } from './api';
