export const ROLE_OWNER = 'owner';
export const ROLE_FINANCE = 'finance';
export const ROLE_PROJECT_MANAGER = 'project_manager';
export const ROLE_EMPLOYEE = 'employee';

export const ROLES = [ROLE_OWNER, ROLE_FINANCE, ROLE_PROJECT_MANAGER, ROLE_EMPLOYEE] as const;

export type Role = (typeof ROLES)[number];
