ALTER TABLE "images" RENAME TO "media";
ALTER TABLE "media" ADD COLUMN "kind" text DEFAULT 'image' NOT NULL;
ALTER TABLE "media" ADD COLUMN "mime" text DEFAULT 'image/png' NOT NULL;
ALTER TABLE "media" ADD COLUMN "template_id" text;
ALTER TABLE "media" ADD COLUMN "vars" jsonb;
ALTER TABLE "media" ADD COLUMN "style_id" text;
ALTER TABLE "media" ADD COLUMN "size_bytes" integer;
UPDATE "media" SET "kind" = CASE WHEN "source" = 'html_render' THEN 'render' ELSE 'image' END;
DROP INDEX IF EXISTS "idx_images_created";
DROP INDEX IF EXISTS "idx_images_parent";
DROP INDEX IF EXISTS "idx_images_source";
CREATE INDEX "idx_media_created" ON "media" ("created_at");
CREATE INDEX "idx_media_parent" ON "media" ("parent_id");
CREATE INDEX "idx_media_source" ON "media" ("source");
CREATE INDEX "idx_media_kind" ON "media" ("kind");

CREATE TABLE "visual_styles" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "prompt" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE "style_guides" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "content" text DEFAULT '' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE "visual_templates" (
  "id" text PRIMARY KEY NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "label" text NOT NULL,
  "platform" text DEFAULT 'linkedin' NOT NULL,
  "width" integer NOT NULL,
  "height" integer NOT NULL,
  "body_html" text NOT NULL,
  "css" text DEFAULT '' NOT NULL,
  "variables_schema" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "sample_vars" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "style_guide_id" text REFERENCES "style_guides"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE "brand" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text DEFAULT '' NOT NULL,
  "signature" text DEFAULT '' NOT NULL,
  "logo_url" text,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
