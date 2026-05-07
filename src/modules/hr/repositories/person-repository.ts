import { eq, isNull, and } from 'drizzle-orm';
import type { DBClient } from '$infrastructure/db';
import { persons, personRoles, employeeProfiles } from './person.schema';
import { BaseRepository } from '$platform/modules/base-repository';

// ---------------------------------------------------------------------------
// PersonRepository
// ---------------------------------------------------------------------------

export class PersonRepository extends BaseRepository<typeof persons> {
	constructor(db: DBClient) {
		super(db, persons);
	}

	async findWithRoles(personId: string) {
		const person = await this.findById(personId);
		if (!person) return null;

		const roles = await this.db
			.select()
			.from(personRoles)
			.where(and(eq(personRoles.personId, personId), isNull(personRoles.deletedAt)));

		return { ...person, roles };
	}

	async createPersonWithRole(data: {
		name: string;
		email?: string;
		phone?: string;
		taxId?: string;
		roleType: string;
		entityId?: string;
	}) {
		const now = new Date().toISOString();
		const personId = crypto.randomUUID();
		const roleId = crypto.randomUUID();

		await this.db.insert(persons).values({
			id: personId,
			name: data.name,
			email: data.email ?? null,
			phone: data.phone ?? null,
			taxId: data.taxId ?? null,
			createdAt: now,
			updatedAt: now
		});

		await this.db.insert(personRoles).values({
			id: roleId,
			personId,
			roleType: data.roleType as 'employee' | 'shareholder' | 'freelancer' | 'director' | 'advisor' | 'contact',
			entityId: data.entityId ?? null,
			validFrom: now,
			createdAt: now,
			updatedAt: now
		});

		return { personId, roleId };
	}
}

// ---------------------------------------------------------------------------
// EmployeeProfileRepository
// ---------------------------------------------------------------------------

export class EmployeeProfileRepository extends BaseRepository<typeof employeeProfiles> {
	constructor(db: DBClient) {
		super(db, employeeProfiles);
	}

	async findByPersonId(personId: string) {
		const rows = await this.db
			.select()
			.from(employeeProfiles)
			.where(and(eq(employeeProfiles.personId, personId), isNull(employeeProfiles.deletedAt)))
			.limit(1);
		return rows[0] ?? null;
	}
}

// ---------------------------------------------------------------------------
// EmployeeRepository — Wave 2.2 backward-compat surface for callers still
// using the legacy "employee" entity. Now resolves to persons + employee_profiles
// via PersonRepository / EmployeeProfileRepository; the legacy `employees`
// table was dropped.
// ---------------------------------------------------------------------------

export class EmployeeRepository {
	private personRepo: PersonRepository;
	private profileRepo: EmployeeProfileRepository;

	constructor(db: DBClient) {
		this.personRepo = new PersonRepository(db);
		this.profileRepo = new EmployeeProfileRepository(db);
	}

	async findById(personId: string) {
		const person = await this.personRepo.findById(personId);
		if (!person) return null;
		const profile = await this.profileRepo.findByPersonId(personId);
		return { ...person, profile };
	}
}
