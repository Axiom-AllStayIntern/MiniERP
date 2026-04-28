import type { DBClient } from '../../infrastructure/db';
import { auditLogs } from '../../infrastructure/db/schema';
import type { FinanceRiskLevel } from '../../modules/finance/agent/types';

export type AgentAuditStatus = 'ok' | 'denied' | 'failed';

export interface AgentAuditEntry {
	agentId: string;
	agentVersion: string;
	tenantId?: string;
	userId?: string | null;
	userEmail?: string | null;
	workflowId?: string;
	workflowStep?: string;
	intent?: string;
	toolId?: string;
	riskLevel: FinanceRiskLevel;
	inputRefs?: unknown;
	outputRefs?: unknown;
	modelId?: string;
	providerId?: string;
	promptVersion?: string;
	schemaVersion?: string;
	permissionResult: 'allowed' | 'denied';
	confirmationRequired: boolean;
	confirmationRef?: string;
	finalAction?: string;
	status: AgentAuditStatus;
	errorCode?: string;
}

export interface AppendAgentAuditResult {
	auditId: string;
}

function deriveAction(entry: AgentAuditEntry): string {
	if (entry.finalAction) return entry.finalAction;
	if (entry.status === 'denied') return 'agent.refused_action';
	if (entry.toolId) return 'agent.capability_call';
	if (entry.workflowStep) return 'agent.workflow_step';
	return 'agent.action';
}

export async function appendAgentAuditEntry(
	db: DBClient,
	entry: AgentAuditEntry
): Promise<AppendAgentAuditResult> {
	const auditId = crypto.randomUUID();
	const now = new Date().toISOString();
	await db.insert(auditLogs).values({
		id: auditId,
		actorUserId: entry.userId ?? null,
		actorEmail: entry.userEmail ?? null,
		action: deriveAction(entry),
		entityType: entry.workflowId ? 'workflow_step' : 'agent_action',
		entityId: entry.workflowId ?? null,
		projectId: null,
		metadata: JSON.stringify({
			agentId: entry.agentId,
			agentVersion: entry.agentVersion,
			tenantId: entry.tenantId,
			workflowId: entry.workflowId,
			workflowStep: entry.workflowStep,
			intent: entry.intent,
			toolId: entry.toolId,
			riskLevel: entry.riskLevel,
			inputRefs: entry.inputRefs,
			outputRefs: entry.outputRefs,
			modelId: entry.modelId,
			providerId: entry.providerId,
			promptVersion: entry.promptVersion,
			schemaVersion: entry.schemaVersion,
			permissionResult: entry.permissionResult,
			confirmationRequired: entry.confirmationRequired,
			confirmationRef: entry.confirmationRef,
			status: entry.status,
			errorCode: entry.errorCode
		}),
		createdAt: now,
		updatedAt: now
	});
	return { auditId };
}
