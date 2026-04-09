import type { EventBus, ModuleContext } from '../types';
import { AllocationRepository } from './repository';

/**
 * Employee module listens to project.archived to finalize draft payouts.
 */
export function registerEmployeeHandlers(bus: EventBus, ctx: ModuleContext) {
	const allocationRepo = new AllocationRepository(ctx.db);
	bus.on('project.archived', async (event) => {
		const p = event.payload as { projectId: string };
		const rows = await allocationRepo.findByProject(p.projectId);
		for (const row of rows) {
			await allocationRepo.softDelete(row.id);
		}
	});
}
