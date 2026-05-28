import { index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth';

export const ideas = pgTable(
  'ideas',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    idea: text('idea').notNull(),
    brief: text('brief'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [index('ideas_user_id_idx').on(table.userId)],
);

export type Idea = typeof ideas.$inferSelect;
