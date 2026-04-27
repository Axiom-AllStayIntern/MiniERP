export const financeWorkspaceEntries = [
	{ id: 'finance.workspace', route: '/dashboard', label: 'Finance Workspace' }
] as const;

export const financeDashboardCards = [
	'company-financial-overview',
	'dashboard-charts',
	'projects-profit-ranking'
] as const;

export const financeNavigationEntries = [
	'/finance/doc-hub',
	'/expenses',
	'/tax',
	'/dashboard'
] as const;

export const financeTaskModeEntries = [
	'finance-document-intake',
	'vendor-invoice-intake',
	'expense-recording'
] as const;

export const financeAppSurface = {
	workspaces: financeWorkspaceEntries,
	dashboardCards: financeDashboardCards,
	navigation: financeNavigationEntries,
	taskModeEntries: financeTaskModeEntries
};
