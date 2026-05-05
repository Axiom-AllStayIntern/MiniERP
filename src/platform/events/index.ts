import type { DomainEvent, EventBus, EventHandler, ModuleContext } from '$platform/modules/types';

export function createEventBus(): EventBus {
	const handlers = new Map<string, Set<EventHandler<any>>>();

	const bus: EventBus = {
		async emit<T>(event: DomainEvent<T>) {
			const set = handlers.get(event.type);
			if (!set) return;
			for (const handler of set) {
				try {
					await handler(event, undefined as unknown as ModuleContext);
				} catch (err) {
					console.error(`[EventBus] handler error for "${event.type}" from "${event.source}":`, err);
				}
			}
		},

		async emitAsync<T>(event: DomainEvent<T>, queue: Queue) {
			await queue.send(JSON.stringify(event));
		},

		on<T>(eventType: string, handler: EventHandler<T>) {
			let set = handlers.get(eventType);
			if (!set) {
				set = new Set();
				handlers.set(eventType, set);
			}
			set.add(handler as EventHandler<any>);
		},

		off<T>(eventType: string, handler: EventHandler<T>) {
			handlers.get(eventType)?.delete(handler as EventHandler<any>);
		}
	};

	return bus;
}

let _corrId: string | undefined;

export function correlationId(): string {
	if (!_corrId) _corrId = crypto.randomUUID();
	return _corrId;
}

export function resetCorrelationId(): void {
	_corrId = undefined;
}

export function createEvent<T>(type: string, source: string, payload: T): DomainEvent<T> {
	return {
		type,
		source,
		payload,
		timestamp: new Date().toISOString(),
		correlationId: correlationId()
	};
}
