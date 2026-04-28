import { validateExpenseRecord } from '../../rules/validate-expense';
import type { FinanceValidationIssue } from '../../agent/types';
import type { FinanceCapability } from '../types';

export type ValidateExpenseDraftInput = unknown;

export interface ValidateExpenseDraftOutput {
	ok: boolean;
	issues: FinanceValidationIssue[];
}

export const validateExpenseDraftCapability: FinanceCapability<
	ValidateExpenseDraftInput,
	ValidateExpenseDraftOutput
> = {
	id: 'finance.validate-expense-draft',
	description: 'Validate an expense draft against the deterministic finance schema.',
	riskLevel: 'R2',

	async execute(input) {
		const result = validateExpenseRecord(input);
		if (result.success) {
			return { ok: true, issues: [] };
		}
		const issues: FinanceValidationIssue[] = result.error.issues.map((issue) => ({
			field: issue.path.join('.') || '<root>',
			message: issue.message,
			code: issue.code
		}));
		return { ok: false, issues };
	}
};
