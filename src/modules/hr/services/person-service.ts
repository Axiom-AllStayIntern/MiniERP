import type { ModuleContext } from '$platform/modules/types';
import {
	PersonRepository,
	EmployeeProfileRepository,
	EmployeeRepository
} from '../repositories/person-repository';
import { NotFoundError } from '$platform/modules/errors';

// ---------------------------------------------------------------------------
// PersonService
// ---------------------------------------------------------------------------

export class PersonService {
	private personRepo: PersonRepository;
	private profileRepo: EmployeeProfileRepository;
	private legacyEmployeeRepo: EmployeeRepository;

	constructor(private ctx: ModuleContext) {
		this.personRepo = new PersonRepository(ctx.db);
		this.profileRepo = new EmployeeProfileRepository(ctx.db);
		this.legacyEmployeeRepo = new EmployeeRepository(ctx.db);
	}

	async getPersonById(id: string) {
		return this.personRepo.findById(id);
	}

	async getPersonWithRoles(id: string) {
		const result = await this.personRepo.findWithRoles(id);
		if (!result) throw new NotFoundError('Person', id);
		return result;
	}

	async createPerson(data: {
		name: string;
		email?: string;
		phone?: string;
		taxId?: string;
		roleType: string;
		entityId?: string;
	}) {
		return this.personRepo.createPersonWithRole(data);
	}

	async updatePerson(id: string, data: Record<string, unknown>) {
		return this.personRepo.update(id, data);
	}

	// Legacy employee access (during migration period)
	async getEmployeeById(id: string) {
		return this.legacyEmployeeRepo.findById(id);
	}

	async updateEmployee(id: string, data: Record<string, unknown>) {
		// Wave 2.2: legacy employees table dropped — updates flow through persons.
		return this.personRepo.update(id, data);
	}

	async softDeleteEmployee(id: string) {
		return this.personRepo.softDelete(id);
	}
}
