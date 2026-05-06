export const PROJECT_EVENTS = {
	PROJECT_CREATED: 'project.created',
	PROJECT_ARCHIVED: 'project.archived',
	PROJECT_MEMBER_ADDED: 'project.member.added'
} as const;

export type ProjectCreatedPayload = { projectId: string; name: string };
export type ProjectArchivedPayload = { projectId: string };
export type ProjectMemberAddedPayload = { projectId: string; personId: string; memberId: string };
