import { index, integer, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const postStatus = pgEnum('post_status', ['draft', 'validated']);

export const posts = pgTable(
  'posts',
  {
    id: text('id').primaryKey(),
    // user_id : référence l'id du user dans auth.contentos.ch (pas de FK locale,
    // la table user est gérée par le service SSO).
    userId: text('user_id').notNull(),
    title: text('title').notNull(),
    mediaId: text('media_id'),
    mediaUrl: text('media_url'),
    mediaKind: text('media_kind'),
    mediaWidth: integer('media_width'),
    mediaHeight: integer('media_height'),
    content: text('content').notNull(),
    status: postStatus('status').notNull().default('draft'),
    generationJobId: text('generation_job_id').unique(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [index('posts_user_id_idx').on(table.userId)],
);

export type Post = typeof posts.$inferSelect;
