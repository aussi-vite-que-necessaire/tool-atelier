UPDATE "posts" SET "title" = COALESCE((SELECT "idea" FROM "ideas" WHERE "ideas"."id" = "posts"."idea_id"), 'Sans titre');--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "title" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" DROP CONSTRAINT "posts_idea_id_ideas_id_fk";
--> statement-breakpoint
DROP INDEX "posts_idea_id_idx";--> statement-breakpoint
ALTER TABLE "posts" DROP COLUMN "idea_id";--> statement-breakpoint
ALTER TABLE "posts" DROP COLUMN "writing_template_id";
