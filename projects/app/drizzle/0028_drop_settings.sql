-- Drop table settings : le « Brand Mark » (nom de marque, signature, logo)
-- est entièrement retiré de cast. La table ne servait qu'à ça.
-- DROP IF EXISTS : idempotent (base preview persistante).

DROP TABLE IF EXISTS "settings" CASCADE;
