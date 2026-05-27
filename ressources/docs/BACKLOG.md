# Backlog — idées cadrées ou à creuser

Reprise propre : ce qui a été pensé mais pas (encore) implémenté. Les lots livrés sont dans
`docs/superpowers/specs/` et `docs/superpowers/plans/` (lots 1 à 10 + lot 12 refonte UI).

## Cadré, prêt à implémenter

- **Carte de partage OG brandée (lot 11)** — décisions prises, non codé.
  Approche **B (media-manager)** + on **réutilise `coverImageUrl`** (cover = image du gate ET
  `og:image`, déjà branché lot 6). Plan : un outil MCP **`get_og_card_html(slug)`** qui renvoie
  un HTML brandé autonome (1200×630, N&B brutaliste, titre + description + wordmark), que
  l'agent envoie à media-manager `render_html` → URL R2 → `update_resource({ coverImageUrl })`.
  Branding centralisé dans lab-ressources. Logo : wordmark typographique par défaut (ou fournir
  une URL/SVG). Aucune migration.

## À creuser (non cadré)

- **Bulk d'édition de ressources existantes** : `add_pages` (tableau) pour ajouter plusieurs
  sous-pages d'un coup à une ressource déjà créée (aujourd'hui `add_page` une par une ;
  `create_resource` couvre la création complète).
- **Tracking des clics CTA** : étendre `view_events` pour compter les clics sur les modules
  `cta` (funnel de conversion).
- **Ancres page-scoped uniques** : dédoublonnage cross-modules (slugger partagé au rendu) si on
  veut des deep-links 100 % fiables même avec des titres de section identiques (aujourd'hui :
  par-module, le lien va au 1er en cas de doublon).
- **Builder** : glisser-déposer + aperçu markdown en temps réel.
- **Intégration media-manager (images de contenu)** : upload/génération depuis le builder au
  lieu de coller des URLs R2.
- **Connecteur Claude.ai** : option OAuth Team/Enterprise (client id/secret) si besoin un jour.
- **Dashboard stats visuel** : graphes, séries temporelles (aujourd'hui : chiffres via MCP
  `get_stats`).
- **Durcissement auth** : rate-limit des envois OTP avant gros trafic public.

## Dette / exploitation

- **Migrations prod** : `npm run db:generate` puis `DATABASE_URL=<app user> npx drizzle-kit
  migrate` depuis le poste avant le push (tables possédées par `ressources_app` → pas de
  `GRANT`). Voir `docs/DEPLOY.md`. À automatiser (migrateur au démarrage) si la fréquence augmente.
