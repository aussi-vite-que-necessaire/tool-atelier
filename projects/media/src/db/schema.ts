import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Schéma des tables métier. L'auth est déléguée à auth.contentos.ch (SSO) ;
// `user_id` est ici l'id retourné par le provider (mPNwuxFCfdhF5jriE1dqkWCdgcIjsiQ5
// pour Manu en prod), pas une FK locale — aucune table user n'existe dans cette base.

// Métadonnées des médias (octets stockés sur R2). tags en jsonb → filtrage en SQL.
export const media = pgTable(
  "media",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    r2Key: text("r2_key").notNull(),
    url: text("url").notNull(),
    kind: text("kind").notNull().default("image"),
    mime: text("mime").notNull().default("image/png"),
    prompt: text("prompt"),
    parentId: text("parent_id"),
    source: text("source").notNull(),
    templateId: text("template_id"),
    vars: jsonb("vars").$type<Record<string, unknown>>(),
    styleId: text("style_id"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    width: integer("width"),
    height: integer("height"),
    sizeBytes: integer("size_bytes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_media_created").on(t.createdAt),
    index("idx_media_parent").on(t.parentId),
    index("idx_media_source").on(t.source),
    index("idx_media_kind").on(t.kind),
    index("idx_media_user").on(t.userId),
  ],
);

export const visualStyles = pgTable(
  "visual_styles",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    prompt: text("prompt").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("idx_visual_styles_user").on(t.userId)],
);

export const styleGuides = pgTable(
  "style_guides",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    content: text("content").notNull().default(""),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("idx_style_guides_user").on(t.userId)],
);

export const visualTemplates = pgTable(
  "visual_templates",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    // slug unique par utilisateur (deux users peuvent avoir un slug "post-citation").
    slug: text("slug").notNull(),
    label: text("label").notNull(),
    platform: text("platform").notNull().default("linkedin"),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    bodyHtml: text("body_html").notNull(),
    css: text("css").notNull().default(""),
    variablesSchema: jsonb("variables_schema").$type<unknown[]>().notNull().default([]),
    sampleVars: jsonb("sample_vars").$type<Record<string, unknown>>().notNull().default({}),
    styleGuideId: text("style_guide_id").references(() => styleGuides.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_visual_templates_user").on(t.userId),
    uniqueIndex("uniq_visual_templates_user_slug").on(t.userId, t.slug),
  ],
);

// Une marque par utilisateur : user_id est la PK (1-brand-per-user).
export const brand = pgTable("brand", {
  userId: text("user_id").primaryKey(),
  name: text("name").notNull().default(""),
  signature: text("signature").notNull().default(""),
  logoUrl: text("logo_url"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const schema = {
  media,
  visualStyles,
  styleGuides,
  visualTemplates,
  brand,
};
