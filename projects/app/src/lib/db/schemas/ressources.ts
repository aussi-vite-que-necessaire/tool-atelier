import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import type { ThemeConfig } from '@/lib/ressources/theme';

// Tables de la verticale ressources (lead magnets + espace public docs). Tout est
// clé par `user_id` (id BetterAuth in-app) — l'utilisateur EST l'opérateur, pas de
// table operators séparée. Préfixe `res_` sur les noms de table pour éviter toute
// collision avec cast/media dans la base unique de la suite.

// Réglages de l'espace public d'un opérateur (docs). Une ligne par utilisateur,
// provisionnée à la première visite de la section admin. `handle` = slug public
// de l'espace (/docs/<handle>), unique globalement.
export const resSettings = pgTable('res_settings', {
  userId: text('user_id').primaryKey(),
  handle: text('handle').notNull().unique(),
  brandName: text('brand_name'),
  theme: jsonb('theme').$type<ThemeConfig>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Ressource (lead magnet). Slug unique PAR utilisateur.
export const resResources = pgTable(
  'res_resources',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').notNull(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    coverImageUrl: text('cover_image_url'),
    visibility: text('visibility').notNull().default('public'),
    published: boolean('published').notNull().default(false),
    featured: boolean('featured').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('res_resources_user_slug').on(t.userId, t.slug)],
);

// Page d'une ressource. Arborescence par parent_id (racine = parent null).
export const resPages = pgTable(
  'res_pages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    resourceId: uuid('resource_id')
      .notNull()
      .references(() => resResources.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id').references((): AnyPgColumn => resPages.id, {
      onDelete: 'cascade',
    }),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('res_pages_resource_parent_slug').on(t.resourceId, t.parentId, t.slug)],
);

// Module de contenu (markdown, callout, image, code, …) rattaché à une page.
export const resModules = pgTable('res_modules', {
  id: uuid('id').defaultRandom().primaryKey(),
  pageId: uuid('page_id')
    .notNull()
    .references(() => resPages.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  position: integer('position').notNull().default(0),
  content: jsonb('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Membre d'audience rattaché à un opérateur, créé à la 1ʳᵉ lecture d'une de ses
// ressources. readerId = id auth du lecteur (text, sans FK locale).
export const resAudience = pgTable(
  'res_audience',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').notNull(),
    readerId: text('reader_id').notNull(),
    source: text('source'),
    medium: text('medium'),
    campaign: text('campaign'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('res_audience_user_reader').on(t.userId, t.readerId)],
);

// Accès nominatif (par e-mail) à une ressource privée.
export const resAccess = pgTable(
  'res_access',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    resourceId: uuid('resource_id')
      .notNull()
      .references(() => resResources.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('res_access_resource_email').on(t.resourceId, t.email)],
);

// Abonnement d'un lecteur à une ressource (1ʳᵉ lecture authentifiée).
export const resSubscriptions = pgTable(
  'res_subscriptions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    readerId: text('reader_id').notNull(),
    resourceId: uuid('resource_id')
      .notNull()
      .references(() => resResources.id, { onDelete: 'cascade' }),
    source: text('source'),
    medium: text('medium'),
    campaign: text('campaign'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('res_subscriptions_reader_resource').on(t.readerId, t.resourceId)],
);

// Évènement de vue (page_view / gate_view) pour les statistiques.
export const resViewEvents = pgTable(
  'res_view_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    resourceId: uuid('resource_id')
      .notNull()
      .references(() => resResources.id, { onDelete: 'cascade' }),
    pageId: uuid('page_id').references(() => resPages.id, { onDelete: 'cascade' }),
    readerId: text('reader_id'),
    type: text('type').notNull(),
    source: text('source'),
    medium: text('medium'),
    campaign: text('campaign'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('res_view_events_resource_created').on(t.resourceId, t.createdAt)],
);

export type ResSettingsRow = typeof resSettings.$inferSelect;
export type ResResourceRow = typeof resResources.$inferSelect;
export type ResPageRow = typeof resPages.$inferSelect;
export type ResModuleRow = typeof resModules.$inferSelect;
