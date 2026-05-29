-- Verticale ressources (lead magnets + espace public docs), clé par user_id.
-- IF NOT EXISTS partout + FK gardées par des blocs DO : idempotent (base preview
-- persistante, re-déploiements). Préfixe res_ pour éviter toute collision.

CREATE TABLE IF NOT EXISTS "res_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"handle" text NOT NULL,
	"brand_name" text,
	"theme" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "res_settings_handle_unique" UNIQUE("handle")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "res_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"cover_image_url" text,
	"visibility" text DEFAULT 'public' NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "res_resources_user_slug" UNIQUE("user_id","slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "res_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_id" uuid NOT NULL,
	"parent_id" uuid,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "res_pages_resource_parent_slug" UNIQUE("resource_id","parent_id","slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "res_modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" uuid NOT NULL,
	"type" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"content" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "res_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_id" uuid NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "res_access_resource_email" UNIQUE("resource_id","email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "res_audience" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"reader_id" text NOT NULL,
	"source" text,
	"medium" text,
	"campaign" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "res_audience_user_reader" UNIQUE("user_id","reader_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "res_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reader_id" text NOT NULL,
	"resource_id" uuid NOT NULL,
	"source" text,
	"medium" text,
	"campaign" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "res_subscriptions_reader_resource" UNIQUE("reader_id","resource_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "res_view_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_id" uuid NOT NULL,
	"page_id" uuid,
	"reader_id" text,
	"type" text NOT NULL,
	"source" text,
	"medium" text,
	"campaign" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "res_pages" ADD CONSTRAINT "res_pages_resource_id_res_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."res_resources"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "res_pages" ADD CONSTRAINT "res_pages_parent_id_res_pages_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."res_pages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "res_modules" ADD CONSTRAINT "res_modules_page_id_res_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."res_pages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "res_access" ADD CONSTRAINT "res_access_resource_id_res_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."res_resources"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "res_subscriptions" ADD CONSTRAINT "res_subscriptions_resource_id_res_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."res_resources"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "res_view_events" ADD CONSTRAINT "res_view_events_resource_id_res_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."res_resources"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "res_view_events" ADD CONSTRAINT "res_view_events_page_id_res_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."res_pages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "res_view_events_resource_created" ON "res_view_events" USING btree ("resource_id","created_at");
