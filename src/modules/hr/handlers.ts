import type { EventBus, ModuleContext } from '$platform/modules/types';
import { createHrProjectArchiveLegacySource } from './adapters';

/**
 * HR listens to project lifecycle events to archive related allocations.
 */
export function registerEmployeeHandlers(bus: EventBus, ctx: ModuleContext) {
	const archiveSource = createHrProjectArchiveLegacySource(ctx);

	bus.on('project.archived', async (event) => {
		const payload = event.payload as { projectId: string };
		const rows = await archiveSource.findProjectAllocations(payload.projectId);

		for (const row of rows) {
			await archiveSource.softDeleteAllocation(row.id);
		}
	});
}

/** Person currently has no external event handlers. */
export function registerPersonHandlers(_bus: EventBus, _ctx: ModuleContext) {
	// No handlers needed yet; the person module remains a data provider.
}
