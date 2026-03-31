import { z } from 'zod';

export const authRoles = ['owner', 'finance', 'project_manager', 'employee'] as const;

export const authEnvSchema = z.object({
	BETTER_AUTH_SECRET: z.string().min(1),
	BETTER_AUTH_URL: z.string().url()
});

export type AuthRole = (typeof authRoles)[number];
