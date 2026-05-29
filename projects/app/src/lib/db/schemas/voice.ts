import { index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const voice = pgTable(
  'voice',
  {
    id: text('id').primaryKey(),
    // user_id : référence l'id du user dans auth.contentos.ch (pas de FK locale,
    // la table user est gérée par le service SSO).
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    content: text('content').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [index('voice_user_id_idx').on(t.userId)],
);

export type Voice = typeof voice.$inferSelect;
