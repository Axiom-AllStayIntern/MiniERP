import { sql } from 'drizzle-orm';
import { text } from 'drizzle-orm/sqlite-core';

/** Standard timestamp + soft-delete columns shared by all tables */
export const timeFields = {
	createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
	updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
	deletedAt: text('deleted_at')
};
