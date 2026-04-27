import { classifyDocumentCapability } from './classify-document';
import { explainDecisionCapability } from './explain-decision';
import { extractFieldsCapability } from './extract-fields';
import { suggestNextTaskCapability } from './suggest-next-task';

export {
	financeAgentActionSets,
	financeAllAgentActions,
	type FinanceAgentActionSets
} from './agent-actions';

export const financeCapabilities = [
	classifyDocumentCapability,
	extractFieldsCapability,
	explainDecisionCapability,
	suggestNextTaskCapability
] as const;

export const financeCapabilityIds = financeCapabilities.map((capability) => capability.id);
