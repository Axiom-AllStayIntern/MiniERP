import type { RequestHandler } from './$types';

import { fail, ok } from '$platform/http';
import { getDb, type DBClient } from '../../../../../../infrastructure/db';
import { financeAgentManifest } from '../../../../../../modules/finance/agent';
import {
	findVendorInvoiceIntakeStep,
	runFieldExtractionStep,
	runMatchingStep,
	type DocumentIntakeOutput,
	type ExtractedInvoiceFields
} from '../../../../../../modules/finance/workflows/vendor-invoice-intake';
import {
	findFinancialDocumentIntakeStep,
	runBucketSelectionStep,
	runCategorySelectionStep,
	runFieldExtractionStep as runDocFieldExtractionStep,
	runMatchingStep as runDocMatchingStep,
	runProjectSelectionStep,
	findCategoryById,
	type Bucket
} from '../../../../../../modules/finance/workflows/financial-document-intake';
import {
	findAllowanceRecordingStep,
	runManualEntryStep,
	type AllowanceManualEntry
} from '../../../../../../modules/finance/workflows/allowance-recording';
import { createDocumentIntakeService } from '../../../../../../modules/document-intake';
import { appendAgentAuditEntry } from '../../../../../../platform/audit/audit-log';
import { checkToolPolicy } from '../../../../../../platform/ai/tool-policy';
import {
	getState,
	patchState,
	type WorkflowStateRecord
} from '../../../../../../platform/workflow/workflow-runtime';

interface AdvanceBody {
	targetStep: string;
	payload?: {
		documentId?: string;
		fileName?: string;
		bucket?: Bucket;
		categoryId?: string;
		projectId?: string | null;
		/** allowance-recording manual entry. */
		allowanceEntry?: AllowanceManualEntry;
	};
}

interface ResolvedStepDef {
	id: string;
	allowedCapabilities: readonly string[];
	requiresUserConfirmation: boolean;
	nextSteps: readonly string[];
}

function lookupStep(workflowId: string, stepId: string): ResolvedStepDef | undefined {
	if (workflowId === 'vendor-invoice-intake') {
		const def = findVendorInvoiceIntakeStep(stepId as never);
		return def
			? {
					id: def.id,
					allowedCapabilities: def.allowedCapabilities,
					requiresUserConfirmation: def.requiresUserConfirmation,
					nextSteps: def.nextSteps as readonly string[]
				}
			: undefined;
	}
	if (workflowId === 'financial-document-intake') {
		const def = findFinancialDocumentIntakeStep(stepId as never);
		return def
			? {
					id: def.id,
					allowedCapabilities: def.allowedCapabilities,
					requiresUserConfirmation: def.requiresUserConfirmation,
					nextSteps: def.nextSteps as readonly string[]
				}
			: undefined;
	}
	if (workflowId === 'allowance-recording') {
		const def = findAllowanceRecordingStep(stepId as never);
		return def
			? {
					id: def.id,
					allowedCapabilities: def.allowedCapabilities,
					requiresUserConfirmation: def.requiresUserConfirmation,
					nextSteps: def.nextSteps as readonly string[]
				}
			: undefined;
	}
	return undefined;
}

interface PolicyGateOk {
	allowed: true;
}
interface PolicyGateDenied {
	allowed: false;
	missingPermissions: string[];
	blockedBy: string[];
}

async function gateAllCapabilities(
	db: DBClient,
	state: WorkflowStateRecord,
	allowedCapabilities: readonly string[],
	user: App.Locals['user']
): Promise<PolicyGateOk | PolicyGateDenied> {
	for (const capabilityId of allowedCapabilities) {
		const decision = checkToolPolicy({
			agentId: financeAgentManifest.id,
			capabilityId,
			userRole: user?.role,
			currentStepAllowedCapabilities: allowedCapabilities
		});
		if (!decision.allowed) {
			await appendAgentAuditEntry(db, {
				agentId: financeAgentManifest.id,
				agentVersion: financeAgentManifest.version,
				userId: user?.id ?? null,
				userEmail: user?.email ?? null,
				tenantId: state.tenantId,
				workflowId: state.id,
				workflowStep: state.step,
				toolId: capabilityId,
				riskLevel: decision.riskLevel,
				permissionResult: 'denied',
				confirmationRequired: decision.requiresConfirmation,
				finalAction: 'agent.policy_denied',
				status: 'denied',
				errorCode: decision.blockedBy.join(',')
			});
			return {
				allowed: false,
				missingPermissions: decision.missingUserPermissions,
				blockedBy: decision.blockedBy
			};
		}
	}
	return { allowed: true };
}

async function auditCapabilitySuccess(
	db: DBClient,
	state: WorkflowStateRecord,
	user: App.Locals['user'],
	capabilityId: string,
	outputRefs: unknown
) {
	const decision = checkToolPolicy({
		agentId: financeAgentManifest.id,
		capabilityId,
		userRole: user?.role
	});
	await appendAgentAuditEntry(db, {
		agentId: financeAgentManifest.id,
		agentVersion: financeAgentManifest.version,
		userId: user?.id ?? null,
		userEmail: user?.email ?? null,
		tenantId: state.tenantId,
		workflowId: state.id,
		workflowStep: state.step,
		toolId: capabilityId,
		riskLevel: decision.riskLevel,
		permissionResult: 'allowed',
		confirmationRequired: decision.requiresConfirmation,
		modelId: 'mock-v1',
		promptVersion: 'mock-v1',
		schemaVersion: 'v1',
		outputRefs,
		finalAction: 'agent.capability_call',
		status: 'ok'
	});
}

export const POST: RequestHandler = async (event) => {
	if (!event.platform) return fail('Cloudflare platform bindings are required', 500);
	const user = event.locals.user;
	if (!user) return fail('Unauthorized', 401);

	const id = event.params.id;
	if (!id) return fail('Workflow id is required', 400);

	const body = (await event.request.json().catch(() => null)) as AdvanceBody | null;
	if (!body?.targetStep) return fail('targetStep is required', 400);

	const env = event.platform.env;
	const db = getDb(env);
	const state = await getState(env.KV, id);
	if (!state) return fail('Workflow not found', 404);
	if (state.status !== 'active') return fail(`Workflow is ${state.status}`, 409);

	const currentStepDef = lookupStep(state.workflowId, state.step);
	if (!currentStepDef) return fail(`Unknown current step: ${state.step}`, 500);
	if (!currentStepDef.nextSteps.includes(body.targetStep)) {
		return fail(
			`Cannot advance from ${state.step} to ${body.targetStep}. Allowed: ${currentStepDef.nextSteps.join(', ') || '(none)'}.`,
			400
		);
	}
	const targetStepDef = lookupStep(state.workflowId, body.targetStep);
	if (!targetStepDef) return fail(`Unknown target step: ${body.targetStep}`, 400);

	const gate = await gateAllCapabilities(
		db,
		state,
		targetStepDef.allowedCapabilities,
		user
	);
	if (!gate.allowed) {
		return fail(
			`Policy denied: ${gate.blockedBy.join(', ')}${gate.missingPermissions.length ? ` (missing ${gate.missingPermissions.join(', ')})` : ''}`,
			403
		);
	}

	const ctx = {
		tenantId: state.tenantId,
		userId: state.userId,
		useMock: true,
		// `env` is read by capabilities that may invoke the platform AI runtime
		// (e.g. extract-invoice-fields LLM fallback). Capabilities that don't
		// need it ignore the field â€?keeping the runtime ctx shape minimal.
		env
	};

	switch (body.targetStep) {
		case 'document_intake': {
			if (!body.payload?.documentId) {
				return fail('payload.documentId is required for document_intake', 400);
			}
			const document: DocumentIntakeOutput = {
				documentId: body.payload.documentId,
				fileName: body.payload.fileName
			};
			const next = await patchState(env.KV, state.id, {
				step: body.targetStep,
				dataPatch: { document }
			});
			return ok({ currentStep: next.step, state: next });
		}

		case 'invoice_field_extraction': {
			const document = state.data.document as DocumentIntakeOutput | undefined;
			if (!document) return fail('Workflow has no document context', 400);

			// Phase 2: when the documentId points at a real DocumentArtifact,
			// load its OCR text so the capability can run heuristic + LLM
			// extraction over real content. Phase 1 mock ids (`mock-â€¦`) skip
			// this and fall through to the capability's fixture mock.
			let artifactText: string | undefined;
			let artifactConfidence: number | undefined;
			if (!document.documentId.startsWith('mock-')) {
				try {
					const docService = createDocumentIntakeService({ db, env, user });
					const artifact = await docService.getDocumentArtifact({
						tenantId: state.tenantId,
						documentId: document.documentId
					});
					if (artifact?.textExtraction?.status === 'success') {
						artifactText = artifact.textExtraction.text;
						artifactConfidence = artifact.textExtraction.confidence;
					}
				} catch {
					// Treat as missing text; the capability will fall back.
				}
			}

			const result = await runFieldExtractionStep(
				{
					...document,
					text: artifactText,
					artifactConfidence
				},
				ctx
			);
			await auditCapabilitySuccess(db, state, user, 'finance.extract-invoice-fields', {
				confidence: result.confidence,
				usedRealText: Boolean(artifactText)
			});
			const next = await patchState(env.KV, state.id, {
				step: body.targetStep,
				dataPatch: { extraction: result }
			});
			return ok({ currentStep: next.step, state: next });
		}

		case 'matching': {
			const extraction = state.data.extraction as
				| { fields: ExtractedInvoiceFields }
				| undefined;
			if (!extraction) return fail('Workflow has no extracted fields yet', 400);
			const result = await runMatchingStep({ fields: extraction.fields }, ctx);
			for (const capabilityId of targetStepDef.allowedCapabilities) {
				await auditCapabilitySuccess(db, state, user, capabilityId, {
					supplierTop: result.supplierCandidates[0]?.id ?? null,
					poTop: result.poCandidates[0]?.id ?? null,
					duplicate: result.duplicate.isDuplicate
				});
			}
			const next = await patchState(env.KV, state.id, {
				step: body.targetStep,
				dataPatch: { matching: result }
			});
			return ok({ currentStep: next.step, state: next });
		}

		case 'user_confirmation': {
			const next = await patchState(env.KV, state.id, { step: body.targetStep });
			return ok({ currentStep: next.step, state: next });
		}

		// ---- financial-document-intake-only branches ----
		case 'bucket_selection': {
			const bucket = body.payload?.bucket;
			if (!bucket) return fail('payload.bucket is required for bucket_selection', 400);
			const result = await runBucketSelectionStep({ bucket });
			const next = await patchState(env.KV, state.id, {
				step: body.targetStep,
				dataPatch: { bucketSelection: result }
			});
			return ok({ currentStep: next.step, state: next });
		}

		case 'category_selection': {
			const categoryId =
				body.payload?.categoryId ??
				(state.data.selectedCategoryId as string | undefined);
			if (!categoryId) return fail('payload.categoryId is required for category_selection', 400);
			const result = await runCategorySelectionStep({ categoryId });
			const next = await patchState(env.KV, state.id, {
				step: body.targetStep,
				dataPatch: { categorySelection: { categoryId, category: result.category } }
			});
			return ok({ currentStep: next.step, state: next });
		}

		case 'field_extraction': {
			const document = state.data.document as DocumentIntakeOutput | undefined;
			if (!document) return fail('Workflow has no document context', 400);
			const categorySel = state.data.categorySelection as
				| { categoryId: string }
				| undefined;
			const categoryId = categorySel?.categoryId ?? findCategoryById('expense.sales_cost.invoice')?.id;

			let artifactText: string | undefined;
			let artifactConfidence: number | undefined;
			if (!document.documentId.startsWith('mock-')) {
				try {
					const docService = createDocumentIntakeService({ db, env, user });
					const artifact = await docService.getDocumentArtifact({
						tenantId: state.tenantId,
						documentId: document.documentId
					});
					if (artifact?.textExtraction?.status === 'success') {
						artifactText = artifact.textExtraction.text;
						artifactConfidence = artifact.textExtraction.confidence;
					}
				} catch {
					// Treat as missing text; the capability will fall back.
				}
			}

			const result = await runDocFieldExtractionStep(
				{
					...document,
					categoryId,
					text: artifactText,
					artifactConfidence
				},
				ctx
			);
			await auditCapabilitySuccess(db, state, user, 'finance.extract-document-fields', {
				confidence: result.confidence,
				categoryId,
				usedRealText: Boolean(artifactText)
			});
			const next = await patchState(env.KV, state.id, {
				step: body.targetStep,
				dataPatch: { extraction: result }
			});
			return ok({ currentStep: next.step, state: next });
		}

		case 'project_selection': {
			const projectId = body.payload?.projectId ?? null;
			const result = await runProjectSelectionStep({ projectId });
			const next = await patchState(env.KV, state.id, {
				step: body.targetStep,
				dataPatch: { projectSelection: result }
			});
			return ok({ currentStep: next.step, state: next });
		}

		// ---- allowance-recording-only branch ----
		case 'manual_entry': {
			const entry = body.payload?.allowanceEntry;
			if (!entry) return fail('payload.allowanceEntry is required for manual_entry', 400);
			const result = await runManualEntryStep(entry);
			const next = await patchState(env.KV, state.id, {
				step: body.targetStep,
				dataPatch: { allowanceEntry: result.entry, allowanceTotal: result.totalAmount }
			});
			return ok({ currentStep: next.step, state: next });
		}

		case 'record_creation':
		case 'completion':
			return fail(
				`Step ${body.targetStep} is not driven by /advance. Use /confirm.`,
				400
			);

		default:
			return fail(`Unsupported target step: ${body.targetStep}`, 400);
	}
};

