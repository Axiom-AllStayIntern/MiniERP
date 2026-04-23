import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const ROUTES_DIR = path.join(ROOT, 'src', 'routes');
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
	const entries = await readdir(dir, { withFileTypes: true });
	const files = [];
	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await walk(fullPath)));
			continue;
		}
		if (!EXTS.has(path.extname(entry.name))) continue;
		if (!isAnalyzedRouteFile(fullPath)) continue;
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

function printList(title, files) {
	console.log(`${title}: ${files.length}`);
	for (const file of files) {
		console.log(` - ${file}`);
	}
}

async function collectReport(files) {
	const report = {
		hardGateDirectRouteDbImports: [],
		legacyRouteDbBridgeImports: [],
		routeInternalModuleImports: [],
		layoutDirectDbImports: [],
		layoutLegacyDbBridgeImports: []
	};

	for (const file of files) {
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
		if (layoutServer && hasDirectDbImport(source)) {
			report.layoutDirectDbImports.push(relative);
		}
		if (layoutServer && hasLegacyDbImport(source)) {
			report.layoutLegacyDbBridgeImports.push(relative);
		}
	}

	return report;
}

async function runReport(files) {
	const report = await collectReport(files);
	console.log('Architecture boundary report');
	printList('Hard-gated direct route DB imports', report.hardGateDirectRouteDbImports);
	printList('Legacy route DB bridge imports', report.legacyRouteDbBridgeImports);
	printList('Route imports of module internals', report.routeInternalModuleImports);
	printList('Layout direct DB imports', report.layoutDirectDbImports);
	printList('Layout legacy DB bridge imports', report.layoutLegacyDbBridgeImports);
}

async function runHardGate(files) {
	const allowlist = await readAllowlist();
	const offenders = [];

	for (const file of files.filter(isRouteServerFile)) {
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
	const files = await walk(ROUTES_DIR);
	if (REPORT_ONLY) {
		await runReport(files);
		return;
	}

	await runHardGate(files);
}

main().catch((err) => {
	console.error('Failed to run modular boundary check:', err);
	process.exit(1);
});
