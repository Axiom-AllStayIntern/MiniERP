import { amountToSgd } from './amount-to-sgd';

/**
 * Returns SGD equivalent for persistence. Non-SGD: uses entry-date FX; on failure returns `null`
 * (unknown conversion — do not treat foreign `amount` as SGD).
 */
export async function resolveSgdEquivalentForWrite(input: {
	amount: number;
	currency: string;
	dateYmd: string;
}): Promise<number | null> {
	const cur = (input.currency || 'SGD').trim().toUpperCase();
	if (!Number.isFinite(input.amount)) return cur === 'SGD' ? 0 : null;
	if (cur === 'SGD') return input.amount;
	try {
		return await amountToSgd(input.amount, cur, input.dateYmd);
	} catch (e) {
		console.error('[fx] resolveSgdEquivalentForWrite failed', {
			currency: cur,
			date: input.dateYmd,
			err: e
		});
		return null;
	}
}
