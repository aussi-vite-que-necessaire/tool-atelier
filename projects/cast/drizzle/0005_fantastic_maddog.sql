CREATE TABLE "visual_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"platform" text DEFAULT 'linkedin' NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"body_html" text NOT NULL,
	"css" text NOT NULL,
	"variables_schema" jsonb NOT NULL,
	"sample_vars" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "visual_templates_user_id_slug_unique" UNIQUE("user_id","slug")
);
--> statement-breakpoint
ALTER TABLE "visual_templates" ADD CONSTRAINT "visual_templates_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "visual_templates_user_id_idx" ON "visual_templates" USING btree ("user_id");