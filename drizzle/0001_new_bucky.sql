CREATE TYPE "public"."image_source" AS ENUM('template', 'standalone');--> statement-breakpoint
CREATE TYPE "public"."media_kind" AS ENUM('image', 'carousel', 'video');--> statement-breakpoint
CREATE TYPE "public"."post_status" AS ENUM('draft', 'validated');--> statement-breakpoint
CREATE TYPE "public"."publication_status" AS ENUM('scheduled', 'queued', 'publishing', 'published', 'failed');--> statement-breakpoint
CREATE TABLE "ideas" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"idea" text NOT NULL,
	"brief" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "image_assets" (
	"media_id" text PRIMARY KEY NOT NULL,
	"source" "image_source" NOT NULL,
	"template_slug" text,
	"vars" jsonb,
	"ai_brief" text,
	"ai_source_key" text,
	"style_id" text
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" "media_kind" NOT NULL,
	"asset_key" text NOT NULL,
	"preview_key" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"idea_id" text NOT NULL,
	"writing_template_id" text,
	"media_id" text,
	"content" text NOT NULL,
	"status" "post_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"post_id" text NOT NULL,
	"content_snapshot" text NOT NULL,
	"media_kind" "media_kind",
	"snapshot_keys" text[],
	"social_account_id" text,
	"platform" text NOT NULL,
	"status" "publication_status" DEFAULT 'scheduled' NOT NULL,
	"scheduled_for" timestamp,
	"scheduled_tz" text,
	"published_at" timestamp,
	"external_post_id" text,
	"external_url" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp,
	"next_attempt_at" timestamp,
	"failure_kind" text,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_assets" ADD CONSTRAINT "image_assets_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_idea_id_ideas_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."ideas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publications" ADD CONSTRAINT "publications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publications" ADD CONSTRAINT "publications_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ideas_user_id_idx" ON "ideas" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "media_user_id_idx" ON "media" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "posts_user_id_idx" ON "posts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "posts_idea_id_idx" ON "posts" USING btree ("idea_id");--> statement-breakpoint
CREATE INDEX "posts_media_id_idx" ON "posts" USING btree ("media_id");--> statement-breakpoint
CREATE INDEX "publications_user_id_idx" ON "publications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "publications_post_id_idx" ON "publications" USING btree ("post_id");