import { index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const posts = pgTable(
  'posts',
  {
    id: text('id').primaryKey(),
    // user_id : référence l'id du user (table "user", auth in-app). Pas de FK
    // locale : ces tables cast restent découplées du cycle de vie des comptes.
    userId: text('user_id').notNull(),
    title: text('title').notNull(),
    mediaId: text('media_id'),
    mediaUrl: text('media_url'),
    mediaKind: text('media_kind'),
    mediaWidth: integer('media_width'),
    mediaHeight: integer('media_height'),
    content: text('content').notNull(),
    generationJobId: text('generation_job_id').unique(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [index('posts_user_id_idx').on(table.userId)],
);

export type Post = typeof posts.$inferSelect;
