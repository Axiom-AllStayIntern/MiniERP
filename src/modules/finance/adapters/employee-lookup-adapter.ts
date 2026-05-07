import { asc, eq, isNull } from 'drizzle-orm';
import type { DBClient } from '../../../infrastructure/db';
import { persons } from '../../../infrastructure/db/schema';

export interface EmployeeLookupAdapter<TEmployee = unknown> {
	getEmployeeById(employeeId: string): Promise<TEmployee | null>;
}

export function createEmployeeLookupAdapter<TEmployee>(
	getEmployeeById: (employeeId: string) => Promise<TEmployee | null>
): EmployeeLookupAdapter<TEmployee> {
	return { getEmployeeById };
}

export type FinanceEmployeeDirectoryRow = {
	id: string;
	name: string;
};

export async function listFinanceEmployees(db: DBClient): Promise<FinanceEmployeeDirectoryRow[]> {
	return db
		.select({
			id: persons.id,
			name: persons.name
		})
		.from(persons)
		.where(isNull(persons.deletedAt))
		.orderBy(asc(persons.name));
}

export async function findFinanceEmployeeNameById(
	db: DBClient,
	employeeId: string
): Promise<string | null> {
	const [row] = await db
		.select({ name: persons.name })
		.from(persons)
		.where(eq(persons.id, employeeId))
		.limit(1);

	return row?.name ?? null;
}
