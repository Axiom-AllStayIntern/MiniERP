import { asc, eq, isNull } from 'drizzle-orm';
import type { DBClient } from '../../../infrastructure/db';
import { employees } from '../../../infrastructure/db/schema';

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
			id: employees.id,
			name: employees.name
		})
		.from(employees)
		.where(isNull(employees.deletedAt))
		.orderBy(asc(employees.name));
}

export async function findFinanceEmployeeNameById(
	db: DBClient,
	employeeId: string
): Promise<string | null> {
	const [row] = await db
		.select({ name: employees.name })
		.from(employees)
		.where(eq(employees.id, employeeId))
		.limit(1);

	return row?.name ?? null;
}
