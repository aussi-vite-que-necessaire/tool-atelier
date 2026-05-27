import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth';

export const settings = pgTable('settings', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  brandName: text('brand_name').notNull().default(''),
  brandSignature: text('brand_signature').notNull().default(''),
  brandLogoUrl: text('brand_logo_url'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type Settings = typeof settings.$inferSelect;
