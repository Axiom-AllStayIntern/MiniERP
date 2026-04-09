/**
 * @deprecated Temporary migration bridge for route handlers.
 *
 * Routes should progressively move to `createModuleContext()` + module APIs
 * and avoid SQL/ORM wiring in route files.
 */
export { getDb, schema } from '$lib/server/db';
