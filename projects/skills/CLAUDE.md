# skills — hub central des skills agentiques

Point d'entrée unique pour découvrir et installer les **skills agentiques** de la suite de
tools de l'atelier (contentos, ressources, media). Chaque skill est un cerveau / mode d'emploi
embarqué dans un agent Claude pour piloter le tool correspondant via MCP.

**Prod** : `https://skills.contentos.ch`.

## Stack — Astro SSR (Node)

Le projet tourne en **Astro 5** + **adapter `@astrojs/node`** (mode `standalone`), pas Next.js.
Choix volontaire pour un site front léger : **build ~1s** (vs ~7s sur Next), runtime slim
(entry `dist/server/entry.mjs` lancé par `node`). Pas de base de données, pas d'email : skills
ne stocke rien, l'auth est déléguée au SSO de la suite (cf. plus bas).

Une variante Astro du starter kit de l'atelier sera extraite dans un PR séparé
(`starters/base-astro/`).

## Structure

```
skills/
├── lab.json                       aucune capacité (ni db ni email — auth déléguée au SSO)
├── astro.config.mjs               output: "server" + adapter node (standalone) + Tailwind v4
├── src/
│   ├── pages/
│   │   ├── index.astro            liste des skills (SSR ; gate session + lit les manifestes)
│   │   ├── sign-in.astro          redirige vers le SSO (auth.contentos.ch/sign-in)
│   │   ├── healthz.ts             GET /healthz : 200 "ok"
│   │   └── api/
│   │       └── skills/[name]/download.ts   zip à la volée (session requise)
│   ├── lib/
│   │   ├── skills-fs.ts           lecture/listing des skills + manifestes
│   │   └── auth.ts                session déléguée au SSO (fetch get-session, cookie forwardé)
│   └── styles/global.css          Tailwind v4 (import unique)
└── skills/                        ← source de vérité des skills (un dossier par skill)
    ├── content-os-redaction/
    ├── creer-une-ressource/
    ├── creer-un-visuel/
    └── suite-avqn/
```

## Anatomie d'un skill

Chaque dossier `skills/<nom>/` contient :

```
manifest.json     # méta + version
SKILL.md          # entrée du skill (frontmatter YAML standard Claude)
...               # fichiers du skill (production/, references/, etc.)
```

`manifest.json` :

```json
{
  "name": "content-os-redaction",
  "tool": "contentos",
  "version": 1,
  "tagline": "Cerveau éditorial — écrire et relire dans la voix de Manu.",
  "description": "Court paragraphe affiché sur la page de liste.",
  "requires_mcp": ["contentos", "media"],
  "latest_changes": "Optionnel — 1-2 phrases sur ce qui change dans cette version."
}
```

- `tool` : `contentos` | `ressources` | `media` | `suite` (meta-skill). Sert au tri.
- `version` : entier. Le zip téléchargé prend le nom `<name>-v<version>.zip`.

## Publier une nouvelle version d'un skill

1. Éditer les fichiers du skill (`SKILL.md`, sous-dossiers).
2. **Bump** `version` dans `manifest.json` (`1` → `2` → `3`…).
3. Mettre à jour `latest_changes` (court).
4. Commit + push sur une branche → merge de la PR → la nouvelle version est en ligne sur
   `skills.contentos.ch`. Pas d'historique : seule la dernière version est servie.

## Ajouter un skill

1. Créer un dossier `skills/skills/<nom-skill>/` avec `manifest.json` + `SKILL.md` (et
   éventuelles sous-arbo).
2. La page d'accueil le découvre automatiquement (lecture des dossiers + manifestes).
3. Push + merge — c'est en ligne.

## Auth — déléguée au SSO (auth.contentos.ch)

Comme `cast` / `media` / `ressources`, skills ne gère plus d'utilisateurs : l'auth sert
uniquement de **portail** (être connecté pour voir la liste et télécharger). `src/lib/auth.ts`
lit la session via un `fetch` vers `${AUTH_URL}/api/auth/get-session` en forwardant le cookie du
browser (posé en cross-subdomain `.contentos.ch` par le provider). Aucun secret partagé, aucune
table locale, aucune base.

- **Prod** (`APP_ENV=prod`) : SSO actif. Pas de session → redirect vers
  `${AUTH_URL}/sign-in?redirect=<skills>`. « Se déconnecter » pointe sur `AUTH_URL` (le provider
  gère le sign-out via le cookie cross-domain).
- **Hors-prod** (preview déployée + dev local) : court-circuit, accès ouvert — pas de
  `auth.contentos.ch` à joindre.
- `AUTH_URL` : défaut `https://auth.contentos.ch` (surchargeable par env). `APP_URL` + `APP_ENV`
  injectés par la plateforme. Rien à poser dans `/lab-secret`.

## Standalone runtime

Le Dockerfile copie `dist/`, les `node_modules` de prod, et le dossier `skills/` (source de
vérité, lue à chaud par la route de téléchargement). Lancé par `node ./dist/server/entry.mjs`
sur `:8080`. Pas d'étape `migrate` (aucune base).

## Spec / plan

- Spec : `../docs/superpowers/specs/2026-05-28-skills-hub-design.md`.
- Plan : `../docs/superpowers/plans/2026-05-28-skills-hub.md`.

## Déployer

`git push` sur une branche → preview `https://skills-<branche>.preview.contentos.ch`. Merge de la PR
→ prod `https://skills.contentos.ch`. Jamais de commit sur `main`.
