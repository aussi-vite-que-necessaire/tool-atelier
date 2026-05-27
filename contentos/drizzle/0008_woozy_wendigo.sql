CREATE TABLE "carousel_slides" (
	"id" text PRIMARY KEY NOT NULL,
	"media_id" text NOT NULL,
	"position" integer NOT NULL,
	"slide_key" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "carousel_slides" ADD CONSTRAINT "carousel_slides_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "carousel_slides_media_id_idx" ON "carousel_slides" USING btree ("media_id");