// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	interface Env {
		DB: D1Database;
		R2: R2Bucket;
		KV: KVNamespace;
		OCR_QUEUE: Queue;
		AI?: Ai;
	}

	namespace App {
		interface Platform {
			env: Env;
			ctx: ExecutionContext;
			caches: CacheStorage;
			cf?: IncomingRequestCfProperties
		}

		// interface Error {}
		interface Locals {
			user: {
				id: string;
				email: string;
				role: 'owner' | 'finance' | 'project_manager' | 'employee';
			} | null;
		}
		// interface PageData {}
		// interface PageState {}
	}
}

export {};
