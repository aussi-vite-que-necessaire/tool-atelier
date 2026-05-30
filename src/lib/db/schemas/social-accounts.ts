import { index, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';

export const socialAccounts = pgTable(
  'social_accounts',
  {
    id: text('id').primaryKey(),
    // user_id : référence l'id du user (table "user", auth in-app). Pas de FK
    // locale : ces tables cast restent découplées du cycle de vie des comptes.
    userId: text('user_id').notNull(),
    platform: text('platform').notNull(),
    externalId: text('external_id').notNull(),
    displayName: text('display_name').notNull(),
    accessToken: text('access_token').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    scopes: text('scopes').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('social_accounts_user_id_idx').on(table.userId),
    unique('social_accounts_user_id_platform_unique').on(table.userId, table.platform),
  ],
);

export type SocialAccount = typeof socialAccounts.$inferSelect;
