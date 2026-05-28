-- Drop tables auth+OIDC : ressources n'héberge plus de session ni d'OAuth local.
-- La SSO est désormais centralisée dans auth.contentos.ch (cookie cross-subdomain
-- .contentos.ch). Les colonnes user_id de subscriptions et view_events sont
-- conservées (text) ; leur FK vers user(id) saute (la table user disparaît).
-- DROP IF EXISTS : idempotent (base preview persistante entre redéploiements).

ALTER TABLE "subscriptions" DROP CONSTRAINT IF EXISTS "subscriptions_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "view_events" DROP CONSTRAINT IF EXISTS "view_events_user_id_user_id_fk";
--> statement-breakpoint
DROP TABLE IF EXISTS "oauth_consent" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "oauth_access_token" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "oauth_application" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "verification" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "account" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "session" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "user" CASCADE;
