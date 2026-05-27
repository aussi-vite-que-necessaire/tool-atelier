ALTER TABLE "voice" DROP CONSTRAINT "voice_pkey";--> statement-breakpoint
ALTER TABLE "voice" ADD COLUMN "id" text;--> statement-breakpoint
UPDATE "voice" SET "id" = gen_random_uuid()::text WHERE "id" IS NULL;--> statement-breakpoint
ALTER TABLE "voice" ALTER COLUMN "id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "voice" ADD CONSTRAINT "voice_pkey" PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "voice" ADD COLUMN "name" text DEFAULT 'Voix principale' NOT NULL;--> statement-breakpoint
ALTER TABLE "voice" ALTER COLUMN "name" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "voice" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "voice_user_id_idx" ON "voice" USING btree ("user_id");
