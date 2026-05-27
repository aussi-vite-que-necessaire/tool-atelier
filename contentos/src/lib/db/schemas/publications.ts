import { index, integer, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth';
import { mediaKind } from './media';
import { posts } from './posts';

export const publicationStatus = pgEnum('publication_status', [
  'scheduled',
  'queued',
  'publishing',
  'published',
  'failed',
]);

export const publications = pgTable(
  'publications',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    postId: text('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    contentSnapshot: text('content_snapshot').notNull(),
    mediaKind: mediaKind('media_kind'),
    snapshotKeys: text('snapshot_keys').array(),
    socialAccountId: text('social_account_id'), // FK ajoutée en Spec 6
    platform: text('platform').notNull(),
    status: publicationStatus('status').notNull().default('scheduled'),
    scheduledFor: timestamp('scheduled_for'),
    scheduledTz: text('scheduled_tz'),
    publishedAt: timestamp('published_at'),
    externalPostId: text('external_post_id'),
    externalUrl: text('external_url'),
    attempts: integer('attempts').notNull().default(0),
    lastAttemptAt: timestamp('last_attempt_at'),
    nextAttemptAt: timestamp('next_attempt_at'),
    failureKind: text('failure_kind'),
    lastError: text('last_error'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('publications_user_id_idx').on(table.userId),
    index('publications_post_id_idx').on(table.postId),
  ],
);

export type Publication = typeof publications.$inferSelect;
