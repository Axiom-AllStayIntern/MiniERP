import { validateExpenseDraftCapability } from '../../../capabilities/validate-expense-draft';
import type { FinanceCapabilityContext } from '../../../capabilities/types';
import type { FinanceValidationIssue } from '../../../agent/types';
import type { ConfirmationDraft } from '../schemas';

export interface ValidateStepOutput {
	ok: boolean;
	issues: FinanceValidationIssue[];
	draft: ConfirmationDraft;
}

function toExpensePayload(draft: ConfirmationDraft) {
	return {
		projectId: draft.projectId,
		amount: draft.fields.totalAmount,
		currency: draft.fields.currency,
		date: draft.fields.issueDate,
		expenseType: 'opex' as const
	};
}

export async function runValidationStep(
	input: ConfirmationDraft,
	ctx: FinanceCapabilityContext
): Promise<ValidateStepOutput> {
	const result = await validateExpenseDraftCapability.execute(toExpensePayload(input), ctx);
	return { ok: result.ok, issues: result.issues, draft: input };
}
