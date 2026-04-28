import type {
	FinanceCapability,
	FinanceCapabilityContext
} from '../../modules/finance/capabilities/types';
import type { FinanceRiskLevel } from '../../modules/finance/agent/types';

export interface ToolManifest {
	id: string;
	ownerModule: string;
	description: string;
	riskLevel: FinanceRiskLevel;
	allowedAgents: string[];
	requiredUserPermissions: string[];
	requiresConfirmation: boolean;
	auditRequired: boolean;
	enabled: boolean;
}

interface RegistryEntry {
	manifest: ToolManifest;
	capability: FinanceCapability<unknown, unknown>;
}

const entries = new Map<string, RegistryEntry>();

export function registerCapability<TInput, TOutput>(
	manifest: ToolManifest,
	capability: FinanceCapability<TInput, TOutput>
): void {
	if (manifest.id !== capability.id) {
		throw new Error(
			`Capability id mismatch: manifest=${manifest.id} capability=${capability.id}`
		);
	}
	entries.set(manifest.id, {
		manifest,
		capability: capability as FinanceCapability<unknown, unknown>
	});
}

export function lookupCapability(id: string): RegistryEntry | undefined {
	return entries.get(id);
}

export function listCapabilities(): ToolManifest[] {
	return [...entries.values()].map((entry) => entry.manifest);
}

export function executeCapability(
	id: string,
	input: unknown,
	ctx: FinanceCapabilityContext
): Promise<unknown> {
	const entry = entries.get(id);
	if (!entry) {
		throw new Error(`Capability not registered: ${id}`);
	}
	if (!entry.manifest.enabled) {
		throw new Error(`Capability disabled: ${id}`);
	}
	return entry.capability.execute(input, ctx);
}

export function clearCapabilityRegistry(): void {
	entries.clear();
}
