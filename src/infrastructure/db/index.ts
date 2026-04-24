import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

export type DBClient = ReturnType<typeof getDb>;

export function getDb(env: Env) {
	return drizzle(env.DB, { schema });
}

export { schema };
