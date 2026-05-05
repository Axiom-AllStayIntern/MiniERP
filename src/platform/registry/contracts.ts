import type { ModuleManifest as LegacyModuleManifest } from '../modules/types';

export type ModuleLayerV2 = LegacyModuleManifest['layer'];

export type ModuleDeliveryMode = 'standalone' | 'suite';

export type DependencyStrength = 'strong' | 'weak';

export type FailureSemantics =
	| 'unavailable'
	| 'timeout'
	| 'not_found'
	| 'permission_denied'
	| 'invalid_response';

export type DependencyFailurePolicy = 'degrade' | 'block' | 'retry' | 'fail';

export type ContractInvocationMode = 'sync' | 'async' | 'event';

export interface ContractSchemaRef {
	name: string;
	version: string;
	description?: string;
}

export interface InboundContract {
	id: string;
	description: string;
	mode: ContractInvocationMode;
	input: ContractSchemaRef;
	output: ContractSchemaRef;
	requiredPermissions: string[];
}

export interface OutboundContract {
	id: string;
	provider: 'platform' | 'module' | 'external';
	providerId: string;
	strength: DependencyStrength;
	description: string;
	failurePolicy: DependencyFailurePolicy;
	failures: FailureSemantics[];
}

export interface EventContract {
	type: string;
	payload: ContractSchemaRef;
	emittedWhen: string;
	retryable: boolean;
}

export interface ModuleDependencyContract {
	moduleId: string;
	strength: DependencyStrength;
	description: string;
	failurePolicy: DependencyFailurePolicy;
}

export interface ModuleContract {
	inbound: InboundContract[];
	outbound: OutboundContract[];
	events: EventContract[];
}

export interface ModuleManifestV2 {
	id: string;
	name: string;
	layer: ModuleLayerV2;
	deliveryModes: ModuleDeliveryMode[];
	dependencies: ModuleDependencyContract[];
	routes: string[];
	workspaces: string[];
	permissions: string[];
	taskTypes: string[];
	workflows: string[];
	dashboardCards: string[];
	aiCapabilities: string[];
	contract: ModuleContract;
}

export function toLegacyModuleManifest(manifest: ModuleManifestV2): LegacyModuleManifest {
	return {
		id: manifest.id,
		name: manifest.name,
		layer: manifest.layer,
		dependencies: manifest.dependencies.map((dependency) => dependency.moduleId)
	};
}
