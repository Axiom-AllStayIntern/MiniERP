import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	// All active schema sources (post Wave 0 snapshot reconciliation):
	// - legacy/server-modules/<m>/schema.ts (ar, business-partner, core, employee,
	//   expense, person, project, tax) — moved into target modules across Wave 1
	// - target module repository schemas (document-intake/repositories/*.schema.ts;
	//   future target modules add their own schemas here as Wave 1 progresses)
	// - platform/auth/auth-tables.ts (sessions, accounts, verifications)
	//
	// The historical 0000–0025 SQL migrations were archived to
	// drizzle/migrations.archive-pre-v4/ when the meta snapshot chain was rebuilt
	// from these schema files (see ref_files/v4/SmartFin_Migration_Plan.md
	// Wave 0 follow-up #1).
	schema: [
		'./src/modules/**/schema.ts',
		'./src/modules/**/repositories/*.schema.ts',
		'./src/platform/**/*.schema.ts',
		'./src/platform/auth/auth-tables.ts',
		'./src/infrastructure/**/*.schema.ts'
	],
	out: './drizzle/migrations',
	dialect: 'sqlite',
	driver: 'd1-http',
	dbCredentials: {
		accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? 'replace-me',
		databaseId: process.env.CLOUDFLARE_D1_DATABASE_ID ?? 'replace-me',
		token: process.env.CLOUDFLARE_API_TOKEN ?? 'replace-me'
	}
});
