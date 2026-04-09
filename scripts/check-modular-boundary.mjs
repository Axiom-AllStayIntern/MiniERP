import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const ROUTES_DIR = path.join(ROOT, 'src', 'routes');
const EXTS = new Set(['.ts', '.js']);

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

function isRouteServerFile(filePath) {
	const normalized = filePath.replace(/\\/g, '/');
	return normalized.endsWith('+server.ts') || normalized.endsWith('+page.server.ts');
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
		if (!isRouteServerFile(fullPath)) continue;
		files.push(fullPath);
	}
	return files;
}

function rel(filePath) {
	return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

function hasForbiddenImport(source) {
	return (
		source.includes("from '$lib/server/db'") ||
		source.includes('from "$lib/server/db"') ||
		source.includes("from '$lib/server/db/schema'") ||
		source.includes('from "$lib/server/db/schema"')
	);
}

async function main() {
	const files = await walk(ROUTES_DIR);
	const allowlist = await readAllowlist();
	const offenders = [];

	for (const file of files) {
		const relative = rel(file);
		const source = await readFile(file, 'utf8');
		if (!hasForbiddenImport(source)) continue;
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

main().catch((err) => {
	console.error('Failed to run modular boundary check:', err);
	process.exit(1);
});
