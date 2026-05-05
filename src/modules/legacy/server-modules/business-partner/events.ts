export const BP_EVENTS = {
	PARTNER_CREATED: 'partner.created'
} as const;

export type PartnerCreatedPayload = { partnerId: string; name: string; type: string };
