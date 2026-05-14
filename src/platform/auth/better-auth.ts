import { getRequestEvent } from '$app/server';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';

import { getDb, schema } from '../../infrastructure/db';

import { sendTransactionalEmail } from './email';
import { authRoleSchema } from './config';

const authSchema = {
	user: schema.users,
	session: schema.sessions,
	account: schema.accounts,
	verification: schema.verifications
};

let cached: ReturnType<typeof betterAuth> | null = null;
let cachedDbTag: string | null = null;

function dbTag(env: Env): string {
	const s = env.BETTER_AUTH_SECRET ?? '';
	const u = env.BETTER_AUTH_URL ?? '';
	return `${s}:${u}`;
}

export function getAuth(env: Env): ReturnType<typeof betterAuth> {
	if (!env.BETTER_AUTH_SECRET || !env.BETTER_AUTH_URL) {
		throw new Error('getAuth: BETTER_AUTH_SECRET and BETTER_AUTH_URL are required');
	}
	const tag = dbTag(env);
	if (cached && cachedDbTag === tag) return cached;
	cachedDbTag = tag;
	const db = getDb(env);
	const baseURL = env.BETTER_AUTH_URL.replace(/\/$/, '');
	cached = betterAuth({
		secret: env.BETTER_AUTH_SECRET,
		baseURL,
		trustedOrigins: [new URL(baseURL).origin],
		database: drizzleAdapter(db, {
			provider: 'sqlite',
			schema: authSchema
		}),
		emailAndPassword: {
			enabled: true,
			requireEmailVerification: false,
			autoSignIn: true,
			sendResetPassword: async ({ user, url }) => {
				await sendTransactionalEmail(env, {
					to: user.email,
					subject: 'Reset your SmartFin password',
					text: `Open this link to reset your password (link expires soon):\n${url}\n\nIf you did not request this, you can ignore this email.`,
					html: `<p>Reset your password:</p><p><a href="${url}">Click here</a></p><p>If you did not request this, ignore this email.</p>`
				});
			},
			onExistingUserSignUp: async ({ user }) => {
				await sendTransactionalEmail(env, {
					to: user.email,
					subject: 'SmartFin sign-up attempt',
					text: 'Someone tried to create an account with this email. If it was you, sign in instead. If not, you can ignore this message.',
					html: '<p>Someone tried to create an account with this email. If it was you, <strong>sign in</strong> instead.</p>'
				});
			},
			customSyntheticUser: ({ coreFields, id }) => ({
				...coreFields,
				role: 'owner',
				id
			})
		},
		emailVerification: {
			sendVerificationEmail: async ({ user, url }) => {
				await sendTransactionalEmail(env, {
					to: user.email,
					subject: 'Verify your SmartFin email',
					text: `Verify your email to activate your account:\n${url}\n\nThis link expires after a short time.`,
					html: `<p>Please verify your email to activate your SmartFin account.</p><p><a href="${url}">Verify email</a></p>`
				});
			}
		},
		user: {
			additionalFields: {
				role: {
					type: 'string',
					required: false,
					defaultValue: 'owner',
					input: true,
					validator: {
						input: authRoleSchema
					}
				}
			}
		},
		plugins: [sveltekitCookies(getRequestEvent)]
	}) as unknown as ReturnType<typeof betterAuth>;
	return cached!;
}
