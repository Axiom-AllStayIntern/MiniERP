import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, 'src');
const ROUTES_DIR = path.join(ROOT, 'src', 'routes');
const AGENT_DIR = path.join(ROOT, 'src', 'lib', 'server', 'agent');
const FINANCE_TARGET_DIR = path.join(ROOT, 'src', 'modules', 'finance');
const EXTS = new Set(['.ts', '.js']);
const REPORT_ONLY = process.argv.includes('--report-only');

const ALLOWLIST_PATH = path.join(ROOT, 'scripts', 'modular-boundary-allowlist.txt');

async function readAllowlist() {
	const txt = await readFile(ALLOWLIST_PATH, 'utf8');
	return new Set(
		txt
			.split('\n')
			.map((line) => line.trim())
			.filter((line) => line && !line.startsWith('#'))
	);
}

function normalize(filePath) {
	return filePath.replace(/\\/g, '/');
}

function isRouteServerFile(filePath) {
	const normalized = normalize(filePath);
	return normalized.endsWith('+server.ts') || normalized.endsWith('+page.server.ts');
}

function isLayoutServerFile(filePath) {
	return normalize(filePath).endsWith('+layout.server.ts');
}

function isAnalyzedRouteFile(filePath) {
	return isRouteServerFile(filePath) || isLayoutServerFile(filePath);
}

async function walk(dir) {
	return walkFiltered(dir, () => true);
}

async function walkFiltered(dir, shouldInclude) {
	const entries = await readdir(dir, { withFileTypes: true });
	const files = [];
	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await walkFiltered(fullPath, shouldInclude)));
			continue;
		}
		if (!EXTS.has(path.extname(entry.name))) continue;
		if (!shouldInclude(fullPath)) continue;
		files.push(fullPath);
	}
	return files;
}

function rel(filePath) {
	return normalize(path.relative(ROOT, filePath));
}

function hasDirectDbImport(source) {
	return (
		source.includes("from '$lib/server/db'") ||
		source.includes('from "$lib/server/db"') ||
		source.includes("from '$lib/server/db/schema'") ||
		source.includes('from "$lib/server/db/schema"')
	);
}

function hasLegacyDbImport(source) {
	return (
		source.includes("from '$lib/server/modules/legacy-db'") ||
		source.includes('from "$lib/server/modules/legacy-db"')
	);
}

function hasModuleInternalImport(source) {
	return /from\s+['"]\$lib\/server\/modules\/[^'"]+\/(repository|service|schema|handlers|events)['"]/.test(
		source
	);
}

function hasDirectFinanceSubdomainApiImport(source) {
	return /from\s+['"]\$lib\/server\/modules\/(ar|expense|tax|reporting)\/api['"]/.test(source);
}

function hasDirectLegacyBusinessModuleApiImport(source) {
	return /from\s+['"]\$lib\/server\/modules\/(project|employee|person|document-intake)(?:\/api)?['"]/.test(
		source
	);
}

function isAnalyzedAgentFile(filePath) {
	const normalized = normalize(filePath);
	return normalized.includes('/src/lib/server/agent/') && normalized.endsWith('.ts');
}

const FINANCE_INTERNAL_PATH_FRAGMENTS = [
	'src/lib/server/modules/ar/',
	'src/lib/server/modules/expense/',
	'src/lib/server/modules/tax/',
	'src/lib/server/modules/reporting/',
	'src/lib/server/modules/finance/',
	'src/modules/finance/'
];

function isAnalyzedOtherSourceFile(filePath) {
	const normalized = normalize(filePath);
	if (!normalized.startsWith('src/')) return false;
	if (normalized.includes('/routes/')) return false;
	if (normalized.includes('/lib/server/agent/')) return false;
	return !FINANCE_INTERNAL_PATH_FRAGMENTS.some((fragment) => normalized.includes(fragment));
}

const FINANCE_TARGET_BRIDGE_FILES = new Set([
	'src/modules/finance/agent-actions.ts',
	'src/modules/finance/compat.ts',
	'src/modules/finance/contracts.ts',
	'src/modules/finance/adapters.ts'
]);

const PHASE4_TARGET_BRIDGE_FILES = new Set([
	'src/modules/project/contracts.ts',
	'src/modules/project/adapters.ts',
	'src/modules/hr/contracts.ts',
	'src/modules/hr/adapters.ts',
	'src/modules/hr/compat.ts',
	'src/modules/document-intake/contracts.ts',
	'src/modules/document-intake/adapters.ts'
]);

const LEGACY_RUNTIME_SHIM_FILES = new Set([
	'src/lib/server/modules/registry.ts',
	'src/lib/server/modules/context.ts',
	'src/lib/server/modules/event-bus.ts',
	'src/lib/server/modules/enabled.ts',
	'src/lib/server/modules/legacy-db.ts',
	'src/lib/server/db/index.ts',
	'src/lib/server/db/schema.ts'
]);

const LEGACY_DB_COMPATIBILITY_BRIDGE_FILES = new Set([
	'src/infrastructure/db/index.ts',
	'src/lib/server/modules/legacy-db.ts',
	'src/lib/server/db/schema.ts'
]);

const LEGACY_MODULE_BOOTSTRAP_SHIM_FILES = new Set(['src/lib/server/modules/register-all.ts']);

const LEGACY_BUSINESS_COMPATIBILITY_DIRS = [
	'src/lib/server/modules/finance/',
	'src/lib/server/modules/project/',
	'src/lib/server/modules/hr/',
	'src/lib/server/modules/employee/',
	'src/lib/server/modules/person/',
	'src/lib/server/modules/document-intake/'
];

const DEPRECATED_SERVER_SHIM_FILES = new Set([
	'src/lib/server/audit.ts',
	'src/lib/server/project-expense-sums.ts',
	'src/lib/server/singapore-resident-tax-estimate.ts',
	'src/lib/server/project-staff-cost.ts',
	'src/lib/server/settle-project-components.ts',
	'src/lib/server/company-allocation-settle.ts'
]);

function isAnalyzedFinanceTargetFile(filePath) {
	const normalized = normalize(filePath);
	if (!normalized.startsWith('src/modules/finance/')) return false;
	if (!normalized.endsWith('.ts')) return false;
	return !FINANCE_TARGET_BRIDGE_FILES.has(normalized);
}

function isAnalyzedLegacyRuntimeCallerFile(filePath) {
	const normalized = normalize(filePath);
	if (!normalized.startsWith('src/')) return false;
	if (!normalized.endsWith('.ts') && !normalized.endsWith('.js')) return false;
	return !LEGACY_RUNTIME_SHIM_FILES.has(normalized);
}

function isAnalyzedLegacyDbCompatibilityCallerFile(filePath) {
	const normalized = normalize(filePath);
	if (!normalized.startsWith('src/')) return false;
	if (!normalized.endsWith('.ts') && !normalized.endsWith('.js')) return false;
	return !LEGACY_DB_COMPATIBILITY_BRIDGE_FILES.has(normalized);
}

function isAnalyzedLegacyModuleBootstrapCallerFile(filePath) {
	const normalized = normalize(filePath);
	if (!normalized.startsWith('src/')) return false;
	if (!normalized.endsWith('.ts') && !normalized.endsWith('.js')) return false;
	return !LEGACY_MODULE_BOOTSTRAP_SHIM_FILES.has(normalized);
}

function isAnalyzedLegacyBusinessCompatibilityCallerFile(filePath) {
	const normalized = normalize(filePath);
	if (!normalized.startsWith('src/')) return false;
	if (!normalized.endsWith('.ts') && !normalized.endsWith('.js')) return false;
	if (DEPRECATED_SERVER_SHIM_FILES.has(normalized)) return false;
	return !LEGACY_BUSINESS_COMPATIBILITY_DIRS.some((prefix) => normalized.startsWith(prefix));
}

function isAnalyzedDeprecatedServerShimCallerFile(filePath) {
	const normalized = normalize(filePath);
	if (!normalized.startsWith('src/')) return false;
	if (!normalized.endsWith('.ts') && !normalized.endsWith('.js')) return false;
	return !DEPRECATED_SERVER_SHIM_FILES.has(normalized);
}

function isAnalyzedPhase4TargetFile(filePath) {
	const normalized = normalize(filePath);
	if (
		!normalized.startsWith('src/modules/project/') &&
		!normalized.startsWith('src/modules/hr/') &&
		!normalized.startsWith('src/modules/document-intake/')
	) {
		return false;
	}
	if (!normalized.endsWith('.ts')) return false;
	return !PHASE4_TARGET_BRIDGE_FILES.has(normalized);
}

function isAnalyzedPhase5TargetFile(filePath) {
	const normalized = normalize(filePath);
	if (
		!normalized.startsWith('src/modules/project/') &&
		!normalized.startsWith('src/modules/hr/') &&
		!normalized.startsWith('src/modules/document-intake/')
	) {
		return false;
	}
	return normalized.endsWith('.ts');
}

function hasDirectFinanceSubdomainAgentImport(source) {
	return /from\s+['"]\$lib\/server\/modules\/(ar|expense|tax|reporting)(?:\/api)?['"]/.test(source);
}

function hasDirectFinanceSubdomainImport(source) {
	return /from\s+['"]\$lib\/server\/modules\/(ar|expense|tax|reporting)(?:\/[^'"]*)?['"]/.test(source);
}

function hasLegacyRuntimeEntrypointImport(source) {
	const compact = source.replace(/\s+/g, ' ');
	return (
		/(?:import|export)\s+[^;]+from\s+['"]\$lib\/server\/modules\/(registry|context|event-bus|enabled)['"]/.test(
			compact
		) ||
		/(?:import|export)\s+[^;]+from\s+['"]\$lib\/server\/db['"]/.test(compact)
	);
}

function hasLegacyDbCompatibilityImport(source) {
	const compact = source.replace(/\s+/g, ' ');
	return (
		/(?:import|export)\s+[^;]+from\s+['"]\$lib\/server\/modules\/legacy-db['"]/.test(compact) ||
		/(?:import|export)\s+[^;]+from\s+['"]\$lib\/server\/db\/schema['"]/.test(compact)
	);
}

function hasLegacyModuleBootstrapImport(source) {
	const compact = source.replace(/\s+/g, ' ');
	return (
		/import\s+['"]\$lib\/server\/modules\/register-all['"]/.test(compact) ||
		/import\s+['"]\.\/lib\/server\/modules\/register-all['"]/.test(compact)
	);
}

function hasLegacyBusinessCompatibilityImport(source) {
	const compact = source.replace(/\s+/g, ' ');
	return (
		/(?:import|export)\s+[^;]+from\s+['"]\$lib\/server\/modules\/(finance|project|hr|document-intake|employee|person)(?:\/(api|compat))?['"]/.test(
			compact
		) ||
		/import\s+['"]\$lib\/server\/modules\/(finance|project|hr|document-intake|employee|person)(?:\/(api|compat))?['"]/.test(
			compact
		)
	);
}

function hasDeprecatedServerShimImport(source) {
	const compact = source.replace(/\s+/g, ' ');
	return /(?:import|export)\s+[^;]+from\s+['"]\$lib\/server\/(audit|project-expense-sums|singapore-resident-tax-estimate|project-staff-cost|settle-project-components|company-allocation-settle)['"]/.test(
		compact
	);
}

function hasPhase4TargetLegacyImport(source) {
	return /from\s+['"][^'"]*lib\/server\/modules\/(project|employee|person|document-intake)\//.test(source);
}

function hasPhase5TargetLegacyHandlerImport(source) {
	return /from\s+['"][^'"]*lib\/server\/modules\/(project|employee|person|document-intake)\/handlers['"]/.test(
		source
	);
}

function printList(title, files) {
	console.log(`${title}: ${files.length}`);
	for (const file of files) {
		console.log(` - ${file}`);
	}
}

async function collectReport(
	routeFiles,
	agentFiles,
	otherFiles,
	financeTargetFiles,
	legacyRuntimeCallerFiles,
	legacyDbCompatibilityCallerFiles,
	legacyModuleBootstrapCallerFiles,
	legacyBusinessCompatibilityCallerFiles,
	deprecatedServerShimCallerFiles,
	phase4TargetFiles,
	phase5TargetFiles
) {
	const report = {
		hardGateDirectRouteDbImports: [],
		legacyRouteDbBridgeImports: [],
		routeInternalModuleImports: [],
		routeDirectFinanceSubdomainApiImports: [],
		routeDirectLegacyBusinessModuleApiImports: [],
		agentDirectFinanceSubdomainImports: [],
		otherDirectFinanceSubdomainImports: [],
		financeTargetNonBridgeLegacyImports: [],
		phase4TargetNonBridgeLegacyImports: [],
		phase5TargetLegacyHandlerImports: [],
		legacyRuntimeEntrypointImports: [],
		legacyDbCompatibilityImports: [],
		legacyModuleBootstrapImports: [],
		legacyBusinessCompatibilityImports: [],
		deprecatedServerShimImports: [],
		layoutDirectDbImports: [],
		layoutLegacyDbBridgeImports: []
	};

	for (const file of routeFiles) {
		const relative = rel(file);
		const source = await readFile(file, 'utf8');
		const routeServer = isRouteServerFile(file);
		const layoutServer = isLayoutServerFile(file);

		if (routeServer && hasDirectDbImport(source)) {
			report.hardGateDirectRouteDbImports.push(relative);
		}
		if (routeServer && hasLegacyDbImport(source)) {
			report.legacyRouteDbBridgeImports.push(relative);
		}
		if (routeServer && hasModuleInternalImport(source)) {
			report.routeInternalModuleImports.push(relative);
		}
		if (routeServer && hasDirectFinanceSubdomainApiImport(source)) {
			report.routeDirectFinanceSubdomainApiImports.push(relative);
		}
		if (isAnalyzedRouteFile(file) && hasDirectLegacyBusinessModuleApiImport(source)) {
			report.routeDirectLegacyBusinessModuleApiImports.push(relative);
		}
		if (layoutServer && hasDirectDbImport(source)) {
			report.layoutDirectDbImports.push(relative);
		}
		if (layoutServer && hasLegacyDbImport(source)) {
			report.layoutLegacyDbBridgeImports.push(relative);
		}
	}

	for (const file of agentFiles) {
		const relative = rel(file);
		const source = await readFile(file, 'utf8');

		if (hasDirectFinanceSubdomainAgentImport(source)) {
			report.agentDirectFinanceSubdomainImports.push(relative);
		}
	}

	for (const file of otherFiles) {
		const relative = rel(file);
		const source = await readFile(file, 'utf8');

		if (hasDirectFinanceSubdomainImport(source)) {
			report.otherDirectFinanceSubdomainImports.push(relative);
		}
	}

	for (const file of financeTargetFiles) {
		const relative = rel(file);
		const source = await readFile(file, 'utf8');

		if (hasDirectFinanceSubdomainImport(source)) {
			report.financeTargetNonBridgeLegacyImports.push(relative);
		}
	}

	for (const file of phase4TargetFiles) {
		const relative = rel(file);
		const source = await readFile(file, 'utf8');

		if (hasPhase4TargetLegacyImport(source)) {
			report.phase4TargetNonBridgeLegacyImports.push(relative);
		}
	}

	for (const file of phase5TargetFiles) {
		const relative = rel(file);
		const source = await readFile(file, 'utf8');

		if (hasPhase5TargetLegacyHandlerImport(source)) {
			report.phase5TargetLegacyHandlerImports.push(relative);
		}
	}

	for (const file of legacyRuntimeCallerFiles) {
		const relative = rel(file);
		const source = await readFile(file, 'utf8');

		if (hasLegacyRuntimeEntrypointImport(source)) {
			report.legacyRuntimeEntrypointImports.push(relative);
		}
	}

	for (const file of legacyDbCompatibilityCallerFiles) {
		const relative = rel(file);
		const source = await readFile(file, 'utf8');

		if (hasLegacyDbCompatibilityImport(source)) {
			report.legacyDbCompatibilityImports.push(relative);
		}
	}

	for (const file of legacyModuleBootstrapCallerFiles) {
		const relative = rel(file);
		const source = await readFile(file, 'utf8');

		if (hasLegacyModuleBootstrapImport(source)) {
			report.legacyModuleBootstrapImports.push(relative);
		}
	}

	for (const file of legacyBusinessCompatibilityCallerFiles) {
		const relative = rel(file);
		const source = await readFile(file, 'utf8');

		if (hasLegacyBusinessCompatibilityImport(source)) {
			report.legacyBusinessCompatibilityImports.push(relative);
		}
	}

	for (const file of deprecatedServerShimCallerFiles) {
		const relative = rel(file);
		const source = await readFile(file, 'utf8');

		if (hasDeprecatedServerShimImport(source)) {
			report.deprecatedServerShimImports.push(relative);
		}
	}

	return report;
}

async function runReport(
	routeFiles,
	agentFiles,
	otherFiles,
	financeTargetFiles,
	legacyRuntimeCallerFiles,
	legacyDbCompatibilityCallerFiles,
	legacyModuleBootstrapCallerFiles,
	legacyBusinessCompatibilityCallerFiles,
	deprecatedServerShimCallerFiles,
	phase4TargetFiles,
	phase5TargetFiles
) {
	const report = await collectReport(
		routeFiles,
		agentFiles,
		otherFiles,
		financeTargetFiles,
		legacyRuntimeCallerFiles,
		legacyDbCompatibilityCallerFiles,
		legacyModuleBootstrapCallerFiles,
		legacyBusinessCompatibilityCallerFiles,
		deprecatedServerShimCallerFiles,
		phase4TargetFiles,
		phase5TargetFiles
	);
	console.log('Architecture boundary report');
	printList('Hard-gated direct route DB imports', report.hardGateDirectRouteDbImports);
	printList('Legacy route DB bridge imports', report.legacyRouteDbBridgeImports);
	printList('Route imports of module internals', report.routeInternalModuleImports);
	printList('Route direct Finance subdomain API imports', report.routeDirectFinanceSubdomainApiImports);
	printList(
		'Route direct Project/HR/Document Intake legacy API imports',
		report.routeDirectLegacyBusinessModuleApiImports
	);
	printList('Agent direct Finance subdomain imports', report.agentDirectFinanceSubdomainImports);
	printList('Other direct Finance subdomain imports', report.otherDirectFinanceSubdomainImports);
	printList('Finance target non-bridge legacy imports', report.financeTargetNonBridgeLegacyImports);
	printList('Phase 4 target non-bridge legacy imports', report.phase4TargetNonBridgeLegacyImports);
	printList('Phase 5 target legacy handler imports', report.phase5TargetLegacyHandlerImports);
	printList('Legacy runtime entrypoint imports', report.legacyRuntimeEntrypointImports);
	printList('Legacy DB compatibility imports', report.legacyDbCompatibilityImports);
	printList('Legacy module bootstrap imports', report.legacyModuleBootstrapImports);
	printList(
		'Legacy business compatibility entrypoint imports',
		report.legacyBusinessCompatibilityImports
	);
	printList('Deprecated server shim imports', report.deprecatedServerShimImports);
	printList('Layout direct DB imports', report.layoutDirectDbImports);
	printList('Layout legacy DB bridge imports', report.layoutLegacyDbBridgeImports);
}

async function runHardGate(routeFiles) {
	const allowlist = await readAllowlist();
	const offenders = [];

	for (const file of routeFiles.filter(isRouteServerFile)) {
		const relative = rel(file);
		const source = await readFile(file, 'utf8');
		if (!hasDirectDbImport(source)) continue;
		if (allowlist.has(relative)) continue;
		offenders.push(relative);
	}

	if (offenders.length > 0) {
		console.error('Modular boundary check failed.');
		console.error("Do not import '$lib/server/db' in route server files.");
		console.error('Offending files:');
		for (const file of offenders) {
			console.error(` - ${file}`);
		}
		process.exit(1);
	}

	console.log('Modular boundary check passed.');
}

async function main() {
	const routeFiles = await walkFiltered(ROUTES_DIR, isAnalyzedRouteFile);
	const agentFiles = await walkFiltered(AGENT_DIR, isAnalyzedAgentFile);
	const otherFiles = await walkFiltered(SRC_DIR, (filePath) => isAnalyzedOtherSourceFile(rel(filePath)));
	const financeTargetFiles = await walkFiltered(FINANCE_TARGET_DIR, (filePath) =>
		isAnalyzedFinanceTargetFile(rel(filePath))
	);
	const legacyRuntimeCallerFiles = await walkFiltered(SRC_DIR, (filePath) =>
		isAnalyzedLegacyRuntimeCallerFile(rel(filePath))
	);
	const legacyDbCompatibilityCallerFiles = await walkFiltered(SRC_DIR, (filePath) =>
		isAnalyzedLegacyDbCompatibilityCallerFile(rel(filePath))
	);
	const legacyModuleBootstrapCallerFiles = await walkFiltered(SRC_DIR, (filePath) =>
		isAnalyzedLegacyModuleBootstrapCallerFile(rel(filePath))
	);
	const legacyBusinessCompatibilityCallerFiles = await walkFiltered(SRC_DIR, (filePath) =>
		isAnalyzedLegacyBusinessCompatibilityCallerFile(rel(filePath))
	);
	const deprecatedServerShimCallerFiles = await walkFiltered(SRC_DIR, (filePath) =>
		isAnalyzedDeprecatedServerShimCallerFile(rel(filePath))
	);
	const phase4TargetFiles = await walkFiltered(SRC_DIR, (filePath) =>
		isAnalyzedPhase4TargetFile(rel(filePath))
	);
	const phase5TargetFiles = await walkFiltered(SRC_DIR, (filePath) =>
		isAnalyzedPhase5TargetFile(rel(filePath))
	);
	if (REPORT_ONLY) {
		await runReport(
			routeFiles,
			agentFiles,
			otherFiles,
			financeTargetFiles,
			legacyRuntimeCallerFiles,
			legacyDbCompatibilityCallerFiles,
			legacyModuleBootstrapCallerFiles,
			legacyBusinessCompatibilityCallerFiles,
			deprecatedServerShimCallerFiles,
			phase4TargetFiles,
			phase5TargetFiles
		);
		return;
	}

	await runHardGate(routeFiles);
}

main().catch((err) => {
	console.error('Failed to run modular boundary check:', err);
	process.exit(1);
});
