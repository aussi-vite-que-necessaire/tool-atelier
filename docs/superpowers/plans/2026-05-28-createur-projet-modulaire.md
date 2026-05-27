# Créateur de projets modulaire (/lab-new v2) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (exécution inline, l'auteur exécute lui-même cette nuit). Étapes en cases à cocher `- [ ]`.

**Goal:** Une skill `/lab-new` v2 qui compose un projet à la carte (base Next.js + modules `db`/`email`/`redis`/`auth`/`mcp`), écrit le thème à l'IA, et le déploie automatiquement jusqu'en prod.

**Architecture:** Une `starters/base/` Next.js+Tailwind déployable + des `starters/modules/<nom>/` additifs (manifeste `module.json` + fichiers). `scripts/compose-project.mjs` fusionne de façon déterministe (package.json, lab.json, .env.example), génère le barrel Drizzle et l'instance/`auth.ts`+client selon les méthodes choisies, copie les fichiers de chaque module. La skill pilote le wizard (questions → compose → thème IA → outils MCP IA → push → PR → merge → prod).

**Tech Stack:** Next.js 16 (App Router), Tailwind 4, Drizzle ORM + postgres, BetterAuth (emailOTP / emailAndPassword / magicLink / mcp), `mcp-handler` + `@modelcontextprotocol/sdk`, Resend, ioredis. Node test runner pour les tests de composition.

**Référence de code :** les fichiers déployables (Dockerfile, compose.yml, next.config, tsconfig, db/index.ts, migrate/seed, healthz, route auth, result/route/well-known MCP) dérivent **verbatim** de `starters/flagship/`, `media/` et `contentos/` déjà lus. Le plan montre le code **nouveau ou modifié** ; pour les fichiers repris tels quels il nomme la source exacte.

---

## Structure des fichiers

```
starters/base/                         # frontend-only déployable (Next + Tailwind)
  Dockerfile .dockerignore compose.yml next.config.ts tsconfig.json
  postcss.config.mjs .gitignore .env.example lab.json CLAUDE.md public/robots.txt
  src/app/{layout.tsx,page.tsx,globals.css,healthz/route.ts}
starters/modules/
  db/    { module.json, src/db/index.ts, drizzle.config.ts, scripts/{migrate,seed}.mjs }
  email/ { module.json, src/lib/email.ts }
  redis/ { module.json, src/lib/redis.ts }
  auth/  { module.json, src/db/schemas/auth.ts, src/lib/auth-preview.ts,
           src/app/sign-in/page.tsx, src/app/api/auth/[...all]/route.ts }
  mcp/   { module.json, src/lib/mcp/{server,result,auth}.ts, src/lib/mcp/tools/ping.ts,
           src/app/api/mcp/route.ts, src/app/.well-known/{oauth-authorization-server,oauth-protected-resource}/route.ts }
scripts/compose-project.mjs            # le compositeur déterministe
test/compose-project.test.mjs          # tests de composition (Node test runner)
.claude/skills/lab-new/SKILL.md        # wizard réécrit
```

`src/db/schema.ts`, `src/lib/auth.ts`, `src/lib/auth-client.ts`, `src/lib/auth-methods.ts` ne sont **pas** versionnés dans les modules : `compose-project.mjs` les **génère** dans le projet.

---

## Task 1 : Base template `starters/base/`

**Files:** Create tous les fichiers de `starters/base/` (voir structure).

- [ ] **Step 1 — Copier le squelette déployable depuis flagship.** Reprendre **verbatim** depuis `starters/flagship/` : `Dockerfile`, `.dockerignore`, `compose.yml`, `next.config.ts`, `tsconfig.json`, `postcss.config.mjs`, `.gitignore`, `public/robots.txt`, `src/app/healthz/route.ts`, `src/app/layout.tsx`.

- [ ] **Step 2 — `starters/base/package.json`** (flagship sans drizzle/better-auth) :

```json
{
  "name": "__PROJECT_NAME__",
  "private": true,
  "type": "module",
  "scripts": { "dev": "next dev", "build": "next build", "start": "next start", "lint": "next lint" },
  "dependencies": { "next": "^16.2.6", "react": "^19.2.6", "react-dom": "^19.2.6" },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.3.0", "@types/node": "^25.9.1",
    "@types/react": "^19.2.15", "@types/react-dom": "^19.2.3",
    "tailwindcss": "^4.3.0", "typescript": "^6.0.3"
  }
}
```

- [ ] **Step 3 — `starters/base/lab.json`** : `{ "description": "__DESCRIPTION__" }`

- [ ] **Step 4 — `starters/base/.env.example`** :

```
# Injecté automatiquement par la plateforme au déploiement (ne pas remplir) :
# APP_URL=https://<projet>.lab.avqn.ch
```

- [ ] **Step 5 — `starters/base/src/app/globals.css`** (couture de thème `@theme` que l'IA remplit) :

```css
@import "tailwindcss";

/* @theme : tokens de design générés par l'étape thème du wizard.
   Valeurs par défaut neutres ; l'IA réécrit ce bloc selon l'ambiance décrite. */
@theme {
  --color-brand-50: #f5f7fa;
  --color-brand-500: #4f46e5;
  --color-brand-600: #4338ca;
  --color-brand-900: #1e1b4b;
  --font-sans: ui-sans-serif, system-ui, sans-serif;
}

:root { color-scheme: light dark; }
```

- [ ] **Step 6 — `starters/base/src/app/page.tsx`** (landing générique consommant les tokens) :

```tsx
export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-4xl font-bold tracking-tight text-brand-600 sm:text-5xl">__PROJECT_NAME__</h1>
      <p className="text-lg text-zinc-500 dark:text-zinc-400">__DESCRIPTION__</p>
    </main>
  );
}
```

- [ ] **Step 7 — `starters/base/CLAUDE.md`** : gabarit court (nom, but, « projet généré par /lab-new, déviable »). Placeholders `__PROJECT_NAME__` / `__DESCRIPTION__`.

- [ ] **Step 8 — Vérifier le build de la base seule.** Run : `cd /tmp && rm -rf base-check && cp -r <atelier>/starters/base base-check && cd base-check && npm install && npm run build`. Expected : build Next réussi (route `/` + `/healthz`).

- [ ] **Step 9 — Commit.** `git add starters/base && git commit -m "🤖 starter: base Next.js+Tailwind composable"`

---

## Task 2 : Compositeur `scripts/compose-project.mjs` (TDD)

**Files:** Create `scripts/compose-project.mjs`, `test/compose-project.test.mjs`.

- [ ] **Step 1 — Écrire les tests d'abord** `test/compose-project.test.mjs` (Node test runner ; composent dans un répertoire temporaire). Couvre la résolution de cascade + les sorties clés :

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { compose, resolveModules } from "../scripts/compose-project.mjs";

async function tmp() { return fs.mkdtemp(path.join(os.tmpdir(), "compose-")); }
const read = (d, f) => fs.readFile(path.join(d, f), "utf8");
const readJson = async (d, f) => JSON.parse(await read(d, f));

test("cascade : mcp tire auth + db ; otp tire email", async () => {
  assert.deepEqual(await resolveModules(["mcp"], ["otp"]), ["db", "email", "auth", "mcp"]);
  assert.deepEqual(await resolveModules(["auth"], ["password"]), ["db", "auth"]);
  assert.deepEqual(await resolveModules([], []), []);
});

test("frontend only : base copiée, lab.json sans capacité", async () => {
  const outDir = path.join(await tmp(), "app");
  await compose({ name: "demo-front", description: "Démo", modules: [], outDir });
  const lab = await readJson(outDir, "lab.json");
  assert.equal(lab.description, "Démo");
  assert.equal(lab.db, undefined);
  const pkg = await readJson(outDir, "package.json");
  assert.equal(pkg.name, "demo-front");
  assert.ok(!pkg.dependencies["better-auth"]);
});

test("db + redis : flags lab.json + deps fusionnées", async () => {
  const outDir = path.join(await tmp(), "app");
  await compose({ name: "demo-data", description: "x", modules: ["db", "redis"], outDir });
  const lab = await readJson(outDir, "lab.json");
  assert.equal(lab.db, true);
  assert.equal(lab.redis, true);
  const pkg = await readJson(outDir, "package.json");
  assert.ok(pkg.dependencies["drizzle-orm"]);
  assert.ok(pkg.dependencies["ioredis"]);
  const schema = await read(outDir, "src/db/schema.ts");
  assert.match(schema, /export const schema = \{\s*\}/); // db sans auth = schéma vide
});

test("full : auth 3 méthodes + mcp → auth.ts contient les bons plugins", async () => {
  const outDir = path.join(await tmp(), "app");
  await compose({
    name: "demo-full", description: "x",
    modules: ["db", "redis", "auth", "mcp"],
    authMethods: ["otp", "password", "magic-link"],
    mcp: { server: "demo", instructions: "Démo." },
    outDir,
  });
  const lab = await readJson(outDir, "lab.json");
  assert.equal(lab.email, true); // auto via otp/magic-link
  const auth = await read(outDir, "src/lib/auth.ts");
  assert.match(auth, /emailAndPassword:\s*\{\s*enabled:\s*true/);
  assert.match(auth, /emailOTP\(/);
  assert.match(auth, /magicLink\(/);
  assert.match(auth, /mcp\(/);
  const client = await read(outDir, "src/lib/auth-client.ts");
  assert.match(client, /emailOTPClient\(\)/);
  assert.match(client, /magicLinkClient\(\)/);
  const schema = await read(outDir, "src/db/schema.ts");
  assert.match(schema, /user, session, account, verification/);
  await fs.access(path.join(outDir, "src/app/api/mcp/route.ts"));
  await fs.access(path.join(outDir, "src/app/.well-known/oauth-protected-resource/route.ts"));
});

test("otp seul n'importe pas emailAndPassword ni magicLink", async () => {
  const outDir = path.join(await tmp(), "app");
  await compose({ name: "demo-otp", description: "x", modules: ["auth"], authMethods: ["otp"], outDir });
  const auth = await read(outDir, "src/lib/auth.ts");
  assert.doesNotMatch(auth, /emailAndPassword/);
  assert.doesNotMatch(auth, /magicLink\(/);
  assert.match(auth, /emailOTP\(/);
});
```

- [ ] **Step 2 — Lancer les tests, vérifier l'échec.** Run : `node --test test/compose-project.test.mjs`. Expected : FAIL (module introuvable / compose non défini).

- [ ] **Step 3 — Écrire `scripts/compose-project.mjs`.** Contenu complet :

```js
#!/usr/bin/env node
// Compose un projet de l'atelier depuis starters/base + starters/modules/<nom>.
// Déterministe : fusionne package.json, lab.json, .env.example, génère le barrel
// Drizzle + l'instance/le client auth, copie les fichiers de chaque module.
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const STARTERS = path.join(ROOT, "starters");
const MODULE_ORDER = ["db", "email", "redis", "auth", "mcp"];

export async function loadManifest(name) {
  return JSON.parse(await fs.readFile(path.join(STARTERS, "modules", name, "module.json"), "utf8"));
}

export async function resolveModules(selected, authMethods = []) {
  const set = new Set(selected);
  if (set.has("mcp")) { set.add("auth"); set.add("db"); }
  if (set.has("auth")) {
    set.add("db");
    if (authMethods.includes("otp") || authMethods.includes("magic-link")) set.add("email");
  }
  return MODULE_ORDER.filter((m) => set.has(m));
}

async function writeJson(p, obj) { await fs.writeFile(p, JSON.stringify(obj, null, 2) + "\n"); }

function fill(s, name, description) {
  return s.replaceAll("__PROJECT_NAME__", name).replaceAll("__DESCRIPTION__", description);
}

export async function compose({ name, description, modules = [], authMethods = [], mcp = null, outDir }) {
  if (!/^[a-z][a-z0-9-]*$/.test(name)) throw new Error(`nom de projet invalide: ${name}`);
  const dst = outDir ?? path.join(ROOT, name);
  await fs.cp(path.join(STARTERS, "base"), dst, { recursive: true });

  const resolved = await resolveModules(modules, authMethods);
  const manifests = [];
  for (const m of resolved) manifests.push(await loadManifest(m));

  // package.json
  const pkgPath = path.join(dst, "package.json");
  const pkg = JSON.parse(await fs.readFile(pkgPath, "utf8"));
  pkg.name = name;
  for (const man of manifests) {
    Object.assign((pkg.dependencies ??= {}), man.deps ?? {});
    Object.assign((pkg.devDependencies ??= {}), man.devDeps ?? {});
    Object.assign((pkg.scripts ??= {}), man.scripts ?? {});
  }
  await writeJson(pkgPath, pkg);

  // lab.json
  const labPath = path.join(dst, "lab.json");
  const lab = JSON.parse(fill(await fs.readFile(labPath, "utf8"), name, description));
  for (const man of manifests) Object.assign(lab, man.labJson ?? {});
  await writeJson(labPath, lab);

  // .env.example
  const envKeys = manifests.flatMap((m) => m.env ?? []);
  if (envKeys.length) {
    const cur = await fs.readFile(path.join(dst, ".env.example"), "utf8");
    await fs.writeFile(path.join(dst, ".env.example"), cur + "\n" + envKeys.map((e) => `${e}=`).join("\n") + "\n");
  }

  // fichiers texte avec placeholders (page, CLAUDE.md de la base)
  for (const rel of ["src/app/page.tsx", "CLAUDE.md"]) {
    const p = path.join(dst, rel);
    await fs.writeFile(p, fill(await fs.readFile(p, "utf8"), name, description));
  }

  // copie des fichiers de modules
  for (const man of manifests) {
    const modDir = path.join(STARTERS, "modules", man.name);
    for (const rel of man.files ?? []) {
      const to = path.join(dst, rel);
      await fs.mkdir(path.dirname(to), { recursive: true });
      await fs.cp(path.join(modDir, rel), to, { recursive: true });
    }
  }

  // barrel Drizzle (si db)
  if (resolved.includes("db")) {
    const frags = manifests.flatMap((m) => m.schemas ?? []);
    const body = frags.length
      ? frags.map((f) => `import { ${f.exports.join(", ")} } from "${f.import}";`).join("\n") +
        `\n\nexport const schema = { ${frags.flatMap((f) => f.exports).join(", ")} };\n`
      : `export const schema = {};\n`;
    await fs.writeFile(path.join(dst, "src/db/schema.ts"), body);
  }

  // auth générée (si auth)
  if (resolved.includes("auth")) {
    const hasMcp = resolved.includes("mcp");
    await fs.writeFile(path.join(dst, "src/lib/auth.ts"), renderAuthFile({ methods: authMethods, hasMcp, name }));
    await fs.writeFile(path.join(dst, "src/lib/auth-client.ts"), renderAuthClient({ methods: authMethods }));
    await fs.writeFile(path.join(dst, "src/lib/auth-methods.ts"), `export const AUTH_METHODS = ${JSON.stringify(authMethods)} as const;\n`);
  }

  return { dir: dst, modules: resolved };
}

export function renderAuthFile({ methods, hasMcp, name }) {
  const otp = methods.includes("otp");
  const magic = methods.includes("magic-link");
  const password = methods.includes("password");
  const pluginImports = [otp && "emailOTP", magic && "magicLink", hasMcp && "mcp"].filter(Boolean);
  const lines = [];
  lines.push(`import { betterAuth } from "better-auth";`);
  lines.push(`import { drizzleAdapter } from "better-auth/adapters/drizzle";`);
  if (pluginImports.length) lines.push(`import { ${pluginImports.join(", ")} } from "better-auth/plugins";`);
  lines.push(`import { db } from "@/db";`);
  lines.push(`import { schema } from "@/db/schema";`);
  if (otp || magic) lines.push(`import { sendEmail } from "@/lib/email";`);
  if (otp) lines.push(`import { isPreview, PREVIEW_OTP } from "@/lib/auth-preview";`);
  lines.push("");
  lines.push(`const baseURL = process.env.APP_URL ?? "http://localhost:3000";`);
  lines.push("");
  lines.push(`export const auth = betterAuth({`);
  lines.push(`  database: drizzleAdapter(db, { provider: "pg", schema }),`);
  lines.push(`  secret: process.env.BETTER_AUTH_SECRET,`);
  lines.push(`  baseURL,`);
  lines.push(`  trustedOrigins: [baseURL],`);
  if (password) lines.push(`  emailAndPassword: { enabled: true },`);
  const plugins = [];
  if (otp) plugins.push(
`    emailOTP({
      otpLength: 6,
      expiresIn: 600,
      ...(isPreview ? { generateOTP: () => PREVIEW_OTP } : {}),
      async sendVerificationOTP({ email, otp }) {
        if (isPreview) return;
        await sendEmail({ to: email, subject: "Ton code de connexion", html: \`<p>Ton code : <b>\${otp}</b> (expire dans 10 minutes).</p>\` });
      },
    })`);
  if (magic) plugins.push(
`    magicLink({
      async sendMagicLink({ email, url }) {
        await sendEmail({ to: email, subject: "Ton lien de connexion", html: \`<p><a href="\${url}">Se connecter</a> (expire bientôt).</p>\` });
      },
    })`);
  if (hasMcp) plugins.push(
`    mcp({
      loginPage: "/sign-in",
      oidcConfig: { loginPage: "/sign-in", allowDynamicClientRegistration: true, requirePKCE: true },
    })`);
  if (plugins.length) { lines.push(`  plugins: [`); lines.push(plugins.join(",\n")); lines.push(`  ],`); }
  lines.push(`});`);
  lines.push("");
  lines.push(`export type Session = typeof auth.$Infer.Session;`);
  return lines.join("\n") + "\n";
}

export function renderAuthClient({ methods }) {
  const otp = methods.includes("otp");
  const magic = methods.includes("magic-link");
  const clientPlugins = [otp && "emailOTPClient", magic && "magicLinkClient"].filter(Boolean);
  const lines = [`"use client";`, ""];
  if (clientPlugins.length) lines.push(`import { ${clientPlugins.join(", ")} } from "better-auth/client/plugins";`);
  lines.push(`import { createAuthClient } from "better-auth/react";`, "");
  const inst = clientPlugins.length ? `{ plugins: [${clientPlugins.map((p) => p + "()").join(", ")}] }` : "";
  lines.push(`export const authClient = createAuthClient(${inst});`, "");
  lines.push(`export const { signIn, signUp, signOut, useSession } = authClient;`);
  return lines.join("\n") + "\n";
}
```

- [ ] **Step 4 — Lancer les tests.** Run : `node --test test/compose-project.test.mjs`. Expected : les tests qui ne dépendent que de la base + cascade passent ; ceux dépendant de modules échoueront tant que les modules n'existent pas (Tasks 3-7). Commit le compositeur + tests maintenant.

- [ ] **Step 5 — Commit.** `git add scripts/compose-project.mjs test/compose-project.test.mjs && git commit -m "🤖 compose: compositeur de projets + tests"`

---

## Task 3 : Module `db`

**Files:** `starters/modules/db/module.json` + `src/db/index.ts`, `drizzle.config.ts`, `scripts/migrate.mjs`, `scripts/seed.mjs`.

- [ ] **Step 1 — `module.json`** :

```json
{
  "name": "db",
  "requires": [],
  "labJson": { "db": true, "migrate": "node scripts/migrate.mjs", "seed": "node scripts/seed.mjs" },
  "deps": { "drizzle-orm": "^0.45.2", "postgres": "^3.4.9" },
  "devDeps": { "drizzle-kit": "^0.31.10" },
  "scripts": { "db:generate": "drizzle-kit generate", "db:studio": "drizzle-kit studio", "migrate": "node scripts/migrate.mjs", "seed": "node scripts/seed.mjs" },
  "env": [],
  "files": ["src/db/index.ts", "drizzle.config.ts", "scripts/migrate.mjs", "scripts/seed.mjs"],
  "schemas": []
}
```

- [ ] **Step 2 — Fichiers** : reprendre **verbatim** depuis flagship : `src/db/index.ts`, `drizzle.config.ts`, `scripts/migrate.mjs`, `scripts/seed.mjs`. (Ne **pas** inclure `schema.ts` : généré par le compositeur.)

- [ ] **Step 3 — Lancer les tests db.** Run : `node --test test/compose-project.test.mjs`. Expected : « db + redis » passe sa partie db (deps drizzle, schéma vide).

- [ ] **Step 4 — Commit.** `git add starters/modules/db && git commit -m "🤖 module: db (Drizzle + postgres)"`

---

## Task 4 : Module `email`

**Files:** `starters/modules/email/module.json` + `src/lib/email.ts`.

- [ ] **Step 1 — `module.json`** :

```json
{
  "name": "email", "requires": [],
  "labJson": { "email": true },
  "deps": { "resend": "^6.12.3" }, "devDeps": {},
  "scripts": {}, "env": [],
  "files": ["src/lib/email.ts"], "schemas": []
}
```

- [ ] **Step 2 — `src/lib/email.ts`** (générique, fallback console sans clé) :

```ts
import { Resend } from "resend";

export type EmailMessage = { to: string; subject: string; html: string; text?: string };

// Envoi transactionnel via Resend (RESEND_API_KEY + EMAIL_FROM injectés par la
// plateforme quand lab.json email:true). Sans clé (dev/preview), logge côté serveur.
export async function sendEmail({ to, subject, html, text }: EmailMessage): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "onboarding@resend.dev";
  if (!apiKey) { console.log(`[email] -> ${to} : ${subject}\n${text ?? html}`); return; }
  const { error } = await new Resend(apiKey).emails.send({ from, to, subject, html, text: text ?? "" });
  if (error) throw new Error(`Resend: ${error.message ?? JSON.stringify(error)}`);
}
```

- [ ] **Step 3 — Commit.** `git add starters/modules/email && git commit -m "🤖 module: email (Resend)"`

---

## Task 5 : Module `redis`

**Files:** `starters/modules/redis/module.json` + `src/lib/redis.ts`.

- [ ] **Step 1 — `module.json`** :

```json
{
  "name": "redis", "requires": [],
  "labJson": { "redis": true },
  "deps": { "ioredis": "^5.4.1" }, "devDeps": {},
  "scripts": {}, "env": [],
  "files": ["src/lib/redis.ts"], "schemas": []
}
```

- [ ] **Step 2 — `src/lib/redis.ts`** (client paresseux + helper de préfixe) :

```ts
import Redis from "ioredis";

// Connexion paresseuse : REDIS_URL/REDIS_PREFIX injectés au runtime par la plateforme.
let _redis: Redis | null = null;

export function getRedis(): Redis {
  if (_redis) return _redis;
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL manquant");
  _redis = new Redis(url);
  return _redis;
}

// Préfixe les clés par projet/env (REDIS_PREFIX = "<projet>:<env>:").
export function key(name: string): string {
  return `${process.env.REDIS_PREFIX ?? ""}${name}`;
}
```

- [ ] **Step 3 — Commit.** `git add starters/modules/redis && git commit -m "🤖 module: redis (ioredis)"`

---

## Task 6 : Module `auth`

**Files:** `starters/modules/auth/module.json` + `src/db/schemas/auth.ts`, `src/lib/auth-preview.ts`, `src/app/sign-in/page.tsx`, `src/app/api/auth/[...all]/route.ts`.

- [ ] **Step 1 — `module.json`** (déclare le fragment de schéma + requiert db) :

```json
{
  "name": "auth", "requires": ["db"],
  "labJson": {},
  "deps": { "better-auth": "^1.6.11" }, "devDeps": {},
  "scripts": {}, "env": ["BETTER_AUTH_SECRET"],
  "files": ["src/db/schemas/auth.ts", "src/lib/auth-preview.ts", "src/app/sign-in/page.tsx", "src/app/api/auth/[...all]/route.ts"],
  "schemas": [{ "import": "./schemas/auth", "exports": ["user", "session", "account", "verification"] }]
}
```

- [ ] **Step 2 — `src/db/schemas/auth.ts`** : reprendre les 4 tables `user/session/account/verification` de `starters/flagship/src/db/schema.ts` **sans** la ligne `export const schema = {...}` (le barrel est généré). Exporter chaque table.

- [ ] **Step 3 — `src/lib/auth-preview.ts`** (auto-login preview, repris de contentos) :

```ts
// Auto-login preview : code OTP déterministe accepté hors prod (jamais en prod).
export const PREVIEW_USER = "preview@local";
export const PREVIEW_OTP = "000000";

// Preview = déployé non-prod (APP_ENV = slug de branche). Prod : APP_ENV === "prod".
export function isPreviewEnv(appEnv: string | undefined): boolean {
  return !!appEnv && appEnv !== "prod";
}
export const isPreview = isPreviewEnv(process.env.APP_ENV);
```

- [ ] **Step 4 — `src/app/api/auth/[...all]/route.ts`** : reprendre **verbatim** depuis flagship.

- [ ] **Step 5 — `src/app/sign-in/page.tsx`** : page adaptative pilotée par `AUTH_METHODS` (généré). Importe `signIn`, `signUp`, `authClient` de `@/lib/auth-client` et `AUTH_METHODS` de `@/lib/auth-methods`. Affiche une section par méthode active :

```tsx
"use client";
import { useState } from "react";
import { AUTH_METHODS } from "@/lib/auth-methods";
import { authClient, signIn, signUp } from "@/lib/auth-client";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const has = (m: string) => (AUTH_METHODS as readonly string[]).includes(m);
  const input = "w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 dark:border-zinc-700";
  const btn = "w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-500 disabled:opacity-50";

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-8 px-6">
      <h1 className="text-center text-2xl font-bold tracking-tight">Se connecter</h1>
      <input className={input} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />

      {has("otp") && (
        <section className="space-y-3">
          {!otpSent ? (
            <button className={btn} disabled={!email} onClick={async () => {
              await authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" });
              setOtpSent(true); setMsg("Code envoyé (000000 en preview).");
            }}>Recevoir un code</button>
          ) : (
            <>
              <input className={input + " text-center font-mono tracking-[0.4em]"} inputMode="numeric" placeholder="000000" value={otp} onChange={(e) => setOtp(e.target.value)} />
              <button className={btn} disabled={otp.length < 6} onClick={async () => {
                const r = await signIn.emailOtp({ email, otp }); setMsg(r.error ? "Code invalide." : "Connecté."); if (!r.error) location.href = "/";
              }}>Valider le code</button>
            </>
          )}
        </section>
      )}

      {has("magic-link") && (
        <section className="space-y-3">
          <button className={btn} disabled={!email} onClick={async () => {
            await authClient.signIn.magicLink({ email, callbackURL: "/" }); setMsg("Lien envoyé par email.");
          }}>Recevoir un lien magique</button>
        </section>
      )}

      {has("password") && (
        <section className="space-y-3">
          <input className={input} type="password" placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} />
          <div className="flex gap-2">
            <button className={btn} disabled={!email || password.length < 8} onClick={async () => {
              const r = await signIn.email({ email, password }); setMsg(r.error ? "Échec." : "Connecté."); if (!r.error) location.href = "/";
            }}>Connexion</button>
            <button className={btn} disabled={!email || password.length < 8} onClick={async () => {
              const r = await signUp.email({ email, password, name: email.split("@")[0] }); setMsg(r.error ? "Échec." : "Compte créé."); if (!r.error) location.href = "/";
            }}>Créer un compte</button>
          </div>
        </section>
      )}

      {msg && <p className="text-center text-sm text-zinc-500">{msg}</p>}
    </main>
  );
}
```

- [ ] **Step 6 — Lancer les tests auth.** Run : `node --test test/compose-project.test.mjs`. Expected : « full », « otp seul » passent (auth.ts/client générés corrects, schéma barrel avec les 4 tables).

- [ ] **Step 7 — Commit.** `git add starters/modules/auth && git commit -m "🤖 module: auth (OTP/mot de passe/magic-link, auto-login preview)"`

---

## Task 7 : Module `mcp`

**Files:** `starters/modules/mcp/module.json` + `src/lib/mcp/{server,result,auth}.ts`, `src/lib/mcp/tools/ping.ts`, `src/app/api/mcp/route.ts`, `src/app/.well-known/{oauth-authorization-server,oauth-protected-resource}/route.ts`.

- [ ] **Step 1 — `module.json`** :

```json
{
  "name": "mcp", "requires": ["auth", "db"],
  "labJson": {},
  "deps": { "mcp-handler": "^1.1.0", "@modelcontextprotocol/sdk": "^1.26.0", "zod": "^4.4.3" },
  "devDeps": {}, "scripts": {}, "env": [],
  "files": [
    "src/lib/mcp/server.ts", "src/lib/mcp/result.ts", "src/lib/mcp/auth.ts", "src/lib/mcp/tools/ping.ts",
    "src/app/api/mcp/route.ts",
    "src/app/.well-known/oauth-authorization-server/route.ts",
    "src/app/.well-known/oauth-protected-resource/route.ts"
  ],
  "schemas": []
}
```

- [ ] **Step 2 — `.well-known/*` + `api/auth` MCP** : reprendre **verbatim** depuis `media/src/app/.well-known/oauth-authorization-server/route.ts` et `.../oauth-protected-resource/route.ts`.

- [ ] **Step 3 — `src/lib/mcp/result.ts`** (version générique, texte JSON seulement) :

```ts
export function jsonResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
}
```

- [ ] **Step 4 — `src/lib/mcp/auth.ts`** : reprendre `media/src/lib/mcp/auth.ts`, `clientId` fallback `"mcp"`.

- [ ] **Step 5 — `src/lib/mcp/server.ts`** (registre + outil ping ; INSTRUCTIONS et outils réécrits par l'IA au wizard) :

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPing } from "./tools/ping";

// INSTRUCTIONS : décrit le serveur pour l'agent IA. Réécrit par /lab-new selon le projet.
export const INSTRUCTIONS = "Serveur MCP du projet. Décris ici ce qu'il permet de faire.";

export function registerAllTools(server: McpServer): void {
  registerPing(server);
}
```

- [ ] **Step 6 — `src/lib/mcp/tools/ping.ts`** :

```ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { jsonResult } from "../result";

export function registerPing(server: McpServer): void {
  server.registerTool(
    "ping",
    { description: "Vérifie que le serveur MCP répond.", inputSchema: {} },
    async () => jsonResult({ ok: true, ts: Date.now() }),
  );
}
```

- [ ] **Step 7 — `src/app/api/mcp/route.ts`** (adapté de media, `serverInfo.name` générique) :

```ts
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { verifyMcpToken } from "@/lib/mcp/auth";
import { registerAllTools, INSTRUCTIONS } from "@/lib/mcp/server";

const base = createMcpHandler(
  (server) => registerAllTools(server),
  { serverInfo: { name: "mcp", version: "1" }, instructions: INSTRUCTIONS },
  { basePath: "/api" },
);

const handler = withMcpAuth(base, (req) => verifyMcpToken(req), {
  required: true,
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
});

export { handler as GET, handler as POST, handler as DELETE };
```

- [ ] **Step 8 — Lancer tous les tests.** Run : `node --test test/compose-project.test.mjs`. Expected : tous PASS.

- [ ] **Step 9 — Commit.** `git add starters/modules/mcp && git commit -m "🤖 module: mcp (serveur + connecteur OAuth)"`

---

## Task 8 : Vérification build du combo complet

- [ ] **Step 1 — Composer + builder le combo full hors repo.**

```bash
node -e 'import("./scripts/compose-project.mjs").then(m=>m.compose({name:"verif-full",description:"Vérif build",modules:["db","redis","auth","mcp"],authMethods:["otp","password","magic-link"],mcp:{server:"verif",instructions:"x"},outDir:"/tmp/verif-full"}))'
cd /tmp/verif-full && npm install && npm run db:generate && npm run build
```

Expected : `next build` réussit (toutes routes compilent : `/`, `/sign-in`, `/api/auth/[...all]`, `/api/mcp`, `/.well-known/*`). `db:generate` produit `drizzle/0000_*.sql`.

- [ ] **Step 2 — Si erreurs de types/API** (ex. signature `magicLink`/`emailOTP` BetterAuth, import zod) : corriger le module ou le `render*` concerné, re-lancer `node --test` + le build. Itérer jusqu'au vert. Commit les correctifs.

- [ ] **Step 3 — Composer + builder `frontend only`** (`outDir:/tmp/verif-front`, `modules:[]`) → `npm install && npm run build` réussit. Garantit que la base seule reste déployable.

---

## Task 9 : Réécrire la skill `/lab-new` + nettoyage

**Files:** Modify `.claude/skills/lab-new/SKILL.md` ; Modify `CLAUDE.md` (racine) ; Delete `starters/flagship/`.

- [ ] **Step 1 — Réécrire `.claude/skills/lab-new/SKILL.md`** : wizard en état cible (instantané, sans contraste). Sections : (a) recueil nom + description ; (b) `AskUserQuestion` capacités `db/redis/auth/mcp` + affichage de la cascade ; (c) si auth → méthodes (multi : otp/password/magic-link) ; (d) si mcp → nom serveur + description → l'agent écrit `INSTRUCTIONS` et les outils dans `src/lib/mcp/tools/` + `registerAllTools` ; (e) thème : décrire l'ambiance → l'agent réécrit le bloc `@theme` de `globals.css` ; (f) `node scripts/compose-project.mjs` via appel programmatique ; (g) `npm install` (+ `npm run db:generate` si db) + `npm run build` local comme smoke ; (h) commit projet sur la branche de session (jamais `git switch`), push → preview, `gh pr create --fill`, `gh run watch`, `gh pr merge <#> --squash`, attendre la CI prod, renvoyer le **lien prod**. Mentionner les raccourcis `static`/`api` (copie directe, pas de composition). Mentionner que pour une app avec auth en prod, `BETTER_AUTH_SECRET` doit exister (`/lab-secret`).

- [ ] **Step 2 — `CLAUDE.md` racine** : la ligne `/lab-new` décrit « crée un projet en composant base + capacités (db/redis/auth/mcp) ». Pas d'autre changement de fond.

- [ ] **Step 3 — Supprimer `starters/flagship/`** (`git rm -r starters/flagship`). `static`/`api` conservés.

- [ ] **Step 4 — Commit.** `git add -A && git commit -m "🤖 lab-new: wizard de composition + retrait de flagship"`

---

## Task 10 : Intégration (PR → prod du créateur) + démo

- [ ] **Step 1 — Pousser la branche** `git push -u origin <branche>` → suivre la CI (`gh run watch`). La CI ne build aucun projet déployable (changements sous `starters/`, `scripts/`, `.claude/`).
- [ ] **Step 2 — Ouvrir la PR** `gh pr create --fill` (titre « ✨ /lab-new v2 : créateur de projets modulaire »).
- [ ] **Step 3 — Merger** `gh pr merge <#> --squash` une fois la CI verte. La branche distante s'auto-supprime.
- [ ] **Step 4 — Démo (preuve de bout en bout, optionnelle si le temps/les secrets le permettent)** : depuis une session sur une nouvelle branche, lancer le wizard pour créer un petit projet réel (ex. `db`+`auth`OTP+`mcp`), le déployer en preview, vérifier `/healthz` + `/api/mcp`, et joindre le lien au message du matin. Ne pas polluer la prod sans nom validé : préférer la preview pour la démo.

---

## Self-Review (couverture du spec)

- Base Next+Tailwind déployable → Task 1. ✓
- Modules db/email/redis/auth/mcp + manifeste → Tasks 3-7. ✓
- Compositeur déterministe (package.json, lab.json, env, barrel, auth générée) → Task 2. ✓
- Cascade (mcp⇒auth+db ; otp/magic-link⇒email) → `resolveModules` + tests Task 2. ✓
- Auth 3 méthodes + auto-login preview → Task 6 + `renderAuthFile`. ✓
- MCP pattern média (OAuth .well-known, mcp-handler) → Task 7. ✓
- Thème IA tokens-only → couture `@theme` Task 1, réécrit par la skill Task 9. ✓
- Déploiement auto jusqu'à la prod → Task 9 step h + Task 10. ✓
- static/api en raccourcis, flagship retiré → Task 9. ✓
- Filet de sécurité : tests compose + build full → Tasks 2/8. ✓
- Hors périmètre (GUI, social, image, browser) → non implémenté. ✓
