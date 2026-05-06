import type { EventBus, ModuleContext } from '$platform/modules/types';
import { AuditService } from '$platform/audit/audit-service';

/**
 * Listens to all domain events and auto-creates audit log entries so each
 * module does not have to call writeAuditLog() explicitly.
 */
export function registerCoreHandlers(bus: EventBus, ctx: ModuleContext) {
	const audit = new AuditService(ctx);

	bus.on('invoice.confirmed', async (event) => {
		const p = event.payload as { invoiceId: string; projectId: string; type: string; amount: number };
		await audit.writeLog({
			action: `invoice.${p.type}.confirmed`,
			entityType: p.type === 'customer' ? 'invoice_out' : 'invoice_in',
			entityId: p.invoiceId,
			projectId: p.projectId,
			metadata: { amount: p.amount, source: 'event_bus' }
		});
	});

	bus.on('payment.received', async (event) => {
		const p = event.payload as { paymentId: string; invoiceId?: string; projectId?: string; amount: number };
		await audit.writeLog({
			action: 'payment.received',
			entityType: 'payment',
			entityId: p.paymentId,
			projectId: p.projectId,
			metadata: { amount: p.amount, invoiceId: p.invoiceId }
		});
	});

	bus.on('payment.made', async (event) => {
		const p = event.payload as { paymentId: string; invoiceId?: string; projectId?: string; amount: number };
		await audit.writeLog({
			action: 'payment.made',
			entityType: 'payment',
			entityId: p.paymentId,
			projectId: p.projectId,
			metadata: { amount: p.amount, invoiceId: p.invoiceId }
		});
	});

	bus.on('expense.created', async (event) => {
		const p = event.payload as {
			expenseId: string;
			projectId: string | null | undefined;
			amount: number;
			expenseType: string;
		};
		await audit.writeLog({
			action: 'expense.created',
			entityType: 'expense',
			entityId: p.expenseId,
			projectId: p.projectId ?? undefined,
			metadata: { amount: p.amount, expenseType: p.expenseType }
		});
	});

	bus.on('payout.settled', async (event) => {
		const p = event.payload as {
			payoutId: string;
			projectId: string;
			personId: string;
			amount: number;
			period: string;
		};
		await audit.writeLog({
			action: 'payout.settled',
			entityType: 'payout',
			entityId: p.payoutId,
			projectId: p.projectId,
			metadata: { amount: p.amount, personId: p.personId, period: p.period }
		});
	});
}
