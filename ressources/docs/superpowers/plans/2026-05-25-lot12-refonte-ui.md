# Plan d'implémentation — Lot 12 (refonte UI)

Réf. spec : `docs/superpowers/specs/2026-05-25-lot12-refonte-ui-design.md`.
Dépendance ajoutée : `motion` (animations). `lucide-react` déjà présent.

## Vague 1 — Fondation

1. `app/globals.css` : nouveaux tokens (paper/ink/accent/sémantique/ombres), remap des tokens
   de base, polices, prose-reader retravaillée, classes `.field/.btn/.btn-accent`, focus,
   sélection.
2. `app/layout.tsx` : variable Geist Mono, métadonnées, `antialiased`.
3. `components/ui/button.tsx`, `card.tsx`, `badge.tsx` (cva).
4. `components/ui/reveal.tsx` (client, motion, reduced-motion).
5. `components/brand/logo.tsx` (wordmark accent).

## Vague 2 — Les 14 modules

Reprendre chaque composant de `components/modules/` dans le système (Card/Badge/icônes/accent/
ombres), + `copy-button` (retour visuel accent), + `reader/markdown` (prose). TOC actif.

## Vague 3 — Lecteur

`reader/reading-progress.tsx` (client), `reader/toc.tsx` (client, section active),
`reader/page-tree.tsx` (état actif accent), `reader/reader-shell.tsx` (progress + header sticky
+ grille + nav prec/suiv + tiroir mobile + footer), `(public)/r/[slug]/render.tsx` (bloc-titre,
Reveal, navigation). Helper de navigation prec/suiv depuis l'arbre.

## Vague 4 — Pages publiques

`components/resource-card.tsx` (carte réutilisable, cover/motif généré), `app/page.tsx` (hero +
grille + état vide), `app/bibliotheque/page.tsx` (grille + état vide), `app/connexion/page.tsx`
(carte centrée), `components/auth/resource-gate.tsx` + `auth/otp-form.tsx` (parcours OTP soigné).

## Vague 5 — Admin

`app/admin/layout.tsx`, `app/admin/page.tsx` (KPI + liste), `app/admin/r/[slug]/page.tsx`
(sections cartes + danger zone), `app/admin/r/[slug]/p/[[...path]]/page.tsx`,
`components/admin/page-tree-editor.tsx`, `components/admin/module-form.tsx` (champs/boutons
homogènes). Logique inchangée.

## Vague 6 — Vérification

Captures `after` via `scripts/shots.mjs`, comparaison avant/après, `typecheck`/`lint`/`test`/
`build`. Correctifs. Récapitulatif.
