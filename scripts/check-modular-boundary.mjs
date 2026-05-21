/**
 * Modular boundary linter — v4 final form (Wave 3.7 cleanup).
 *
 * Enforces the v4 layer rules from
 * ref_files/v4/SmartFin_Modular_Design_Principles.md §2 and §4:
 *
 *   1. Route handlers (+server.ts, +page.server.ts) must not import
 *      `$infrastructure/db` directly — they go through module APIs
 *      (createModuleContext + createXApi). Aggregations belong in
 *      services/repositories, not routes.
 *
 *   2. Modules must import each other only via the public package barrel
 *      (e.g. `$modules/finance`, never `$modules/finance/services/foo`).
 *
 *   3. Platform code must not import modules. Platform is the substrate
 *      modules sit on; the dependency arrow only points module → platform.
 *
 * Allowlist: `scripts/modular-boundary-allowlist.txt` (one normalized
 * relative path per line, # for comments) suppresses individual violations
 * during transitional cleanups.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, 'src');
const ALLOWLIST_PATH = path.join(ROOT, 'scripts', 'modular-boundary-allowlist.txt');
const REPORT_ONLY = process.argv.includes('--report-only');
const EXTS = new Set(['.ts', '.svelte']);

function normalize(filePath) {
	return filePath.replace(/\\/g, '/');
}

async function readAllowlist() {
	try {
		const txt = await readFile(ALLOWLIST_PATH, 'utf8');
		return new Set(
			txt
				.split('\n')
				.map((line) => line.trim())
				.filter((line) => line && !line.startsWith('#'))
		);
	} catch {
		return new Set();
	}
}

async function* walk(dir) {
	const entries = await readdir(dir, { withFileTypes: true });
	for (const entry of entries) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			if (entry.name === 'node_modules' || entry.name === '.svelte-kit') continue;
			yield* walk(full);
		} else if (EXTS.has(path.extname(entry.name))) {
			yield full;
		}
	}
}

function isRouteHandler(filePath) {
	const n = normalize(filePath);
	return n.endsWith('/+server.ts') || n.endsWith('/+page.server.ts');
}

function inPath(filePath, segment) {
	return normalize(filePath).includes(`/${segment}/`);
}

function relativeToRoot(filePath) {
	return normalize(path.relative(ROOT, filePath));
}

const IMPORT_RE = /from\s+['"]([^'"]+)['"]/g;

async function check() {
	const allowlist = await readAllowlist();
	const violations = [];

	for await (const file of walk(SRC_DIR)) {
		const rel = relativeToRoot(file);
		if (allowlist.has(rel)) continue;
		const text = await readFile(file, 'utf8');

		for (const match of text.matchAll(IMPORT_RE)) {
			const spec = match[1];

			// Rule 1: route handlers must not import $infrastructure/db.
			if (isRouteHandler(file) && spec.startsWith('$infrastructure/db')) {
				violations.push({
					rule: 'route-no-direct-db',
					file: rel,
					import: spec,
					detail:
						'Routes must reach DB via module APIs (createXApi(ctx)), not $infrastructure/db.'
				});
			}

			// Rule 2: cross-module deep imports.
			// Allowed: `$modules/<x>` (barrel). Also allowed across modules:
			//   - `$modules/<x>/repositories/*.schema` (drizzle FK references must
			//     point at concrete table objects)
			//   - the schema barrel at src/infrastructure/db/schema.ts (intentional
			//     re-export point)
			// Forbidden: any other `$modules/<x>/<deep>` from outside that module
			// (app layer is exempt — it composes module surfaces).
			if (spec.startsWith('$modules/')) {
				const parts = spec.split('/');
				if (parts.length > 2) {
					const targetModule = parts[1];
					const isSchemaImport = spec.endsWith('.schema') || spec.includes('.schema.');
					const isInfrastructureBarrel = rel === 'src/infrastructure/db/schema.ts';
					const importerModule = inPath(file, 'modules')
						? normalize(file).split('/modules/')[1]?.split('/')[0]
						: null;
					const sameModule = importerModule === targetModule;
					const appLayer = rel.startsWith('src/app/');
					const isTestFile = rel.startsWith('src/test/');
					const exempt = sameModule || appLayer || isInfrastructureBarrel || isSchemaImport || isTestFile;
					if (!exempt) {
						violations.push({
							rule: 'cross-module-deep-import',
							file: rel,
							import: spec,
							detail: `Import from $modules/${targetModule} barrel only, not internals.`
						});
					}
				}
			}

			// Rule 3: platform must not import modules.
			if (rel.startsWith('src/platform/') && spec.startsWith('$modules/')) {
				violations.push({
					rule: 'platform-imports-module',
					file: rel,
					import: spec,
					detail: 'Platform is the substrate; only modules → platform, never the reverse.'
				});
			}
		}
	}

	if (violations.length === 0) {
		console.log('Modular boundary check passed.');
		return;
	}

	console.log(`Modular boundary check found ${violations.length} violation(s):\n`);
	for (const v of violations) {
		console.log(`  [${v.rule}] ${v.file}`);
		console.log(`    -> import "${v.import}"`);
		console.log(`    ${v.detail}\n`);
	}

	if (!REPORT_ONLY) {
		process.exitCode = 1;
	}
}

check().catch((err) => {
	console.error('Modular boundary check failed to run:', err);
	process.exit(2);
});
