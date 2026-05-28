-- Migration SSO + isolation par utilisateur.
-- Idempotente (la base preview persiste entre déploiements).
--
-- 1) Drop des tables d'auth locale (déléguées à auth.contentos.ch).
-- 2) Ajout d'une colonne user_id sur media / visual_styles / style_guides /
--    visual_templates, avec DEFAULT = id Manu prod pour assigner les lignes
--    existantes, puis NOT NULL, puis DROP DEFAULT (les nouveaux INSERTs doivent
--    fournir explicitement user_id).
-- 3) brand : passage d'une marque globale (PK = id) à une marque par utilisateur
--    (PK = user_id). La ligne existante id='brand' est rattachée à Manu.
-- 4) visual_templates : slug n'est plus globalement unique, mais unique par user.
-- 5) Index sur user_id pour chaque table.

-- Tables d'auth locale (séquence inversée des FK : oauth_* d'abord, puis
-- account/session/verification, puis user). CASCADE pour balayer toute FK résiduelle.
DROP TABLE IF EXISTS "oauth_consent" CASCADE;
DROP TABLE IF EXISTS "oauth_access_token" CASCADE;
DROP TABLE IF EXISTS "oauth_application" CASCADE;
DROP TABLE IF EXISTS "account" CASCADE;
DROP TABLE IF EXISTS "session" CASCADE;
DROP TABLE IF EXISTS "verification" CASCADE;
DROP TABLE IF EXISTS "user" CASCADE;

-- ── media ─────────────────────────────────────────────────────────────────────
ALTER TABLE "media"
  ADD COLUMN IF NOT EXISTS "user_id" text DEFAULT 'mPNwuxFCfdhF5jriE1dqkWCdgcIjsiQ5';
ALTER TABLE "media" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "media" ALTER COLUMN "user_id" DROP DEFAULT;
CREATE INDEX IF NOT EXISTS "idx_media_user" ON "media" ("user_id");

-- ── visual_styles ─────────────────────────────────────────────────────────────
ALTER TABLE "visual_styles"
  ADD COLUMN IF NOT EXISTS "user_id" text DEFAULT 'mPNwuxFCfdhF5jriE1dqkWCdgcIjsiQ5';
ALTER TABLE "visual_styles" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "visual_styles" ALTER COLUMN "user_id" DROP DEFAULT;
CREATE INDEX IF NOT EXISTS "idx_visual_styles_user" ON "visual_styles" ("user_id");

-- ── style_guides ──────────────────────────────────────────────────────────────
ALTER TABLE "style_guides"
  ADD COLUMN IF NOT EXISTS "user_id" text DEFAULT 'mPNwuxFCfdhF5jriE1dqkWCdgcIjsiQ5';
ALTER TABLE "style_guides" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "style_guides" ALTER COLUMN "user_id" DROP DEFAULT;
CREATE INDEX IF NOT EXISTS "idx_style_guides_user" ON "style_guides" ("user_id");

-- ── visual_templates ──────────────────────────────────────────────────────────
ALTER TABLE "visual_templates"
  ADD COLUMN IF NOT EXISTS "user_id" text DEFAULT 'mPNwuxFCfdhF5jriE1dqkWCdgcIjsiQ5';
ALTER TABLE "visual_templates" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "visual_templates" ALTER COLUMN "user_id" DROP DEFAULT;
CREATE INDEX IF NOT EXISTS "idx_visual_templates_user" ON "visual_templates" ("user_id");

-- slug n'est plus globalement unique : remplacé par (user_id, slug) unique.
-- Le nom de la contrainte historique vient du UNIQUE inline sur la colonne :
-- visual_templates_slug_unique (Drizzle/PostgreSQL convention).
ALTER TABLE "visual_templates" DROP CONSTRAINT IF EXISTS "visual_templates_slug_unique";
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_visual_templates_user_slug"
  ON "visual_templates" ("user_id", "slug");

-- ── brand ─────────────────────────────────────────────────────────────────────
-- Passage 1-brand-global → 1-brand-per-user (PK = user_id).
-- Ligne existante "brand" → Manu (id prod stable).
ALTER TABLE "brand"
  ADD COLUMN IF NOT EXISTS "user_id" text;
UPDATE "brand" SET "user_id" = 'mPNwuxFCfdhF5jriE1dqkWCdgcIjsiQ5'
  WHERE "user_id" IS NULL;
ALTER TABLE "brand" ALTER COLUMN "user_id" SET NOT NULL;
-- Drop l'ancienne PK (sur id) si encore en place ; bascule la PK sur user_id ;
-- supprime la colonne id devenue inutile. Ces opérations sont guardées par
-- les noms de contraintes / colonnes.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'brand' AND constraint_name = 'brand_pkey'
      AND constraint_type = 'PRIMARY KEY'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'brand' AND column_name = 'id'
  ) THEN
    ALTER TABLE "brand" DROP CONSTRAINT "brand_pkey";
    ALTER TABLE "brand" ADD CONSTRAINT "brand_pkey" PRIMARY KEY ("user_id");
    ALTER TABLE "brand" DROP COLUMN "id";
  END IF;
END $$;
