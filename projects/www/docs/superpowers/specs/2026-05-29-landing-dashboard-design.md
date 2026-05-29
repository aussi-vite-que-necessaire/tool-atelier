# www — landing publique + dashboard de la suite contentos

> Spec validée le 2026-05-29. Refonte de `projects/www/` : on passe du serveur
> statique « hello world » à une vraie page d'accueil de la suite + un dashboard
> de raccourcis gardé par le SSO.

## Intention

`www` sert `contentos.ch` + `www.contentos.ch`. Deux besoins :

1. **Expliquer le projet** à un visiteur non connecté — une landing sobre qui
   pitche contentos (suite d'outils de création de contenu **pilotés par des
   agents IA** : Claude, GPT, Gemini…), projet exploratoire d'**Emmanuel Bernard**
   (avqn.ch), dont l'objectif est de **faciliter la production de contenu pour les
   réseaux sociaux via l'IA** (génération de posts, d'images, de carrousels, de
   vidéos ; publication planifiée), avec une **valeur cardinale** : garder le
   contrôle sur le pipe de production et augmenter la qualité du livré.
2. **Donner accès au dashboard** — un raccourci connecté vers les outils de la
   suite (media, ressources, cast, skills), réservé aux gens authentifiés.

## Stack — passage à Next.js + @contentos/ui

`www` quitte le serveur statique Node (`server.js` + `public/index.html`) pour
devenir une app **Next.js 16 App Router**, sortie `standalone`, écoute `:8080`,
exactement comme `auth` / `cast` / `media` / `styleguide`. Elle **consomme le
styleguide partagé** `@contentos/ui` via `bin/ui-sync www` (tokens OKLch, polices
Geist via `next/font`, primitives `Button`, `Card`, `Heading`, `Lead`, `Text`,
`Muted`, `Badge`).

`lab.json` reste **sans capacité** (pas de db, redis, email, browser) — comme
`styleguide`/`skills`. `healthz/route.ts` répond 200 sans toucher de ressource.

Fichiers de plomberie calqués sur `styleguide` : `package.json`,
`package-lock.json`, `next.config.ts` (`output: "standalone"`), `tsconfig.json`
(alias `@/* → ./src/*`), `postcss.config.mjs`, `Dockerfile` (multi-stage
deps→build→runner), `compose.yml` (inchangé), `src/app/globals.css` (imports
Tailwind + `ui-tokens.css`), `src/app/layout.tsx`, `src/app/providers.tsx`
(`next-themes`, thème clair par défaut). On supprime `server.js` et
`public/index.html`.

## Pages & routes

### `/` — landing (publique)

Une seule colonne, sobre, dans l'esprit `styleguide`. Sections :

- **Hero** : nom « contentos », accroche (suite d'outils de création de contenu
  pour agents IA), sous-titre mentionnant Claude / GPT / Gemini.
- **Pitch** : projet exploratoire d'Emmanuel Bernard (avqn.ch) ; objectif =
  faciliter la production de contenu social via l'IA.
- **Ce qu'on produit** : génération de posts, d'images, de carrousels, de vidéos ;
  publication automatisée (planification). Présenté en petites cartes ou liste.
- **Valeur cardinale** : garder le contrôle sur le pipe de production, augmenter
  la qualité du livré. Mise en avant.
- **CTA** : bouton vers la connexion / le dashboard (cohérent avec le header).

Accessible sans session. Pas de gate.

### `/dashboard` — raccourcis (gardé SSO)

Grille de **cartes-raccourcis** vers les outils de la suite (`media`,
`ressources`, `cast`, `skills`), chacune : nom, tagline, lien vers
`https://<projet>.contentos.ch`. La liste est lue depuis un JSON généré (voir
« Source des raccourcis »).

**Gate** : en prod, pas de session → `redirect` vers
`${AUTH_URL}/sign-in?redirect=<dashboard>`. Hors-prod (preview déployée + dev
local), court-circuit : accès ouvert, identité de preview — strictement le modèle
de `skills` (`src/lib/auth.ts`).

### `/healthz`

`GET → 200 "ok"`, `dynamic = "force-dynamic"`, ne touche aucune ressource.

## Auth — session déléguée au SSO

`src/lib/auth.ts` est **copié du modèle `skills`** :

- `getSession(headers)` : en prod, `fetch ${AUTH_URL}/api/auth/get-session` en
  forwardant le cookie du browser ; hors-prod, court-circuit avec une identité de
  preview.
- `signInUrl()` : `${AUTH_URL}/sign-in?redirect=${APP_URL}` (ici on redirige vers
  `/dashboard` pour atterrir au bon endroit après login).
- `authUrl` exporté pour le lien « Se déconnecter ».
- `AUTH_URL` : défaut `https://auth.contentos.ch`, surchargeable par env.
  `APP_URL` + `APP_ENV` injectés par la plateforme. Rien à poser dans les secrets.

## Header (dynamique selon session)

Composant serveur lisant la session via `getSession(headers())`. En haut à
droite :

- **Déconnecté** → bouton **« Connexion »** (`signInUrl()`).
- **Connecté** → lien **« Dashboard »**, l'email de l'utilisateur, et
  **« Se déconnecter »** (pointe sur `authUrl`, le provider gère le sign-out via
  le cookie cross-domain).

Présent sur la landing et le dashboard (dans le layout, ou un composant partagé).

## Footer

Présent sur toutes les pages : **« Emmanuel Bernard · avqn.ch »** (lien vers
`https://avqn.ch`) + un lien vers le **styleguide**
(`https://styleguide.contentos.ch`).

## Source des raccourcis du dashboard — `bin/www-tools-sync`

**Contrainte** : le build Docker est scopé par projet (contexte =
`projects/www/`). `www` ne peut pas lire `../media/lab.json` au build ni au
runtime. La liste doit donc être **matérialisée dans `www`** avant le build —
même problème, même solution que `bin/ui-sync` et `scripts/sync-shared.sh`.

**Opt-in déclaratif** : chaque outil à exposer déclare un bloc `dashboard` dans
son `lab.json`. Exemple pour `media` :

```json
{ "description": "…", "db": true, "browser": true,
  "dashboard": { "label": "media", "tagline": "Génération et édition de visuels", "order": 20 } }
```

On l'ajoute à **`media`, `ressources`, `cast`, `skills`**. Les autres projets
(`auth`, `counter`, `hello`, `docs`, `styleguide`, `www`) ne le déclarent pas →
absents du dashboard. (Choix : tenir la liste des 4 outils « produit » ; on
ajoutera styleguide/docs plus tard si besoin en déclarant le bloc chez eux.)

**Script `bin/www-tools-sync`** (calqué sur `bin/ui-sync`) :

- `bin/www-tools-sync` : scanne `projects/*/lab.json`, extrait les blocs
  `dashboard`, calcule l'URL `https://<projet>.contentos.ch`, trie par `order`
  puis nom, et écrit `projects/www/src/tools.generated.json` avec un en-tête
  `@generated` (clé `_generated` dans le JSON, puisque JSON n'a pas de commentaire).
  Chaque entrée : `{ "name": "<projet>", "label", "tagline", "url", "order" }`.
- `bin/www-tools-sync --check` : régénère en mémoire et `diff` contre le fichier
  committé ; exit 1 en cas de dérive (édition manuelle, oubli de resync, ou
  ajout/retrait d'un bloc `dashboard` sans resync).

Le dashboard **importe** `tools.generated.json` (committé) et rend une carte par
entrée. On n'édite jamais ce fichier à la main : on modifie un `lab.json` puis on
relance `bin/www-tools-sync`.

### Garde anti-dérive en CI

On ajoute un job `www_tools_guard` dans `.github/workflows/deploy.yml`, calqué
sur `shared_guard` : il rejoue `bin/www-tools-sync` et exige `git diff --quiet`.
Le job `deploy` le liste dans ses `needs` (comme `shared_guard`) et exige
`needs.www_tools_guard.result == 'success'`, si bien que toute dérive casse avant
le moindre deploy.

## Découpage & responsabilités

- `bin/www-tools-sync` — génère/vérifie la liste. Une seule responsabilité,
  testable en isolation (entrée : les `lab.json` ; sortie : le JSON).
- `src/tools.generated.json` — artefact généré, contrat entre le script et l'UI.
- `src/lib/auth.ts` — session déléguée (copie conforme du modèle skills).
- `src/components/site-header.tsx` — header dynamique (lit la session).
- `src/components/site-footer.tsx` — footer (avqn + styleguide).
- `src/app/page.tsx` — landing.
- `src/app/dashboard/page.tsx` — dashboard gardé + grille de cartes.

## Tests / vérification

Pas de base, pas de logique métier lourde → pas de suite unit dédiée (comme
`styleguide`). La vérification repose sur :

- `npm run build` (Next compile sans erreur de type) — joué en CI (job `test`) et
  en local.
- `bin/www-tools-sync --check` — garde la cohérence de la liste (job
  `www_tools_guard`).
- Vérif manuelle sur la **preview** : landing lisible déconnecté, header montre
  « Connexion », `/dashboard` accessible (court-circuit preview), cartes pointant
  vers les bons sous-domaines, footer correct.

## Déploiement

Inchangé : `git push` sur la branche → preview
`https://www-<branche>.preview.contentos.ch`. Merge → prod `https://contentos.ch`
+ `https://www.contentos.ch`. Jamais de commit sur `main`.

## Hors périmètre (YAGNI)

- Pas de scan auto de *tous* les projets (opt-in explicite via le bloc
  `dashboard`).
- Pas de contenu marketing riche (images héro, animations) — landing sobre,
  texte + primitives.
- Pas de gestion d'utilisateurs côté www (auth 100 % déléguée).
- Pas d'i18n (français uniquement, comme le reste de la suite).
