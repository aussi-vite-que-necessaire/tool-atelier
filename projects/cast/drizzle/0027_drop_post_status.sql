-- Drop du statut brouillon/validé des posts : la notion ne sert plus.
-- La vraie source de vérité « publié » vit dans les publications.
-- IF EXISTS : idempotent (base preview persistante).

ALTER TABLE "posts" DROP COLUMN IF EXISTS "status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."post_status";
