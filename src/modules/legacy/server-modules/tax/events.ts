export const TAX_EVENTS = {
	GST_RETURN_GENERATED: 'gst.return.generated'
} as const;

export type GstReturnGeneratedPayload = { returnId: string; year: string; quarter: string };
