import type { EventBus, ModuleContext } from '../../lib/server/modules/types';

/**
 * Project listens to financial events for cache invalidation hooks.
 * Profit is still calculated on demand from live data.
 */
export function registerProjectHandlers(bus: EventBus, _ctx: ModuleContext) {
	bus.on('allocation.updated', async (event) => {
		console.info('[Project] allocation.updated received', event.payload);
	});
	bus.on('invoice.created', async (event) => {
		console.info('[Project] invoice.created received', event.payload);
	});
	bus.on('invoice.voided', async (event) => {
		console.info('[Project] invoice.voided received', event.payload);
	});
}
