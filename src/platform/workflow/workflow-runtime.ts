import type { VendorInvoiceIntakeStepId } from '../../modules/finance/workflows/vendor-invoice-intake/definition';

export type WorkflowStatus = 'active' | 'completed' | 'aborted';

export interface WorkflowStateRecord<TStep extends string = string> {
	id: string;
	workflowId: string;
	agentId: string;
	step: TStep;
	status: WorkflowStatus;
	data: Record<string, unknown>;
	userId: string;
	tenantId: string;
	createdAt: number;
	updatedAt: number;
	confirmationRef?: string;
}

export type VendorInvoiceIntakeState = WorkflowStateRecord<VendorInvoiceIntakeStepId>;

export interface StartWorkflowInput {
	workflowId: string;
	agentId: string;
	initialStep: string;
	userId: string;
	tenantId: string;
	data?: Record<string, unknown>;
}

const STATE_PREFIX = 'wf-state:';
const STATE_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

function stateKey(id: string): string {
	return `${STATE_PREFIX}${id}`;
}

export async function startWorkflow(
	kv: KVNamespace,
	input: StartWorkflowInput
): Promise<WorkflowStateRecord> {
	const now = Date.now();
	const id = crypto.randomUUID();
	const record: WorkflowStateRecord = {
		id,
		workflowId: input.workflowId,
		agentId: input.agentId,
		step: input.initialStep,
		status: 'active',
		data: input.data ?? {},
		userId: input.userId,
		tenantId: input.tenantId,
		createdAt: now,
		updatedAt: now
	};
	await kv.put(stateKey(id), JSON.stringify(record), { expirationTtl: STATE_TTL_SECONDS });
	return record;
}

export async function getState(
	kv: KVNamespace,
	id: string
): Promise<WorkflowStateRecord | null> {
	const raw = await kv.get(stateKey(id));
	if (!raw) return null;
	try {
		return JSON.parse(raw) as WorkflowStateRecord;
	} catch {
		return null;
	}
}

export async function patchState(
	kv: KVNamespace,
	id: string,
	patch: {
		step?: string;
		dataPatch?: Record<string, unknown>;
		status?: WorkflowStatus;
		confirmationRef?: string;
	}
): Promise<WorkflowStateRecord> {
	const current = await getState(kv, id);
	if (!current) {
		throw new Error(`Workflow not found: ${id}`);
	}
	const next: WorkflowStateRecord = {
		...current,
		step: patch.step ?? current.step,
		data: patch.dataPatch ? { ...current.data, ...patch.dataPatch } : current.data,
		status: patch.status ?? current.status,
		confirmationRef: patch.confirmationRef ?? current.confirmationRef,
		updatedAt: Date.now()
	};
	await kv.put(stateKey(id), JSON.stringify(next), { expirationTtl: STATE_TTL_SECONDS });
	return next;
}

export async function endWorkflow(
	kv: KVNamespace,
	id: string,
	finalStatus: WorkflowStatus
): Promise<WorkflowStateRecord> {
	return patchState(kv, id, { status: finalStatus });
}
