export const EXPENSE_EVENTS = {
	EXPENSE_CREATED: 'expense.created',
	EXPENSE_DELETED: 'expense.deleted'
} as const;

export type ExpenseCreatedPayload = {
	expenseId: string;
	projectId: string | null | undefined;
	amount: number;
	expenseType: string;
};

export type ExpenseDeletedPayload = {
	expenseId: string;
	projectId: string | null | undefined;
};
