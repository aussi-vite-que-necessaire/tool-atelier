-- Drop tables auth+OIDC : cast n'héberge plus de session ni d'OAuth.
-- La SSO est désormais centralisée dans auth.contentos.ch.
-- DROP IF EXISTS : idempotent (base preview persistante).

DROP TABLE IF EXISTS "oauth_consent" CASCADE;
DROP TABLE IF EXISTS "oauth_access_token" CASCADE;
DROP TABLE IF EXISTS "oauth_application" CASCADE;
DROP TABLE IF EXISTS "verification" CASCADE;
DROP TABLE IF EXISTS "account" CASCADE;
DROP TABLE IF EXISTS "session" CASCADE;
DROP TABLE IF EXISTS "user" CASCADE;
