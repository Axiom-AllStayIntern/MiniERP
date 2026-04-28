import type { FinanceRiskLevel } from '../agent/types';

export interface FinanceCapabilityContext {
	tenantId?: string;
	userId?: string;
	useMock?: boolean;
}

export interface FinanceCapabilityDescriptor {
	id: string;
	description: string;
	riskLevel: FinanceRiskLevel;
}

export interface FinanceCapability<TInput, TOutput> extends FinanceCapabilityDescriptor {
	execute(input: TInput, ctx: FinanceCapabilityContext): Promise<TOutput>;
}
