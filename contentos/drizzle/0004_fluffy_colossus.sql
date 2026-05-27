ALTER TABLE "posts" ADD COLUMN "generation_job_id" text;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_generation_job_id_unique" UNIQUE("generation_job_id");