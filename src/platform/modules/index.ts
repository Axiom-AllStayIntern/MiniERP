// Module system â€?public API
export type {
	ModuleLayer,
	ModuleManifest,
	ModuleContext,
	ModuleDefinition,
	DomainEvent,
	EventHandler,
	EventBus
} from './types';

export { createEventBus, createEvent, correlationId, resetCorrelationId } from '../events';
export { ModuleRegistry, registry } from '../registry';
export { createModuleContext, createWorkerContext } from '../context';
export {
	NotFoundError,
	ValidationError,
	ConflictError,
	ForbiddenError,
	ModuleDependencyError
} from './errors';
