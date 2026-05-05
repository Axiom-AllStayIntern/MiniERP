export const AR_EVENTS = {
	INVOICE_CREATED: 'invoice.created',
	INVOICE_CONFIRMED: 'invoice.confirmed',
	INVOICE_VOIDED: 'invoice.voided',
	PAYMENT_RECEIVED: 'payment.received',
	PAYMENT_MADE: 'payment.made'
} as const;

export type InvoiceCreatedPayload = { invoiceId: string; projectId: string; type: 'customer' | 'supplier'; amount: number };
export type InvoiceConfirmedPayload = { invoiceId: string; projectId: string; type: 'customer' | 'supplier'; amount: number };
export type InvoiceVoidedPayload = { invoiceId: string; projectId: string; type: 'customer' | 'supplier' };
export type PaymentReceivedPayload = { paymentId: string; invoiceId?: string; projectId?: string; amount: number };
export type PaymentMadePayload = { paymentId: string; invoiceId?: string; projectId?: string; amount: number };
