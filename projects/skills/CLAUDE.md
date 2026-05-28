# skills — hub central des skills agentiques

Point d'entrée unique pour découvrir et installer les **skills agentiques** de la suite de
tools de l'atelier (contentos, ressources, media). Chaque skill est un cerveau / mode d'emploi
embarqué dans un agent Claude pour piloter le tool correspondant via MCP.

**Prod** : `https://skills.contentos.ch`.

## Stack — Astro SSR (Node)

Le projet tourne en **Astro 5** + **adapter `@astrojs/node`** (mode `standalone`), pas Next.js.
Choix volontaire pour un site front léger avec un peu d'auth : **build ~1s** (vs ~7s sur Next),
runtime slim (entry `dist/server/entry.mjs` lancé par `node`). BetterAuth est branché par un
handler unique sur `/api/auth/[...all]`, exactement comme avec Next.

Une variante Astro du starter kit de l'atelier sera extraite dans un PR séparé
(`starters/base-astro/` + module `auth` adapté).

## Structure

```
skills/
├── lab.json                       db + email (auth OTP only)
├── astro.config.mjs               output: "server" + adapter node (standalone) + Tailwind v4
├── src/
│   ├── pages/
│   │   ├── index.astro            liste publique des skills (SSR ; lit les manifestes)
│   │   ├── sign-in.astro          OTP par email (vanilla JS → REST BetterAuth)
│   │   ├── healthz.ts             GET /healthz : 200 "ok"
│   │   └── api/
│   │       ├── auth/[...all].ts   BetterAuth — toutes les routes REST
│   │       └── skills/[name]/download.ts   zip à la volée (auth requis)
│   ├── lib/
│   │   ├── skills-fs.ts           lecture/listing des skills + manifestes
│   │   ├── auth.ts                BetterAuth (emailOTP, drizzle adapter)
│   │   ├── auth-preview.ts        code preview "000000" sur hôtes *-<env>.preview.contentos.ch
│   │   └── email.ts               Resend (envoi du code)
│   ├── db/                        tables BetterAuth (user/session/account/verification)
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

## Auth

OTP par email (BetterAuth + Resend), même contrat que `contentos` / `ressources` / `media` :
- `BETTER_AUTH_SECRET` requis en prod (sinon BetterAuth refuse de démarrer). Posé dans
  `/lab-secret`, scope `skills`, valeur `openssl rand -base64 32`.
- Code preview `000000` quand l'hôte courant est `*-<env>.preview.contentos.ch` (preview).
- `DATABASE_URL` + `RESEND_API_KEY` + `EMAIL_FROM` + `APP_URL` injectés par la plateforme.

## Standalone runtime

Le Dockerfile copie `dist/`, les `node_modules` de prod, et le dossier `skills/` (source de
vérité, lue à chaud par la route de téléchargement). Lancé par `node ./dist/server/entry.mjs`
sur `:8080`.

## Spec / plan

- Spec : `../docs/superpowers/specs/2026-05-28-skills-hub-design.md`.
- Plan : `../docs/superpowers/plans/2026-05-28-skills-hub.md`.

## Déployer

`git push` sur une branche → preview `https://skills-<branche>.preview.contentos.ch`. Merge de la PR
→ prod `https://skills.contentos.ch`. Jamais de commit sur `main`.
