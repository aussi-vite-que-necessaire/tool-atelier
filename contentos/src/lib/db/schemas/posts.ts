import { index, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth';
import { media } from './media';

export const postStatus = pgEnum('post_status', ['draft', 'validated']);

export const posts = pgTable(
  'posts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    mediaId: text('media_id').references(() => media.id, { onDelete: 'set null' }),
    content: text('content').notNull(),
    status: postStatus('status').notNull().default('draft'),
    generationJobId: text('generation_job_id').unique(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('posts_user_id_idx').on(table.userId),
    index('posts_media_id_idx').on(table.mediaId),
  ],
);

export type Post = typeof posts.$inferSelect;
