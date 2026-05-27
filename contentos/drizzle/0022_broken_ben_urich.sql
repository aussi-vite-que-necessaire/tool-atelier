ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "media_url" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "media_kind" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "media_width" integer;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "media_height" integer;