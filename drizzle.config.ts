import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	schema: [
		'./src/lib/server/modules/*/schema.ts',
		'./src/lib/server/modules/schema-helpers.ts',
		'./src/modules/*/repositories/*.schema.ts'
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
