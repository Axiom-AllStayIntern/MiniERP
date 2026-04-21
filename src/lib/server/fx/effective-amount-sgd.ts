/**
 * Effective SGD for UI lists and JS-side totals: SGD rows fall back to `amount` when sgd is unset;
 * non-SGD rows only count when `sgdEquivalent` is non-zero (never treat foreign `amount` as SGD).
 */
export function effectiveAmountSgd(
	currency: string | null | undefined,
	sgdEquivalent: number | null | undefined,
	amount: number | null | undefined
): number {
	const cur = (currency || 'SGD').trim().toUpperCase();
	const sgd = sgdEquivalent ?? 0;
	const amt = Number(amount ?? 0);
	if (cur === 'SGD') {
		if (sgd !== 0 && Number.isFinite(sgd)) return sgd;
		return Number.isFinite(amt) ? amt : 0;
	}
	return sgd !== 0 && Number.isFinite(sgd) ? sgd : 0;
}
