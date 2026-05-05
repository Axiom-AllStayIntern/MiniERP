import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	// NOTE (Wave 0.1, narrow): ghost globs pointing at the deleted `src/lib/server/*`
	// paths have been removed. Broadening this list to cover legacy/<module>/schema.ts
	// and platform/auth/auth-tables.ts is the correct end-state, but doing so today
	// would surface a stale drizzle-kit snapshot vs. real DB and force interactive
	// table-rename prompts on `db:generate`. Snapshot reconciliation is a separate
	// follow-up; until then, drizzle-kit only sees target-layer repository schemas.
	schema: ['./src/modules/*/repositories/*.schema.ts'],
	out: './drizzle/migrations',
	dialect: 'sqlite',
	driver: 'd1-http',
	dbCredentials: {
		accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? 'replace-me',
		databaseId: process.env.CLOUDFLARE_D1_DATABASE_ID ?? 'replace-me',
		token: process.env.CLOUDFLARE_API_TOKEN ?? 'replace-me'
	}
});
