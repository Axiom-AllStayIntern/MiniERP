/**
 * Typed error classes for module service layer.
 * Route handlers catch these and map to appropriate HTTP responses.
 */

export class NotFoundError extends Error {
	readonly code = 'NOT_FOUND' as const;
	constructor(entity: string, id?: string) {
		super(id ? `${entity} "${id}" not found` : `${entity} not found`);
		this.name = 'NotFoundError';
	}
}

export class ValidationError extends Error {
	readonly code = 'VALIDATION_ERROR' as const;
	readonly fields?: Record<string, string>;
	constructor(message: string, fields?: Record<string, string>) {
		super(message);
		this.name = 'ValidationError';
		this.fields = fields;
	}
}

export class ConflictError extends Error {
	readonly code = 'CONFLICT' as const;
	constructor(message: string) {
		super(message);
		this.name = 'ConflictError';
	}
}

export class ForbiddenError extends Error {
	readonly code = 'FORBIDDEN' as const;
	constructor(message = 'Insufficient permissions') {
		super(message);
		this.name = 'ForbiddenError';
	}
}

export class ModuleDependencyError extends Error {
	readonly code = 'MODULE_DEPENDENCY' as const;
	readonly missingDeps: string[];
	constructor(moduleId: string, missingDeps: string[]) {
		super(
			`Module "${moduleId}" requires disabled modules: ${missingDeps.join(', ')}`
		);
		this.name = 'ModuleDependencyError';
		this.missingDeps = missingDeps;
	}
}
