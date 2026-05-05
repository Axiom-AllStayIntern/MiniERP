import type { EventBus, ModuleContext } from '$platform/modules/types';
import { AuditService } from './service';

/**
 * Core module listens to ALL domain events and auto-creates audit log entries.
 * This provides a universal audit trail without requiring each module to
 * explicitly call writeAuditLog().
 */
export function registerCoreHandlers(bus: EventBus, ctx: ModuleContext) {
	const audit = new AuditService(ctx);

	// Auto-audit invoice events
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

	// Auto-audit payment events
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

	// Auto-audit expense events
	bus.on('expense.created', async (event) => {
		const p = event.payload as { expenseId: string; projectId: string | null | undefined; amount: number; expenseType: string };
		await audit.writeLog({
			action: 'expense.created',
			entityType: 'expense',
			entityId: p.expenseId,
			projectId: p.projectId ?? undefined,
			metadata: { amount: p.amount, expenseType: p.expenseType }
		});
	});

	// Auto-audit payout settlement events
	bus.on('payout.settled', async (event) => {
		const p = event.payload as { payoutId: string; projectId: string; personId: string; amount: number; period: string };
		await audit.writeLog({
			action: 'payout.settled',
			entityType: 'payout',
			entityId: p.payoutId,
			projectId: p.projectId,
			metadata: { amount: p.amount, personId: p.personId, period: p.period }
		});
	});
}
