import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  unique,
  type AnyPgColumn,
} from "drizzle-orm/pg-core"
import { operators } from "./operators"

export const resources = pgTable(
  "resources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // Propriétaire (ADR-0002). Slug unique PAR opérateur, plus globalement.
    operatorId: text("operator_id")
      .notNull()
      .references(() => operators.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    coverImageUrl: text("cover_image_url"),
    visibility: text("visibility").notNull().default("public"),
    published: boolean("published").notNull().default(false),
    featured: boolean("featured").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("resources_operator_slug").on(t.operatorId, t.slug)],
)

export const pages = pgTable(
  "pages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id").references((): AnyPgColumn => pages.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("pages_resource_parent_slug").on(t.resourceId, t.parentId, t.slug)],
)

export const modules = pgTable("modules", {
  id: uuid("id").defaultRandom().primaryKey(),
  pageId: uuid("page_id")
    .notNull()
    .references(() => pages.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  position: integer("position").notNull().default(0),
  content: jsonb("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export type ResourceRow = typeof resources.$inferSelect
export type PageRow = typeof pages.$inferSelect
export type ModuleRow = typeof modules.$inferSelect
