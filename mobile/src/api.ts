import type { CategoryChoice, ConfirmPayload, DocumentArtifactView, ProcessingStatus, ProjectInfo } from './types';
import { hashConfirmationPayload } from './payloadHash';

type Envelope<T> = { ok: true; data: T } | { ok: false; error: string; details?: unknown };

function normalizeBaseUrl(raw: string): string {
	return raw.trim().replace(/\/+$/, '');
}

function cookiePairs(raw: string | string[] | null): string {
	if (!raw) return '';
	const parts = Array.isArray(raw) ? raw : raw.split(/,(?=\s*[^;,]+=)/);
	return parts.map((part) => part.split(';')[0]?.trim()).filter(Boolean).join('; ');
}

function readSetCookie(headers: Headers): string {
	const h = headers as Headers & { map?: Record<string, string | string[]>; getSetCookie?: () => string[] };
	if (typeof h.getSetCookie === 'function') return cookiePairs(h.getSetCookie());
	return cookiePairs(headers.get('set-cookie') ?? h.map?.['set-cookie'] ?? null);
}

// test

export class SmartFinApi {
	private baseUrl: string;
	private cookie = '';

	constructor(baseUrl: string) {
		this.baseUrl = normalizeBaseUrl(baseUrl);
	}

	setBaseUrl(baseUrl: string) {
		this.baseUrl = normalizeBaseUrl(baseUrl);
	}

	private captureCookie(res: Response) {
		const next = readSetCookie(res.headers);
		if (next) this.cookie = next;
	}

	private async json<T>(path: string, init: RequestInit = {}): Promise<T> {
		const headers = new Headers(init.headers);
		headers.set('accept', 'application/json');
		if (this.cookie) headers.set('cookie', this.cookie);

		const res = await fetch(`${this.baseUrl}${path}`, {
			...init,
			headers,
			credentials: 'include'
		});
		this.captureCookie(res);
		const body = (await res.json().catch(() => null)) as Envelope<T> | null;
		if (!res.ok || !body?.ok) {
			throw new Error((body && 'error' in body && body.error) || `Request failed (${res.status})`);
		}
		return body.data;
	}

	async signIn(email: string, password: string): Promise<void> {
		const res = await fetch(`${this.baseUrl}/api/auth/sign-in/email`, {
			method: 'POST',
			headers: {
				accept: 'application/json',
				'content-type': 'application/json',
				...(this.cookie ? { cookie: this.cookie } : {})
			},
			credentials: 'include',
			body: JSON.stringify({ email, password })
		});
		this.captureCookie(res);
		if (!res.ok) {
			const body = (await res.json().catch(() => null)) as { message?: string; error?: string } | null;
			throw new Error(body?.message ?? body?.error ?? `Sign-in failed (${res.status})`);
		}
		if (!this.cookie) {
			throw new Error('Sign-in succeeded but no session cookie was returned.');
		}
	}

	async uploadPhoto(input: { uri: string; name: string; type: string }): Promise<DocumentArtifactView> {
		const form = new FormData();
		form.append('uploadedFrom', 'ai_panel');
		form.append('file', {
			uri: input.uri,
			name: input.name,
			type: input.type
		} as unknown as Blob);

		return this.json<DocumentArtifactView>('/api/documents', {
			method: 'POST',
			body: form
		});
	}

	async categories(): Promise<CategoryChoice[]> {
		const data = await this.json<{ categories: CategoryChoice[] }>('/api/documents/categories');
		return data.categories;
	}

	async inbox(statuses: ProcessingStatus[]): Promise<DocumentArtifactView[]> {
		const query = encodeURIComponent(statuses.join(','));
		const data = await this.json<{ items: DocumentArtifactView[] }>(`/api/documents/inbox?status=${query}&limit=100`);
		return data.items;
	}

	async document(id: string): Promise<DocumentArtifactView> {
		return this.json<DocumentArtifactView>(`/api/documents/${encodeURIComponent(id)}`);
	}

	async status(id: string): Promise<DocumentArtifactView> {
		const data = await this.json<Partial<DocumentArtifactView> & { documentId: string }>(
			`/api/documents/${encodeURIComponent(id)}/status`
		);
		return this.document(data.documentId);
	}

	async reclassify(id: string, categoryId: string): Promise<DocumentArtifactView> {
		return this.json<DocumentArtifactView>(`/api/documents/${encodeURIComponent(id)}/reclassify`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ categoryId })
		});
	}

	async projects(query: string, status: string): Promise<ProjectInfo[]> {
		const params = new URLSearchParams();
		if (query.trim()) params.set('q', query.trim());
		if (status) params.set('status', status);
		const data = await this.json<
			Array<{
				project: {
					id: string;
					name: string;
					status: string;
					startDate: string | null;
					endDate: string | null;
				};
				customerName: string | null;
			}>
		>(`/api/projects?${params.toString()}`);
		return data.map((row) => ({
			id: row.project.id,
			name: row.project.name,
			status: row.project.status,
			startDate: row.project.startDate,
			endDate: row.project.endDate,
			customerName: row.customerName
		}));
	}

	async confirm(payload: ConfirmPayload): Promise<{ entityId: string; entityRoute: string; categoryId: string }> {
		const payloadHash = await hashConfirmationPayload(payload);
		return this.json<{ entityId: string; entityRoute: string; categoryId: string }>(
			`/api/documents/${encodeURIComponent(payload.documentId)}/confirm`,
			{
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ payload, payloadHash })
			}
		);
	}
}
