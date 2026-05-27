import { index, integer, jsonb, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth';

export const mediaKind = pgEnum('media_kind', ['image', 'carousel', 'video']);
export const imageSource = pgEnum('image_source', ['template', 'standalone']);

export const media = pgTable(
  'media',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    kind: mediaKind('kind').notNull(),
    assetKey: text('asset_key').notNull(),
    previewKey: text('preview_key').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [index('media_user_id_idx').on(table.userId)],
);

export const imageAssets = pgTable('image_assets', {
  mediaId: text('media_id')
    .primaryKey()
    .references(() => media.id, { onDelete: 'cascade' }),
  source: imageSource('source').notNull(),
  templateSlug: text('template_slug'),
  vars: jsonb('vars'),
  aiBrief: text('ai_brief'),
  aiSourceKey: text('ai_source_key'),
  styleId: text('style_id'), // FK ajoutée en Spec 3
});

export type Media = typeof media.$inferSelect;
export type ImageAsset = typeof imageAssets.$inferSelect;
