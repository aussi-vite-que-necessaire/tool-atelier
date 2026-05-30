-- Tables du module media (galerie, styles, chartes, templates, marque), clé par user_id.
-- IF NOT EXISTS partout + FK gardée par un bloc DO : idempotent (base preview
-- persistante, re-déploiements).

CREATE TABLE IF NOT EXISTS "brand" (
	"user_id" text PRIMARY KEY NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"signature" text DEFAULT '' NOT NULL,
	"logo_url" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "media" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"r2_key" text NOT NULL,
	"url" text NOT NULL,
	"kind" text DEFAULT 'image' NOT NULL,
	"mime" text DEFAULT 'image/png' NOT NULL,
	"prompt" text,
	"parent_id" text,
	"source" text NOT NULL,
	"template_id" text,
	"vars" jsonb,
	"style_id" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"width" integer,
	"height" integer,
	"size_bytes" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "style_guides" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "visual_styles" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"prompt" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "visual_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"platform" text DEFAULT 'linkedin' NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"body_html" text NOT NULL,
	"css" text DEFAULT '' NOT NULL,
	"variables_schema" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sample_vars" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"style_guide_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "visual_templates" ADD CONSTRAINT "visual_templates_style_guide_id_style_guides_id_fk" FOREIGN KEY ("style_guide_id") REFERENCES "public"."style_guides"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_media_created" ON "media" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_media_parent" ON "media" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_media_source" ON "media" USING btree ("source");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_media_kind" ON "media" USING btree ("kind");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_media_user" ON "media" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_style_guides_user" ON "style_guides" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_visual_styles_user" ON "visual_styles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_visual_templates_user" ON "visual_templates" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_visual_templates_user_slug" ON "visual_templates" USING btree ("user_id","slug");
