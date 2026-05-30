# Scrub des previews : garde anti-fuite vérifié plutôt que liste blanche — idée en backlog

Capturée pendant l'audit adversarial du pipe (it.3→it.4). Le scrub actuel est solide sur ce
qui compte aujourd'hui ; cette évolution n'a de sens qu'avec de la PII de tiers en base.

## Contexte (30/05/2026)

`scrub_sql()` dans `scripts/deploy.sh` anonymise les clones de prod pour les previews par-branche.
C'est une **liste blanche** : il neutralise explicitement la couche auth/contact —
`social_accounts` (tokens/ext_id), `account` (tokens OAuth + hash de mot de passe), `session` /
`verification` (vidées), `"user".email/name`, `res_access.email` — et pose l'identité preview
connue sur le 1ᵉʳ opérateur (`op@contentos.test`, connectable via `/preview-login`).

Vérifié en live : la couche auth/token/email est étanche (0 email réel, 0 token, 0 session).
Mais la couche **identité/contenu** survit, par construction (liste blanche = tout ce qui n'est
pas listé passe) : `voice.name`/`voice.content`, `publications.external_url` (vraie URL de
partage LinkedIn), et — vides aujourd'hui mais exposés — `user.image`, `brand.*`,
`res_settings.brand_name/handle`, `media.url/prompt`, `account.account_id`,
`publications.last_error`.

Pour un atelier mono-opérateur, c'est *sa propre* donnée (déjà publique : nom, URL LinkedIn)
dans *sa propre* preview → préjudice nul. L'ajout de `res_access.email` à l'it.3 montre quand
même que la liste blanche remord à chaque nouvelle table/colonne PII.

## L'idée — un invariant vérifié, pas une colonne de plus

Après le scrub, **scanner** toutes les colonnes `text` à la recherche de motifs de donnée réelle
(`@` hors `@contentos.test`, `urn:li:`, etc.) et **échouer le deploy** si une correspondance est
trouvée. La liste blanche cesse d'être une promesse tenue à la main : toute table/colonne PII
ajoutée plus tard fait tomber le deploy tant qu'elle n'est pas couverte. Coût modeste (une requête
de contrôle), bénéfice = on ne peut plus *oublier* une colonne.

## Déclencheur

Quand la suite porte de la **PII de tiers** (plusieurs utilisateurs réels, audience du module
ressources avec de vrais contacts, bascule SaaS) — c'est là qu'une fuite cesse d'être « ta donnée
dans ta preview » et qu'un garde vérifié devient nécessaire.
