const FRANKFURTER = 'https://api.frankfurter.app';

/** Clamp to today (UTC) so ECB/Frankfurter never receives a future date. */
export function clampToFxDate(dateYmd: string): string {
	const t = Date.parse(`${dateYmd.slice(0, 10)}T12:00:00Z`);
	if (!Number.isFinite(t)) {
		return new Date().toISOString().slice(0, 10);
	}
	const d = new Date(t);
	const now = new Date();
	const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
	if (d > todayUtc) {
		return todayUtc.toISOString().slice(0, 10);
	}
	return dateYmd.slice(0, 10);
}

/**
 * Converts `amount` in `currency` to SGD using Frankfurter (ECB) historical rates for `dateYmd`.
 * 1 unit of foreign currency × rate = SGD.
 */
export async function amountToSgd(amount: number, currency: string, dateYmd: string): Promise<number> {
	const cur = (currency || 'SGD').trim().toUpperCase();
	if (!Number.isFinite(amount)) return 0;
	if (cur === 'SGD') return amount;

	const fxDate = clampToFxDate(dateYmd);
	const url = `${FRANKFURTER}/${fxDate}?from=${encodeURIComponent(cur)}&to=SGD`;
	const res = await fetch(url, { headers: { Accept: 'application/json' } });
	if (!res.ok) {
		const text = await res.text().catch(() => '');
		throw new Error(`Frankfurter ${res.status}: ${text.slice(0, 200)}`);
	}
	const data = (await res.json()) as { rates?: { SGD?: number } };
	const rate = data.rates?.SGD;
	if (typeof rate !== 'number' || !Number.isFinite(rate)) {
		throw new Error('FX response missing SGD rate');
	}
	return amount * rate;
}
