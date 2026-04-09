import type { EventBus, ModuleContext } from '../types';

export function registerReportingHandlers(bus: EventBus, _ctx: ModuleContext) {
	bus.on('invoice.created', async (event) => {
		console.info('[Reporting] invoice.created received', event.payload);
	});
	bus.on('invoice.voided', async (event) => {
		console.info('[Reporting] invoice.voided received', event.payload);
	});
	bus.on('allocation.updated', async (event) => {
		console.info('[Reporting] allocation.updated received', event.payload);
	});
}
