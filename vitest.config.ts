import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import { resolve } from 'path';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
	resolve: {
		alias: {
			$infrastructure: resolve(__dirname, 'src/infrastructure'),
			$modules: resolve(__dirname, 'src/modules'),
			$platform: resolve(__dirname, 'src/platform'),
			'$app-layer': resolve(__dirname, 'src/app')
		}
	},
	test: {
		globals: true,
		environment: 'node',
		include: ['src/**/*.test.ts'],
		exclude: ['src/**/*.integration.test.ts', 'node_modules/**'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'html'],
			include: [
				'src/modules/finance/**/*.ts',
				'src/platform/files/**/*.ts',
				'src/platform/workflow/**/*.ts'
			],
			thresholds: {
				statements: 65
			}
		}
	}
});
