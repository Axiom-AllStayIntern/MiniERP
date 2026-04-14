import type { DomainAgentDef } from '../types';
import { arDomainAgent } from './ar-agent';
import { projectDomainAgent } from './project-agent';
import { expenseDomainAgent } from './expense-agent';
import { taxDomainAgent } from './tax-agent';
import { employeeDomainAgent } from './employee-agent';
import { reportingDomainAgent } from './reporting-agent';

export const domainRegistry: DomainAgentDef[] = [
	arDomainAgent,
	projectDomainAgent,
	expenseDomainAgent,
	taxDomainAgent,
	employeeDomainAgent,
	reportingDomainAgent
];

export function getDomainAgent(domainId: string): DomainAgentDef | undefined {
	return domainRegistry.find((d) => d.descriptor.id === domainId);
}
