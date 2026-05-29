CREATE TABLE "operators" (
	"id" text PRIMARY KEY NOT NULL,
	"handle" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "operators_handle_unique" UNIQUE("handle")
);
--> statement-breakpoint
CREATE TABLE "audience_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operator_id" text NOT NULL,
	"user_id" text NOT NULL,
	"source" text,
	"medium" text,
	"campaign" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audience_operator_user" UNIQUE("operator_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "resources" DROP CONSTRAINT "resources_slug_unique";--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "operator_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "audience_members" ADD CONSTRAINT "audience_members_operator_id_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_operator_id_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_operator_slug" UNIQUE("operator_id","slug");