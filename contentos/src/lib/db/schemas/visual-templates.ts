import { index, integer, jsonb, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { user } from './auth';
import { styleGuides } from './style-guides';

export const visualTemplates = pgTable(
  'visual_templates',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    label: text('label').notNull(),
    platform: text('platform').notNull().default('linkedin'),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    bodyHtml: text('body_html').notNull(),
    css: text('css').notNull(),
    styleGuideId: text('style_guide_id').references(() => styleGuides.id, {
      onDelete: 'set null',
    }),
    variablesSchema: jsonb('variables_schema').notNull(),
    sampleVars: jsonb('sample_vars').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('visual_templates_user_id_idx').on(table.userId),
    unique('visual_templates_user_id_slug_unique').on(table.userId, table.slug),
  ],
);

export type VisualTemplate = typeof visualTemplates.$inferSelect;
