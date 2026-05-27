import { index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth';

export const styleGuides = pgTable(
  'style_guides',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    content: text('content').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [index('style_guides_user_id_idx').on(table.userId)],
);

export type StyleGuide = typeof styleGuides.$inferSelect;
