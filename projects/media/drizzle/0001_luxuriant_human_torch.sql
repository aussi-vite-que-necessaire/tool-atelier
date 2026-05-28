CREATE TABLE "images" (
	"id" text PRIMARY KEY NOT NULL,
	"r2_key" text NOT NULL,
	"url" text NOT NULL,
	"prompt" text,
	"parent_id" text,
	"source" text NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"width" integer,
	"height" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_images_created" ON "images" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_images_parent" ON "images" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_images_source" ON "images" USING btree ("source");