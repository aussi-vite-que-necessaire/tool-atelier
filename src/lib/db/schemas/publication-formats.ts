import { index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const publicationFormats = pgTable(
  'publication_formats',
  {
    id: text('id').primaryKey(),
    // user_id : référence l'id du user (table "user", auth in-app). Pas de FK
    // locale : ces tables restent découplées du cycle de vie des comptes.
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    platform: text('platform').notNull().default('linkedin'),
    structure: text('structure').notNull(),
    // Intention de visuel qui accompagne ce format (type/direction, pas DA précise).
    visualIntent: text('visual_intent'),
    writingRules: text('writing_rules'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [index('publication_formats_user_id_idx').on(table.userId)],
);

export type PublicationFormat = typeof publicationFormats.$inferSelect;
