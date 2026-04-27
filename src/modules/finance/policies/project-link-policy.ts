export type ProjectLinkRequirement = 'optional' | 'required';

export function resolveProjectLinkPolicy(input?: { required?: boolean }): ProjectLinkRequirement {
	return input?.required ? 'required' : 'optional';
}
