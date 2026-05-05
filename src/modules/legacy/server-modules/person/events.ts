export const PERSON_EVENTS = {
	PERSON_CREATED: 'person.created',
	PERSON_ROLE_ADDED: 'person.role.added'
} as const;

export type PersonCreatedPayload = { personId: string; name: string };
export type PersonRoleAddedPayload = { personId: string; roleType: string; roleId: string };
