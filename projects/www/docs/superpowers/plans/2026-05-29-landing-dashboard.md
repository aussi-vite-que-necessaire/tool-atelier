# www — landing + dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformer `projects/www/` (serveur statique « hello world ») en app Next.js servant une landing publique de la suite contentos + un dashboard de raccourcis gardé par le SSO.

**Architecture:** App Next.js 16 App Router (sortie `standalone`, `:8080`), calquée sur `projects/styleguide`. Consomme le styleguide partagé `@contentos/ui` via `bin/ui-sync www`. Auth déléguée au SSO (`auth.contentos.ch`) en copiant le modèle `projects/skills`. La liste des raccourcis est matérialisée dans `www` par un nouveau script `bin/www-tools-sync` (opt-in via un bloc `dashboard` dans le `lab.json` de chaque outil), gardée en CI par un job `www_tools_guard`.

**Tech Stack:** Next.js 16, React 19, Tailwind v4, `@contentos/ui` (shadcn-style copié), `next-themes`, `next/font` (Geist), bash (script de sync), GitHub Actions.

---

## File Structure

**Plomberie projet (créés, calqués sur `styleguide`) :**
- `projects/www/package.json` — deps Next/React/UI + scripts.
- `projects/www/package-lock.json` — lockfile (généré par `npm install`).
- `projects/www/next.config.ts` — `output: "standalone"`.
- `projects/www/tsconfig.json` — alias `@/* → ./src/*`.
- `projects/www/postcss.config.mjs` — Tailwind v4.
- `projects/www/Dockerfile` — multi-stage deps→build→runner.
- `projects/www/public/robots.txt` — `Allow: /`.
- `projects/www/src/app/globals.css` — imports Tailwind + ui-tokens.
- `projects/www/src/app/layout.tsx` — html/body, polices Geist, Providers.
- `projects/www/src/app/providers.tsx` — `ThemeProvider` (light).
- `projects/www/src/styles/ui-tokens.css` — copié de `packages/ui`.
- `projects/www/src/app/healthz/route.ts` — 200 "ok".

**Code propre au projet (créés) :**
- `projects/www/src/lib/auth.ts` — session déléguée SSO (copie skills).
- `projects/www/src/lib/tools.ts` — type `Tool` + chargement du JSON généré.
- `projects/www/src/components/site-header.tsx` — header dynamique.
- `projects/www/src/components/site-footer.tsx` — footer avqn + styleguide.
- `projects/www/src/app/page.tsx` — landing.
- `projects/www/src/app/dashboard/page.tsx` — dashboard gardé.
- `projects/www/src/tools.generated.json` — artefact généré par le script.

**Généré dans le projet (par `bin/ui-sync www`) :**
- `projects/www/src/lib/utils.ts`, `projects/www/src/components/ui/*.tsx`.

**Atelier (créés/modifiés) :**
- `bin/www-tools-sync` — **créé** : génère/vérifie `tools.generated.json`.
- `projects/media/lab.json`, `projects/ressources/lab.json`, `projects/cast/lab.json`, `projects/skills/lab.json` — **modifiés** : ajout du bloc `dashboard`.
- `.github/workflows/deploy.yml` — **modifié** : job `www_tools_guard` + ajout aux `needs` de `deploy`.

**Supprimés :**
- `projects/www/server.js`, `projects/www/public/index.html`.

---

## Task 1 : Script `bin/www-tools-sync` (génération + check)

**Files:**
- Create: `bin/www-tools-sync`
- Modify: `projects/media/lab.json`, `projects/ressources/lab.json`, `projects/cast/lab.json`, `projects/skills/lab.json`
- Create (output): `projects/www/src/tools.generated.json`

Ce script est la fondation : il produit l'artefact que le dashboard importera. On le fait en premier pour que le JSON existe avant d'écrire l'UI.

- [ ] **Step 1 : Ajouter le bloc `dashboard` aux 4 lab.json**

`projects/media/lab.json` — ajouter la clé `dashboard` (le fichier est sur une ligne) :

```json
{ "description": "media (media.contentos.ch) — génération/édition d'image (Gemini), rendu HTML→image (Chromium partagé), API MCP + /v1.", "db": true, "browser": true, "migrate": "node scripts/migrate.mjs", "seed": "node scripts/seed.mjs", "dashboard": { "label": "media", "tagline": "Génération et édition de visuels", "order": 10 } }
```

`projects/ressources/lab.json` — ajouter la clé `dashboard` :

```json
{
  "description": "Plateforme de lead magnets (ressources.contentos.ch).",
  "db": true,
  "migrate": "node scripts/migrate.mjs",
  "seed": "node --import tsx db/seed.ts",
  "dashboard": { "label": "ressources", "tagline": "Lead magnets et ressources téléchargeables", "order": 20 }
}
```

`projects/cast/lab.json` — ajouter la clé `dashboard` :

```json
{
  "description": "Cast — atelier de publication LinkedIn (suite contentos), web + worker.",
  "db": true,
  "redis": true,
  "migrate": "node scripts/migrate.mjs",
  "worker": "node worker-runner.mjs",
  "images": ["web", "worker"],
  "dashboard": { "label": "cast", "tagline": "Publication LinkedIn assistée par l'IA", "order": 30 }
}
```

`projects/skills/lab.json` — ajouter la clé `dashboard` :

```json
{
  "description": "Hub central des skills agentiques de la suite de tools de l'atelier (contentos, ressources, media). Auth déléguée au SSO auth.contentos.ch.",
  "dashboard": { "label": "skills", "tagline": "Hub des skills agentiques de la suite", "order": 40 }
}
```

- [ ] **Step 2 : Écrire le script `bin/www-tools-sync`**

Create `bin/www-tools-sync` (calqué sur `bin/ui-sync` : commande par défaut = sync, `--check` = garde-fou ; utilise `jq` déjà présent en CI) :

```bash
#!/usr/bin/env bash
# www-tools-sync — matérialise la liste des raccourcis du dashboard de `www`.
#
# Le build Docker est scopé par projet (contexte = projects/www/) : `www` ne voit
# pas les autres `lab.json` au build ni au runtime. On suit donc le modèle ui-sync
# (vendoring) : ce script scanne projects/*/lab.json, extrait le bloc `dashboard`
# opt-in déclaré par chaque outil, et écrit projects/www/src/tools.generated.json.
# Ne pas éditer le JSON à la main : modifier un lab.json puis relancer ce script.
#
# Usage :
#   bin/www-tools-sync          (re)génère projects/www/src/tools.generated.json
#   bin/www-tools-sync --check  échoue (exit 1) si le fichier committé a dérivé
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/projects/www/src/tools.generated.json"

# Construit le JSON attendu : pour chaque projects/<p>/lab.json portant un bloc
# `dashboard`, émet { name, label, tagline, url, order }. URL = sous-domaine prod
# dérivé du nom de projet. Tri par (order, name). En-tête @generated via _generated.
render() {
  local entries="[]"
  for f in "$ROOT"/projects/*/lab.json; do
    [ -f "$f" ] || continue
    local proj; proj="$(basename "$(dirname "$f")")"
    # Garde uniquement les projets déclarant un objet `dashboard`.
    if [ "$(jq -r 'has("dashboard") and (.dashboard | type == "object")' "$f")" != "true" ]; then
      continue
    fi
    local entry
    entry="$(jq --arg proj "$proj" \
      '.dashboard | {
         name: $proj,
         label: (.label // $proj),
         tagline: (.tagline // ""),
         url: ("https://" + $proj + ".contentos.ch"),
         order: (.order // 100)
       }' "$f")"
    entries="$(jq --argjson e "$entry" '. + [$e]' <<<"$entries")"
  done
  jq -n --argjson tools "$entries" '{
    _generated: "Fichier généré par bin/www-tools-sync depuis les blocs `dashboard` des projects/*/lab.json. Ne pas éditer à la main : modifier un lab.json puis relancer bin/www-tools-sync.",
    tools: ($tools | sort_by(.order, .name))
  }'
}

case "${1:-}" in
  --check)
    if [ ! -f "$OUT" ]; then
      echo "✗ manquant: projects/www/src/tools.generated.json — lance bin/www-tools-sync" >&2
      exit 1
    fi
    if ! diff -q <(render) "$OUT" >/dev/null; then
      echo "✗ dérive: projects/www/src/tools.generated.json — relance bin/www-tools-sync" >&2
      diff <(render) "$OUT" || true
      exit 1
    fi
    echo "✓ projects/www/src/tools.generated.json est à jour"
    ;;
  "" )
    mkdir -p "$(dirname "$OUT")"
    render > "$OUT"
    echo "✓ écrit projects/www/src/tools.generated.json"
    ;;
  -h | --help)
    grep '^#' "$0" | sed 's/^# \{0,1\}//'
    ;;
  *)
    echo "www-tools-sync: argument inconnu: $1" >&2; exit 2
    ;;
esac
```

- [ ] **Step 3 : Rendre exécutable et générer**

Run:
```bash
chmod +x bin/www-tools-sync
bin/www-tools-sync
```
Expected: `✓ écrit projects/www/src/tools.generated.json`

- [ ] **Step 4 : Vérifier le contenu généré**

Run: `cat projects/www/src/tools.generated.json`
Expected: clé `_generated` + tableau `tools` avec 4 entrées (media/order 10, ressources/20, cast/30, skills/40), chacune avec `name`, `label`, `tagline`, `url` (`https://<name>.contentos.ch`), `order`.

- [ ] **Step 5 : Vérifier que `--check` passe (pas de dérive)**

Run: `bin/www-tools-sync --check`
Expected: `✓ projects/www/src/tools.generated.json est à jour` (exit 0)

- [ ] **Step 6 : Vérifier que `--check` détecte une dérive**

Run:
```bash
cp projects/www/src/tools.generated.json /tmp/tools.bak
printf '\n' >> projects/www/src/tools.generated.json
bin/www-tools-sync --check; echo "exit=$?"
cp /tmp/tools.bak projects/www/src/tools.generated.json
```
Expected: message `✗ dérive` et `exit=1`, puis restauration.

- [ ] **Step 7 : Commit**

```bash
git add bin/www-tools-sync projects/media/lab.json projects/ressources/lab.json projects/cast/lab.json projects/skills/lab.json projects/www/src/tools.generated.json
git commit -m "feat(www): bin/www-tools-sync + blocs dashboard dans les lab.json

Matérialise la liste des raccourcis du dashboard de www (build scopé par
projet → on vendore comme ui-sync). Opt-in via un bloc dashboard dans le
lab.json de media/ressources/cast/skills."
```

---

## Task 2 : Plomberie Next.js (calque styleguide)

**Files:**
- Create: `projects/www/package.json`, `next.config.ts`, `tsconfig.json`, `postcss.config.mjs`, `public/robots.txt`
- Create: `projects/www/src/app/globals.css`, `src/app/providers.tsx`, `src/app/layout.tsx`, `src/app/healthz/route.ts`
- Create (copié): `projects/www/src/styles/ui-tokens.css`
- Delete: `projects/www/server.js`, `projects/www/public/index.html`
- Generate: `projects/www/src/lib/utils.ts`, `src/components/ui/*` (via `bin/ui-sync www`)

- [ ] **Step 1 : Supprimer l'ancien site statique**

```bash
git rm projects/www/server.js projects/www/public/index.html
```

- [ ] **Step 2 : Créer `projects/www/package.json`**

```json
{
  "name": "www",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "@base-ui/react": "^1.5.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^1.16.0",
    "next": "16.2.6",
    "next-themes": "^0.4.6",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "shadcn": "^4.8.0",
    "sonner": "^2.0.7",
    "tailwind-merge": "^3.6.0",
    "tw-animate-css": "^1.4.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

- [ ] **Step 3 : Créer `projects/www/next.config.ts`**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sortie autonome : l'image Docker n'embarque que le serveur + les deps utiles.
  output: "standalone",
};

export default nextConfig;
```

- [ ] **Step 4 : Créer `projects/www/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts", ".next/dev/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 5 : Créer `projects/www/postcss.config.mjs`**

```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

- [ ] **Step 6 : Créer `projects/www/public/robots.txt`**

```
User-agent: *
Allow: /
```

- [ ] **Step 7 : Copier les tokens UI**

Run: `cp packages/ui/src/styles/tokens.css projects/www/src/styles/ui-tokens.css`
Expected: pas de sortie (fichier copié).

- [ ] **Step 8 : Créer `projects/www/src/app/globals.css`**

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";
@import "../styles/ui-tokens.css";
```

- [ ] **Step 9 : Créer `projects/www/src/app/providers.tsx`**

```tsx
'use client';

import { ThemeProvider } from 'next-themes';
import type * as React from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
```

- [ ] **Step 10 : Créer `projects/www/src/app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'contentos — suite d\'outils de contenu pour agents IA',
  description:
    'Suite d\'outils pilotés par des agents IA (Claude, GPT, Gemini) pour produire, planifier et publier du contenu social — en gardant le contrôle sur le pipe de production.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 11 : Créer `projects/www/src/app/healthz/route.ts`**

```ts
// Healthcheck : ne touche aucune ressource, répond toujours 200.
export const dynamic = "force-dynamic";

export function GET() {
  return new Response("ok", {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
```

- [ ] **Step 12 : Synchroniser les composants @contentos/ui**

Run: `bin/ui-sync www`
Expected: liste de `✓ src/components/ui/…` + `✓ src/lib/utils.ts`.

- [ ] **Step 13 : Installer les dépendances (génère le lockfile)**

Run: `cd projects/www && npm install`
Expected: `node_modules` créé + `package-lock.json` écrit. (Réseau requis ; si bloqué, voir note réseau en fin de plan.)

- [ ] **Step 14 : Commit (build vérifié dans la Task 5 une fois les pages écrites)**

```bash
cd "$(git rev-parse --show-toplevel)"
git add -A projects/www
git commit -m "feat(www): plomberie Next.js + @contentos/ui (remplace le statique)

Passe www du serveur statique à une app Next.js standalone calquée sur
styleguide : config, tokens, layout, providers, healthz, composants UI
synchronisés via bin/ui-sync."
```

---

## Task 3 : Lib auth + lib tools

**Files:**
- Create: `projects/www/src/lib/auth.ts`
- Create: `projects/www/src/lib/tools.ts`

- [ ] **Step 1 : Créer `projects/www/src/lib/auth.ts` (copie du modèle skills, redirect → /dashboard)**

```ts
// Auth déléguée au SSO de la suite — auth.contentos.ch.
// www n'a aucune donnée propre à l'utilisateur : l'auth sert uniquement de
// portail (être connecté pour voir le dashboard). On lit la session via un
// simple fetch HTTP vers le provider, en forwardant le cookie du browser (posé
// en cross-subdomain .contentos.ch). Aucun secret partagé, aucune table locale.

// URL du provider d'auth de la suite contentos. Défaut prod = auth.contentos.ch.
const AUTH_URL = process.env.AUTH_URL ?? "https://auth.contentos.ch";
// Origine publique de www (injectée par la plateforme). Sert de base au redirect.
const APP_URL = process.env.APP_URL ?? "http://localhost:8080";

// Le portail SSO n'est actif qu'en prod (APP_ENV='prod', posé par deploy.sh).
// En preview déployée (APP_ENV = slug de branche) comme en dev local (APP_ENV
// absent), on court-circuite : pas de auth.contentos.ch à joindre, accès ouvert.
const ssoEnabled = process.env.APP_ENV === "prod";

export type SessionUser = { id: string; email?: string };
export type Session = { user: SessionUser };

// Récupère la session via fetch HTTP vers auth.contentos.ch (cookie forwardé).
// Hors-prod, court-circuite avec une identité de preview.
export async function getSession(headers: Headers): Promise<Session | null> {
  if (!ssoEnabled) return { user: { id: "preview-user", email: "preview@www.local" } };
  const cookie = headers.get("cookie");
  if (!cookie) return null;
  const res = await fetch(`${AUTH_URL}/api/auth/get-session`, {
    headers: { cookie },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.user?.id ? { user: { id: data.user.id, email: data.user.email } } : null;
}

// URL de connexion du provider, avec retour vers le dashboard après login.
export function signInUrl(): string {
  return `${AUTH_URL}/sign-in?redirect=${encodeURIComponent(`${APP_URL}/dashboard`)}`;
}

// Page du provider (gère aussi la déconnexion via le cookie cross-domain).
export const authUrl = AUTH_URL;
```

- [ ] **Step 2 : Créer `projects/www/src/lib/tools.ts`**

```ts
// Liste des outils affichés sur le dashboard. La SOURCE est l'ensemble des blocs
// `dashboard` déclarés dans projects/*/lab.json, matérialisés dans
// src/tools.generated.json par bin/www-tools-sync (le build Docker est scopé par
// projet → on ne lit pas les autres lab.json à la volée). Ne pas éditer le JSON
// à la main : modifier un lab.json puis relancer bin/www-tools-sync.
import generated from "@/tools.generated.json";

export type Tool = {
  name: string;
  label: string;
  tagline: string;
  url: string;
  order: number;
};

export const tools: Tool[] = generated.tools;
```

- [ ] **Step 3 : Commit**

```bash
git add projects/www/src/lib/auth.ts projects/www/src/lib/tools.ts
git commit -m "feat(www): lib auth (SSO délégué) + lib tools (liste dashboard)"
```

---

## Task 4 : Header, footer, landing, dashboard

**Files:**
- Create: `projects/www/src/components/site-header.tsx`
- Create: `projects/www/src/components/site-footer.tsx`
- Create: `projects/www/src/app/page.tsx`
- Create: `projects/www/src/app/dashboard/page.tsx`

- [ ] **Step 1 : Créer `projects/www/src/components/site-header.tsx` (server component, lit la session)**

```tsx
import { headers } from 'next/headers';

import { Button } from '@/components/ui/button';
import { authUrl, getSession, signInUrl } from '@/lib/auth';

// Header partagé. Server component : lit la session côté serveur et adapte le
// coin haut-droite. Déconnecté → « Connexion » ; connecté → Dashboard + email +
// « Se déconnecter » (le provider gère le sign-out via le cookie cross-domain).
export async function SiteHeader() {
  const session = await getSession(await headers());

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-background/80 px-6 py-3 backdrop-blur">
      <a href="/" className="font-heading text-sm font-semibold tracking-tight">
        contentos
      </a>
      <nav className="flex items-center gap-2">
        {session ? (
          <>
            {session.user.email ? (
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {session.user.email}
              </span>
            ) : null}
            <Button variant="ghost" size="sm" render={<a href={authUrl} />}>
              Se déconnecter
            </Button>
            <Button size="sm" render={<a href="/dashboard" />}>
              Dashboard
            </Button>
          </>
        ) : (
          <Button size="sm" render={<a href={signInUrl()} />}>
            Connexion
          </Button>
        )}
      </nav>
    </header>
  );
}
```

- [ ] **Step 2 : Créer `projects/www/src/components/site-footer.tsx`**

```tsx
// Footer partagé : crédit auteur (Emmanuel Bernard / avqn.ch) + lien styleguide.
export function SiteFooter() {
  return (
    <footer className="border-t border-border px-6 py-8 text-sm text-muted-foreground">
      <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-2 sm:flex-row">
        <p>
          Projet exploratoire d'Emmanuel Bernard ·{' '}
          <a href="https://avqn.ch" className="underline underline-offset-4 hover:text-foreground">
            avqn.ch
          </a>
        </p>
        <a
          href="https://styleguide.contentos.ch"
          className="underline underline-offset-4 hover:text-foreground"
        >
          Styleguide
        </a>
      </div>
    </footer>
  );
}
```

- [ ] **Step 3 : Créer `projects/www/src/app/page.tsx` (landing publique)**

```tsx
import { headers } from 'next/headers';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Heading, Lead, Muted, Text } from '@/components/ui/typography';
import { getSession, signInUrl } from '@/lib/auth';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';

const productions = [
  { title: 'Posts', body: 'Rédaction de posts dans ta voix, prêts à relire et publier.' },
  { title: 'Images', body: 'Génération et édition de visuels pour accompagner le texte.' },
  { title: 'Carrousels', body: 'Séquences multi-slides cohérentes, pensées pour le scroll.' },
  { title: 'Vidéos', body: 'Formats courts générés à partir de ton contenu.' },
];

export default async function Home() {
  const session = await getSession(await headers());
  const ctaHref = session ? '/dashboard' : signInUrl();
  const ctaLabel = session ? 'Ouvrir le dashboard' : 'Se connecter';

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-16 px-6 py-16">
        {/* Hero */}
        <section className="space-y-4">
          <Heading level={1} className="text-4xl">
            Produire du contenu social, piloté par des agents IA.
          </Heading>
          <Lead className="max-w-2xl">
            contentos est une suite d'outils pensés pour être pilotés par des agents IA —
            Claude, GPT, Gemini — afin de produire, planifier et publier du contenu pour les
            réseaux sociaux.
          </Lead>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button render={<a href={ctaHref} />}>{ctaLabel}</Button>
            <Muted>Projet exploratoire — accès sur connexion.</Muted>
          </div>
        </section>

        {/* Pitch */}
        <section className="space-y-3">
          <Heading level={2}>L'idée</Heading>
          <Text className="max-w-2xl">
            Faciliter la production de contenu pour les réseaux sociaux en s'appuyant sur l'IA,
            sans perdre la main : un atelier où des agents font le gros du travail et où l'humain
            garde le dernier mot.
          </Text>
        </section>

        {/* Ce qu'on produit */}
        <section className="space-y-6">
          <Heading level={2}>Ce qu'on produit</Heading>
          <div className="grid gap-4 sm:grid-cols-2">
            {productions.map((p) => (
              <Card key={p.title}>
                <CardHeader>
                  <CardTitle>{p.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Text className="text-muted-foreground">{p.body}</Text>
                </CardContent>
              </Card>
            ))}
          </div>
          <Muted>Et la publication automatisée — planifiée, au bon moment.</Muted>
        </section>

        {/* Valeur cardinale */}
        <section className="space-y-3 rounded-xl border border-border bg-muted/30 p-6">
          <Heading level={2}>La valeur cardinale</Heading>
          <Lead className="max-w-2xl text-foreground">
            Garder le contrôle sur le pipe de production et augmenter la qualité de ce qui est
            livré.
          </Lead>
          <Text className="max-w-2xl text-muted-foreground">
            L'IA accélère et démultiplie ; l'humain cadre, arbitre et valide. Chaque étape reste
            inspectable et reprenable.
          </Text>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
```

- [ ] **Step 4 : Créer `projects/www/src/app/dashboard/page.tsx` (gardé SSO)**

```tsx
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { ArrowRightIcon } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Heading, Lead } from '@/components/ui/typography';
import { getSession, signInUrl } from '@/lib/auth';
import { tools } from '@/lib/tools';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';

export default async function Dashboard() {
  const session = await getSession(await headers());
  // Gate SSO : en prod, pas de session → on renvoie vers le provider. Hors-prod,
  // getSession court-circuite (identité de preview) et on passe.
  if (!session) redirect(signInUrl());

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-8 px-6 py-12">
        <div className="space-y-2">
          <Heading level={1}>Dashboard</Heading>
          <Lead>Les outils de la suite contentos.</Lead>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {tools.map((tool) => (
            <a
              key={tool.name}
              href={tool.url}
              className="group rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Card className="h-full transition-colors hover:border-foreground/30 hover:bg-muted/40">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {tool.label}
                    <ArrowRightIcon className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </CardTitle>
                  <CardDescription>{tool.tagline}</CardDescription>
                </CardHeader>
                <CardContent className="font-mono text-xs text-muted-foreground">
                  {tool.url.replace('https://', '')}
                </CardContent>
              </Card>
            </a>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
```

- [ ] **Step 5 : Commit**

```bash
git add projects/www/src/components projects/www/src/app/page.tsx projects/www/src/app/dashboard/page.tsx
git commit -m "feat(www): landing publique + dashboard SSO + header/footer

Landing qui pitche contentos (suite pilotée par agents IA, valeur cardinale =
contrôle du pipe + qualité), dashboard de raccourcis gardé par le SSO, header
dynamique selon session, footer avqn + styleguide."
```

---

## Task 5 : Build local + Dockerfile + healthz

**Files:**
- Create: `projects/www/Dockerfile`
- Verify: `npm run build`

- [ ] **Step 1 : Build Next en local (vérifie types + compile)**

Run: `cd projects/www && npm run build`
Expected: `✓ Compiled successfully`, routes `/`, `/dashboard`, `/healthz` listées, **0 erreur de type**. Si erreur, corriger avant de continuer (cf. systematic-debugging).

- [ ] **Step 2 : Créer `projects/www/Dockerfile` (copie de styleguide)**

```dockerfile
# syntax=docker/dockerfile:1

# --- deps : installe toutes les dépendances (le build a besoin des devDeps) ---
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

# --- build : compile l'app Next en sortie standalone ---
FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- runner : image finale slim (site public, pas de base ni de migrate) ---
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

RUN addgroup -S app && adduser -S app -G app

# Sortie standalone de Next : serveur + node_modules tracés.
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public

USER app
EXPOSE 8080

CMD ["node", "server.js"]
```

- [ ] **Step 3 : Commit**

```bash
cd "$(git rev-parse --show-toplevel)"
git add projects/www/Dockerfile
git commit -m "feat(www): Dockerfile multi-stage Next standalone (calque styleguide)"
```

---

## Task 6 : Garde-fou CI + CLAUDE.md

**Files:**
- Modify: `.github/workflows/deploy.yml`
- Modify: `projects/www/CLAUDE.md`

- [ ] **Step 1 : Ajouter le job `www_tools_guard` dans `.github/workflows/deploy.yml`**

Juste APRÈS le job `shared_guard` (avant le job `build`), insérer :

```yaml
  # Garde « liste du dashboard » : la liste des raccourcis de www est générée par
  # bin/www-tools-sync depuis les blocs `dashboard` des projects/*/lab.json. On
  # rejoue la génération et on exige l'absence de diff — toute dérive (édition
  # manuelle du JSON, ajout/retrait d'un bloc dashboard sans resync) casse ici.
  www_tools_guard:
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Vérifie la synchro de la liste du dashboard (bin/www-tools-sync)
        run: |
          bin/www-tools-sync --check
```

- [ ] **Step 2 : Brancher `www_tools_guard` sur le job `deploy`**

Dans le job `deploy`, modifier `needs:` et la condition `if:`.

Remplacer :
```yaml
    needs: [detect, build, test, shared_guard]
```
par :
```yaml
    needs: [detect, build, test, shared_guard, www_tools_guard]
```

Et dans le bloc `if:`, après la ligne `&& needs.shared_guard.result == 'success'`, ajouter :
```yaml
      && needs.www_tools_guard.result == 'success'
```

- [ ] **Step 3 : Valider la syntaxe YAML**

Run:
```bash
cd "$(git rev-parse --show-toplevel)"
python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/deploy.yml')); print('YAML OK')"
```
Expected: `YAML OK`

- [ ] **Step 4 : Réécrire `projects/www/CLAUDE.md`**

```markdown
# www — page d'accueil de contentos.ch

App **Next.js** servie sur **`contentos.ch`** et **`www.contentos.ch`** (deux hosts mappés sur
la même route Caddy par `deploy.sh`, cas spécial pour `www`).

- **`/`** — landing publique : pitch de la suite contentos (outils pilotés par des agents IA).
- **`/dashboard`** — raccourcis vers les outils (media, ressources, cast, skills), **gardé par
  le SSO** (`auth.contentos.ch`). Hors-prod (preview + local), accès ouvert (court-circuit).
- **`/healthz`** — 200, ne touche aucune ressource.

## Stack

- Next.js 16 App Router, sortie `standalone`, écoute `:8080`. Calque `styleguide`.
- **`@contentos/ui`** : composants copiés via `bin/ui-sync www` (ne pas éditer `src/components/ui/*`
  ni `src/lib/utils.ts` — modifier `packages/ui` puis resync).
- Auth déléguée au SSO (`src/lib/auth.ts`, modèle `skills`). Pas de base, pas d'email.

## Liste du dashboard — `bin/www-tools-sync`

Le build Docker est scopé par projet : `www` ne lit pas les autres `lab.json`. La liste des
raccourcis est donc **matérialisée** dans `src/tools.generated.json` par `bin/www-tools-sync`,
qui scanne les blocs `dashboard` opt-in déclarés dans `projects/*/lab.json` :

\`\`\`json
"dashboard": { "label": "media", "tagline": "Génération et édition de visuels", "order": 10 }
\`\`\`

- `bin/www-tools-sync` — (re)génère `src/tools.generated.json` (ne pas l'éditer à la main).
- `bin/www-tools-sync --check` — garde-fou CI (job `www_tools_guard`), échoue sur dérive.

Pour ajouter/retirer un outil : éditer le bloc `dashboard` du `lab.json` concerné, relancer
`bin/www-tools-sync`, committer.

## Déployer

Push de branche → preview `https://www-<branche>.preview.contentos.ch`. Merge → prod sur
`https://contentos.ch` + `https://www.contentos.ch`. Jamais de commit sur `main`.
```

- [ ] **Step 5 : Commit**

```bash
git add .github/workflows/deploy.yml projects/www/CLAUDE.md
git commit -m "ci(www): garde www_tools_guard + maj CLAUDE.md

Rejoue bin/www-tools-sync --check en CI (calque shared_guard) et branche le
job sur deploy. Documente la nouvelle structure de www."
```

---

## Task 7 : Push + PR preview

**Files:** aucun (livraison).

- [ ] **Step 1 : Vérifier l'état git**

Run: `git status && git log --oneline -7`
Expected: working tree clean, 6 commits de la feature au-dessus de la base.

- [ ] **Step 2 : Re-vérifier les gardes localement avant push**

Run:
```bash
cd "$(git rev-parse --show-toplevel)"
bin/www-tools-sync --check && bin/ui-sync --check www
```
Expected: `✓ … est à jour` pour les deux.

- [ ] **Step 3 : Push de la branche**

Run: `git push -u origin claude/busy-heisenberg-kN5VM`
(Retry réseau : 2s, 4s, 8s, 16s si échec.)

- [ ] **Step 4 : Ouvrir la PR (via GitHub MCP)**

Titre : `www : landing publique + dashboard SSO (Next.js + @contentos/ui)`
Corps : résumé de la feature, lien preview attendu `https://www-claude-busy-heisenberg-kn5vm.preview.contentos.ch`, note sur le slug exact à confirmer depuis le résumé du run CI.

- [ ] **Step 5 : Vérifier la CI**

Suivre le run `deploy` : jobs `detect`, `www_tools_guard`, `shared_guard`, `build` (www), `test` (www), `deploy`. Attendre le vert + l'URL de preview dans le résumé.

---

## Note réseau (dev en conteneur cloud)

`npm install` (Task 2 Step 13) et le build local (Task 5 Step 1) exigent l'accès au registre npm et aux polices Google (`next/font`). Si la politique réseau du conteneur les bloque, la vérification de build se fera en CI (job `test` + `build`) ; dans ce cas, committer `package-lock.json` dès qu'il peut être généré, et ne pas bloquer la livraison sur le build local — mais le signaler explicitement dans la PR.

## Vérification manuelle post-deploy (preview)

1. Ouvrir `https://www-<branche>.preview.contentos.ch/` déconnecté → landing lisible, header montre « Connexion », footer = avqn + styleguide.
2. `/dashboard` → accessible (court-circuit preview), 4 cartes (media, ressources, cast, skills) pointant vers `https://<projet>.contentos.ch`.
3. `/healthz` → `ok`.
