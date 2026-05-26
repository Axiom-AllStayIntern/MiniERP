import type { AccessPointConfig, AccessPointResult, AccessPointSubmission } from './types';

/**
 * Stub for InvoiceNow Accredited Access Point integration.
 *
 * In production, this sends UBL XML to a Peppol Access Point (e.g. InvoiceNow
 * network) for transmission to IRAS and the buyer. The AP handles SMP lookup,
 * AS4 transport, and MDN receipt.
 *
 * To activate: set PEPPOL_AP_ENDPOINT, PEPPOL_AP_API_KEY, PEPPOL_SENDER_ID,
 * PEPPOL_SENDER_SCHEME in environment / company_settings.
 */
export function createAccessPointClient(config: AccessPointConfig | null) {
	const isConfigured = Boolean(
		config?.endpoint && config?.apiKey && config?.senderId
	);

	const submit = async (submission: AccessPointSubmission): Promise<AccessPointResult> => {
		if (!isConfigured || !config) {
			return {
				ok: false,
				error: 'Access Point not configured. Set PEPPOL_AP_ENDPOINT, PEPPOL_AP_API_KEY, PEPPOL_SENDER_ID in company settings.',
				timestamp: new Date().toISOString()
			};
		}

		// Production implementation: POST to AP REST endpoint
		// const response = await fetch(config.endpoint, {
		//   method: 'POST',
		//   headers: {
		//     'Content-Type': 'application/xml',
		//     'Authorization': `Bearer ${config.apiKey}`,
		//     'X-Sender-ID': config.senderId,
		//     'X-Sender-Scheme': config.senderScheme,
		//     'X-Recipient-ID': submission.recipientId,
		//     'X-Recipient-Scheme': submission.recipientScheme,
		//   },
		//   body: submission.xml,
		// });

		return {
			ok: false,
			error: 'Access Point integration is stubbed. Connect to an accredited InvoiceNow Access Point to enable e-invoice transmission.',
			timestamp: new Date().toISOString()
		};
	};

	const getStatus = () => ({
		configured: isConfigured,
		endpoint: config?.endpoint ?? null,
		senderId: config?.senderId ?? null
	});

	return { submit, getStatus, isConfigured };
}

export type AccessPointClient = ReturnType<typeof createAccessPointClient>;
