-- Renomme writing_templates -> publication_formats (formats de publication) et
-- ajoute la colonne visual_intent (intention de visuel). Rename, pas DROP : la
-- base d'intégration est persistante, on préserve les lignes. Idempotent via les
-- gardes (to_regclass / IF NOT EXISTS) pour re-déploiements sur base déjà migrée.
DO $$ BEGIN
	IF to_regclass('public.writing_templates') IS NOT NULL
		AND to_regclass('public.publication_formats') IS NULL THEN
		ALTER TABLE "writing_templates" RENAME TO "publication_formats";
	END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	IF to_regclass('public.writing_templates_user_id_idx') IS NOT NULL THEN
		ALTER INDEX "writing_templates_user_id_idx" RENAME TO "publication_formats_user_id_idx";
	END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "publication_formats" ADD COLUMN IF NOT EXISTS "visual_intent" text;
