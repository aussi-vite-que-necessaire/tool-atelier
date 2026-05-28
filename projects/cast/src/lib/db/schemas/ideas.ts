import { index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const ideas = pgTable(
  'ideas',
  {
    id: text('id').primaryKey(),
    // user_id : référence l'id du user dans auth.contentos.ch (pas de FK locale,
    // la table user est gérée par le service SSO).
    userId: text('user_id').notNull(),
    idea: text('idea').notNull(),
    brief: text('brief'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [index('ideas_user_id_idx').on(table.userId)],
);

export type Idea = typeof ideas.$inferSelect;
