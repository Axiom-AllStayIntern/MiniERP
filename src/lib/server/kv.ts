export async function getConfig<T>(kv: KVNamespace, key: string): Promise<T> {
	const value = await kv.get(`config:${key}`);
	if (!value) {
		throw new Error(`Config not found: ${key}`);
	}

	try {
		return JSON.parse(value) as T;
	} catch {
		return value as T;
	}
}

export async function putConfig<T>(kv: KVNamespace, key: string, value: T): Promise<void> {
	const payload = typeof value === 'string' ? value : JSON.stringify(value);
	await kv.put(`config:${key}`, payload);
}
