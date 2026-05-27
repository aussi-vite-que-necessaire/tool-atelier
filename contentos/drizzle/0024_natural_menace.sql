-- 1. Copie de données AVANT tout drop : reporte le média référencé par chaque
-- post dans ses colonnes propres (media_url/media_kind/media_width/media_height).
-- Gardé : ne s'exécute que si la table "media" existe encore (idempotent).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='media') THEN
    UPDATE "posts" p SET
      "media_url" = m."asset_key",
      "media_kind" = CASE WHEN m."kind"::text = 'carousel' THEN 'pdf' ELSE m."kind"::text END,
      "media_width" = m."width",
      "media_height" = m."height"
    FROM "media" m
    WHERE p."media_id" = m."id" AND p."media_url" IS NULL;
  END IF;
END $$;--> statement-breakpoint
-- 2. Retire la FK + l'index posts.media_id (la colonne reste, sans contrainte).
ALTER TABLE "posts" DROP CONSTRAINT IF EXISTS "posts_media_id_media_id_fk";--> statement-breakpoint
DROP INDEX IF EXISTS "posts_media_id_idx";--> statement-breakpoint
-- 3. Drop des tables média (CASCADE pour ignorer l'ordre des FK).
DROP TABLE IF EXISTS "image_assets" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "carousel_slides" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "visual_templates" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "visual_styles" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "style_guides" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "media" CASCADE;--> statement-breakpoint
-- 4. Drop des enums devenus orphelins.
DROP TYPE IF EXISTS "public"."media_kind";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."image_source";
