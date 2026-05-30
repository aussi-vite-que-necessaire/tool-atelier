import { index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const writingTemplates = pgTable(
  'writing_templates',
  {
    id: text('id').primaryKey(),
    // user_id : référence l'id du user (table "user", auth in-app). Pas de FK
    // locale : ces tables cast restent découplées du cycle de vie des comptes.
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    platform: text('platform').notNull().default('linkedin'),
    structure: text('structure').notNull(),
    writingRules: text('writing_rules'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [index('writing_templates_user_id_idx').on(table.userId)],
);

export type WritingTemplate = typeof writingTemplates.$inferSelect;
