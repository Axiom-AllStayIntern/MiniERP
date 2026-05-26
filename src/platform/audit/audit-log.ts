import type { DBClient } from '../../infrastructure/db';
import { auditLogs } from '../../infrastructure/db/schema';
import type { PlatformRiskLevel } from '../ai/capability-registry';
import { desc, sql } from 'drizzle-orm';

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
	riskLevel: PlatformRiskLevel;
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
	metadata?: Record<string, unknown>;
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

function deriveActionType(entry: AgentAuditEntry): string {
	if (entry.finalAction?.includes('created') || entry.finalAction?.includes('create')) return 'create';
	if (entry.finalAction?.includes('updated') || entry.finalAction?.includes('update')) return 'update';
	if (entry.finalAction?.includes('deleted') || entry.finalAction?.includes('delete')) return 'delete';
	return 'system';
}

async function computeHash(input: string): Promise<string> {
	const data = new TextEncoder().encode(input);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function appendAgentAuditEntry(
	db: DBClient,
	entry: AgentAuditEntry
): Promise<AppendAgentAuditResult> {
	const auditId = crypto.randomUUID();
	const now = new Date().toISOString();

	const [seqResult] = await db
		.select({ maxSeq: sql<number>`COALESCE(MAX(seq), 0)` })
		.from(auditLogs);
	const nextSeq = (seqResult?.maxSeq ?? 0) + 1;

	const [lastRow] = await db
		.select({ hashChain: auditLogs.hashChain })
		.from(auditLogs)
		.orderBy(desc(auditLogs.seq))
		.limit(1);
	const prevHash = lastRow?.hashChain ?? '';

	const action = deriveAction(entry);
	const rowContent = JSON.stringify({
		id: auditId, seq: nextSeq,
		actorUserId: entry.userId ?? null,
		actorEmail: entry.userEmail ?? null,
		action,
		entityType: entry.workflowId ? 'workflow_step' : 'agent_action',
		entityId: entry.workflowId ?? null,
		createdAt: now
	});
	const hashChain = await computeHash(prevHash + rowContent);

	await db.insert(auditLogs).values({
		id: auditId,
		actorUserId: entry.userId ?? null,
		actorEmail: entry.userEmail ?? null,
		ipAddress: null,
		module: 'finance',
		actionType: deriveActionType(entry),
		action,
		entityType: entry.workflowId ? 'workflow_step' : 'agent_action',
		entityId: entry.workflowId ?? null,
		projectId: null,
		oldValue: null,
		newValue: null,
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
			errorCode: entry.errorCode,
			...entry.metadata
		}),
		hashChain,
		seq: nextSeq,
		createdAt: now,
		updatedAt: now
	});
	return { auditId };
}
