import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const settings = pgTable('settings', {
  // user_id : référence l'id du user dans auth.contentos.ch (pas de FK locale,
  // la table user est gérée par le service SSO).
  userId: text('user_id').primaryKey(),
  brandName: text('brand_name').notNull().default(''),
  brandSignature: text('brand_signature').notNull().default(''),
  brandLogoUrl: text('brand_logo_url'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type Settings = typeof settings.$inferSelect;
