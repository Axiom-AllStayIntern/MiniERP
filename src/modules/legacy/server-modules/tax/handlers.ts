import type { EventBus, ModuleContext } from '$platform/modules/types';

/**
 * Tax module listens to invoice and payout events to keep tax data current.
 */
export function registerTaxHandlers(bus: EventBus, _ctx: ModuleContext) {
	// Listen to invoice.confirmed for GST working data
	bus.on('invoice.confirmed', async (event) => {
		const p = event.payload as { invoiceId: string; projectId: string; amount: number };
		console.info('[Tax] invoice.confirmed received', p);
	});

	// Listen to payout.settled for PersonIncome records
	bus.on('payout.settled', async (event) => {
		const p = event.payload as {
			payoutId: string;
			projectId: string;
			personId: string;
			amount: number;
			period: string;
		};
		console.info('[Tax] payout.settled received', p);
	});

	bus.on('invoice.voided', async (event) => {
		const p = event.payload as { invoiceId: string; projectId: string; type: string };
		console.info('[Tax] invoice.voided received', p);
	});
}
