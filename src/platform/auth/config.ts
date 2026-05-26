import { z } from 'zod';

export const authRoles = [
	'owner',
	'admin',
	'finance',
	'project_manager',
	'hr',
	'staff',
	'employee'
] as const;
export const authRoleSchema = z.enum(authRoles);

export const authEnvSchema = z.object({
	BETTER_AUTH_SECRET: z.string().min(1),
	BETTER_AUTH_URL: z.string().url(),
	RESEND_API_KEY: z.string().min(1).optional(),
	EMAIL_FROM: z.string().min(1).optional()
});

export type AuthRole = (typeof authRoles)[number];

export function parseRoles(raw: string | null | undefined): AuthRole[] {
	if (!raw) return ['employee'];
	try {
		const parsed = JSON.parse(raw);
		if (Array.isArray(parsed)) {
			const valid = parsed.filter((r): r is AuthRole => authRoles.includes(r as AuthRole));
			return valid.length > 0 ? valid : ['employee'];
		}
	} catch {
		// not JSON — legacy bare string
	}
	if (authRoles.includes(raw as AuthRole)) return [raw as AuthRole];
	return ['employee'];
}
