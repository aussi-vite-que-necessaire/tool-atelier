ALTER TABLE "subscriptions" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "medium" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "campaign" text;--> statement-breakpoint
ALTER TABLE "view_events" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "view_events" ADD COLUMN "medium" text;--> statement-breakpoint
ALTER TABLE "view_events" ADD COLUMN "campaign" text;