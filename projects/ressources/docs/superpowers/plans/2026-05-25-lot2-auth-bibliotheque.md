# Lot 2 — Auth (OTP) + bibliothèque — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gater les ressources derrière une connexion par code OTP email (sessions ~1 an), avec bibliothèque personnelle (abonnement auto à l'accès, désinscription), ressources privées par email, et page d'accueil curatée.

**Architecture:** better-auth (plugin emailOTP, drizzleAdapter) ajoute les tables user/session/account/verification. Une fonction pure `canAccess` décide de l'affichage du contenu vs un teaser+gate dans le reader. Les codes OTP partent via Resend, avec un fallback `console.log` quand Resend n'est pas configuré (dev/test sans secret). L'accès autorisé upsert un abonnement ; `/bibliotheque` les liste.

**Tech Stack:** better-auth ^1.6.11 (emailOTP), resend + @react-email/components, Drizzle, Next 16 App Router, Vitest.

**Conventions maison reprises** (avqn-starter-kit) : `lib/auth.ts`, `lib/auth-client.ts`, `lib/email.ts`, `emails/`, `app/api/auth/[...all]/route.ts`, schéma Drizzle découpé dans `db/schema/*`.

---

## Structure des fichiers

```
db/schema/auth.ts            tables better-auth (user, session, account, verification)
db/schema/content.ts         resources (+ featured), pages, modules (déplacés depuis index.ts)
db/schema/access.ts          resource_access, subscriptions
db/schema/index.ts           réexporte auth + content + access
lib/auth.ts                  config better-auth serveur (emailOTP, session 1 an)
lib/auth-client.ts           client better-auth (emailOTPClient)
lib/email.ts                 sendOtpEmail (Resend + fallback console.log)
emails/otp-code.tsx          template react-email du code
app/api/auth/[...all]/route.ts  handler better-auth
lib/access.ts                normalizeEmail + canAccess (purs)
lib/access.test.ts           tests
lib/content/queries.ts       + getGrantedEmails, listFeaturedResources, addSubscription, listSubscriptions, removeSubscription ; getResourceBySlug ne filtre plus la visibilité
lib/actions/library.ts       server actions : unsubscribeAction, signOutAction
components/auth/otp-form.tsx  formulaire OTP en 2 étapes (email → code), client
components/auth/resource-gate.tsx  teaser + OtpForm pour le reader
app/(public)/r/[slug]/render.tsx   + gating (canAccess) + upsert abonnement
app/connexion/page.tsx       page de connexion
app/bibliotheque/page.tsx    bibliothèque perso
app/page.tsx                 index filtré featured
db/seed.ts                   + featured sur guide-ia, + ressource privée d'exemple
.env.example                 + BETTER_AUTH_SECRET, BETTER_AUTH_URL, NEXT_PUBLIC_BETTER_AUTH_URL, RESEND_*
```

---

## Task 1: Dépendances, env et schéma de base de données

**Files:**
- Modify: `package.json`, `.env.example`
- Create: `db/schema/auth.ts`, `db/schema/content.ts`, `db/schema/access.ts`
- Modify: `db/schema/index.ts`

- [ ] **Step 1: Ajouter les dépendances à `package.json`** (bloc `dependencies`)

```json
"better-auth": "^1.6.11",
"resend": "^6.12.3",
"@react-email/components": "^1.0.12",
```

Puis : `npm install`
Expected : installation OK.

- [ ] **Step 2: Compléter `.env.example`**

```
# Postgres
DATABASE_URL=postgres://ressources:ressources@localhost:5434/ressources

# Auth (better-auth)
BETTER_AUTH_SECRET=change-me-en-prod
BETTER_AUTH_URL=http://localhost:3001
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3001

# Email (Resend) — si absent, le code OTP est loggé dans la console serveur
# RESEND_API_KEY=
# RESEND_FROM_EMAIL=Ressources <noreply@exemple.com>

# Réservé aux lots suivants
# R2_PUBLIC_BASE_URL=
```

Puis mettre à jour `.env.local` : `cp .env.example .env.local` (et garder un `BETTER_AUTH_SECRET` non vide).

- [ ] **Step 3: Créer `db/schema/auth.ts`** (tables better-auth ; les noms de propriétés correspondent aux champs better-auth)

```ts
import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core"

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull().default(""),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
})

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})
```

- [ ] **Step 4: Créer `db/schema/content.ts`** (contenu du `index.ts` actuel + colonne `featured`)

```ts
import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  unique,
  type AnyPgColumn,
} from "drizzle-orm/pg-core"

export const resources = pgTable("resources", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  coverImageUrl: text("cover_image_url"),
  visibility: text("visibility").notNull().default("public"),
  published: boolean("published").notNull().default(false),
  featured: boolean("featured").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const pages = pgTable(
  "pages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id").references((): AnyPgColumn => pages.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("pages_resource_parent_slug").on(t.resourceId, t.parentId, t.slug)],
)

export const modules = pgTable("modules", {
  id: uuid("id").defaultRandom().primaryKey(),
  pageId: uuid("page_id")
    .notNull()
    .references(() => pages.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  position: integer("position").notNull().default(0),
  content: jsonb("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export type ResourceRow = typeof resources.$inferSelect
export type PageRow = typeof pages.$inferSelect
export type ModuleRow = typeof modules.$inferSelect
```

- [ ] **Step 5: Créer `db/schema/access.ts`**

```ts
import { pgTable, uuid, text, timestamp, unique } from "drizzle-orm/pg-core"
import { resources } from "./content"
import { user } from "./auth"

export const resourceAccess = pgTable(
  "resource_access",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("resource_access_resource_email").on(t.resourceId, t.email)],
)

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("subscriptions_user_resource").on(t.userId, t.resourceId)],
)
```

- [ ] **Step 6: Remplacer `db/schema/index.ts`** (réexport)

```ts
export * from "./auth"
export * from "./content"
export * from "./access"
```

- [ ] **Step 7: Pousser le schéma**

Run : `npm run db:push`
Expected : nouvelles tables `user`, `session`, `account`, `verification`, `resource_access`, `subscriptions` + colonne `featured` sur `resources`. (Répondre « yes » si drizzle-kit demande confirmation pour l'ajout de colonne.)

- [ ] **Step 8: Vérifier le typecheck + commit**

Run : `npm run typecheck`
Expected : aucune erreur (les imports `@/db/schema` existants restent valides via le réexport).

```bash
git add -A && git commit -m "feat: schéma auth (better-auth) + access/subscriptions + featured"
```

---

## Task 2: Configuration better-auth + email

**Files:**
- Create: `lib/auth.ts`, `lib/auth-client.ts`, `app/api/auth/[...all]/route.ts`, `lib/email.ts`, `emails/otp-code.tsx`

- [ ] **Step 1: Créer `emails/otp-code.tsx`**

```tsx
import { Html, Body, Container, Heading, Text } from "@react-email/components"

export function OtpEmail({ code }: { code: string }) {
  return (
    <Html lang="fr">
      <Body style={{ fontFamily: "sans-serif", background: "#ffffff", color: "#000000" }}>
        <Container style={{ maxWidth: 480, margin: "0 auto", padding: 24 }}>
          <Heading style={{ fontSize: 22, fontWeight: 800 }}>Votre code d&apos;accès</Heading>
          <Text>Saisissez ce code pour accéder à votre ressource :</Text>
          <Text style={{ fontSize: 32, fontWeight: 800, letterSpacing: 6 }}>{code}</Text>
          <Text style={{ color: "#666666" }}>Ce code expire dans 10 minutes.</Text>
        </Container>
      </Body>
    </Html>
  )
}
```

- [ ] **Step 2: Créer `lib/email.ts`** (Resend + fallback console.log)

```ts
import { Resend } from "resend"
import { OtpEmail } from "@/emails/otp-code"

const apiKey = process.env.RESEND_API_KEY
const from = process.env.RESEND_FROM_EMAIL

export async function sendOtpEmail({ to, code }: { to: string; code: string }) {
  if (!apiKey || !from) {
    // Resend non configuré (dev/test) : on logge le code côté serveur.
    console.log(`[OTP] ${to} -> ${code}`)
    return
  }
  const resend = new Resend(apiKey)
  await resend.emails.send({ from, to, subject: "Votre code d'accès", react: OtpEmail({ code }) })
}
```

- [ ] **Step 3: Créer `lib/auth.ts`**

```ts
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { nextCookies } from "better-auth/next-js"
import { emailOTP } from "better-auth/plugins"
import { db } from "@/db"
import { user, session, account, verification } from "@/db/schema"
import { sendOtpEmail } from "@/lib/email"

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification },
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  session: { expiresIn: 60 * 60 * 24 * 365, updateAge: 60 * 60 * 24 * 30 },
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 600,
      async sendVerificationOTP({ email, otp }) {
        await sendOtpEmail({ to: email, code: otp })
      },
    }),
    nextCookies(),
  ],
})
```

- [ ] **Step 4: Créer `lib/auth-client.ts`**

```ts
import { createAuthClient } from "better-auth/react"
import { emailOTPClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
  plugins: [emailOTPClient()],
})
```

- [ ] **Step 5: Créer `app/api/auth/[...all]/route.ts`**

```ts
import { auth } from "@/lib/auth"
import { toNextJsHandler } from "better-auth/next-js"

export const { GET, POST } = toNextJsHandler(auth)
```

- [ ] **Step 6: Vérifier le typecheck + commit**

Run : `npm run typecheck`
Expected : aucune erreur.

```bash
git add -A && git commit -m "feat: better-auth emailOTP + envoi Resend (fallback console)"
```

---

## Task 3: Politique d'accès (TDD)

**Files:**
- Create: `lib/access.ts`, `lib/access.test.ts`

- [ ] **Step 1: Écrire `lib/access.test.ts`**

```ts
import { describe, it, expect } from "vitest"
import { normalizeEmail, canAccess } from "./access"

const pub = { published: true, visibility: "public" }
const priv = { published: true, visibility: "private" }

describe("normalizeEmail", () => {
  it("trim + minuscules", () => {
    expect(normalizeEmail("  Foo@Bar.COM ")).toBe("foo@bar.com")
  })
  it("idempotent", () => {
    expect(normalizeEmail(normalizeEmail("A@B.C"))).toBe("a@b.c")
  })
})

describe("canAccess", () => {
  it("non-publiée → false même connecté", () => {
    expect(canAccess({ published: false, visibility: "public" }, "a@b.c", [])).toBe(false)
  })
  it("anonyme → false", () => {
    expect(canAccess(pub, null, [])).toBe(false)
  })
  it("publique + connecté → true", () => {
    expect(canAccess(pub, "a@b.c", [])).toBe(true)
  })
  it("privée + email attribué → true (insensible à la casse)", () => {
    expect(canAccess(priv, "Client@Exemple.com", ["client@exemple.com"])).toBe(true)
  })
  it("privée + email non attribué → false", () => {
    expect(canAccess(priv, "autre@exemple.com", ["client@exemple.com"])).toBe(false)
  })
})
```

- [ ] **Step 2: Lancer (échec attendu)**

Run : `npx vitest run lib/access.test.ts`
Expected : FAIL (`access` introuvable).

- [ ] **Step 3: Écrire `lib/access.ts`**

```ts
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function canAccess(
  resource: { published: boolean; visibility: string },
  email: string | null,
  grantedEmails: string[],
): boolean {
  if (!resource.published) return false
  if (!email) return false
  if (resource.visibility === "public") return true
  if (resource.visibility === "private") {
    return grantedEmails.map(normalizeEmail).includes(normalizeEmail(email))
  }
  return false
}
```

- [ ] **Step 4: Lancer (succès attendu) + commit**

Run : `npm test`
Expected : tous les fichiers PASS (lot 1 + access).

```bash
git add -A && git commit -m "feat: politique d'accès canAccess + normalizeEmail"
```

---

## Task 4: Requêtes contenu, accès et abonnements

**Files:**
- Modify: `lib/content/queries.ts`

- [ ] **Step 1: Remplacer `lib/content/queries.ts`** (getResourceBySlug ne filtre plus la visibilité ; ajout des requêtes d'accès et d'abonnement)

```ts
import { eq, and, asc, desc } from "drizzle-orm"
import { db } from "@/db"
import { resources, pages, modules, resourceAccess, subscriptions } from "@/db/schema"
import { parseModule, type ParsedModule } from "@/lib/modules/schemas"
import type { FlatPage } from "@/lib/content/tree"

export async function listFeaturedResources() {
  return db
    .select()
    .from(resources)
    .where(and(eq(resources.published, true), eq(resources.visibility, "public"), eq(resources.featured, true)))
    .orderBy(desc(resources.createdAt))
}

export async function getResourceBySlug(slug: string) {
  const [resource] = await db.select().from(resources).where(eq(resources.slug, slug)).limit(1)
  if (!resource || !resource.published) return null

  const pageRows = await db.select().from(pages).where(eq(pages.resourceId, resource.id))
  const flatPages: FlatPage[] = pageRows.map((p) => ({
    id: p.id,
    parentId: p.parentId,
    slug: p.slug,
    title: p.title,
    position: p.position,
  }))
  return { resource, flatPages }
}

export async function getGrantedEmails(resourceId: string): Promise<string[]> {
  const rows = await db
    .select({ email: resourceAccess.email })
    .from(resourceAccess)
    .where(eq(resourceAccess.resourceId, resourceId))
  return rows.map((r) => r.email)
}

export async function getPageModules(pageId: string): Promise<ParsedModule[]> {
  const rows = await db.select().from(modules).where(eq(modules.pageId, pageId)).orderBy(asc(modules.position))
  return rows
    .map((r) => parseModule({ id: r.id, type: r.type, position: r.position, content: r.content }))
    .filter((m): m is ParsedModule => m !== null)
}

export async function addSubscription(userId: string, resourceId: string) {
  await db.insert(subscriptions).values({ userId, resourceId }).onConflictDoNothing()
}

export async function removeSubscription(userId: string, resourceId: string) {
  await db
    .delete(subscriptions)
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.resourceId, resourceId)))
}

export async function listSubscriptions(userId: string) {
  return db
    .select({
      id: resources.id,
      slug: resources.slug,
      title: resources.title,
      description: resources.description,
    })
    .from(subscriptions)
    .innerJoin(resources, eq(subscriptions.resourceId, resources.id))
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.createdAt))
}
```

- [ ] **Step 2: Vérifier le typecheck + commit**

Run : `npm run typecheck`
Expected : aucune erreur. (`listPublishedResources` est remplacée par `listFeaturedResources` ; l'index sera mis à jour en Task 9.)

```bash
git add -A && git commit -m "feat: requêtes accès/abonnements + index featured"
```

---

## Task 5: Formulaire OTP (client)

**Files:**
- Create: `components/auth/otp-form.tsx`

- [ ] **Step 1: Écrire `components/auth/otp-form.tsx`** (2 étapes : email → code)

```tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"

export function OtpForm({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter()
  const [step, setStep] = useState<"email" | "code">("email")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function sendCode(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" })
    setLoading(false)
    if (error) setError("Envoi impossible. Réessaie.")
    else setStep("code")
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await authClient.signIn.emailOtp({ email, otp: code })
    setLoading(false)
    if (error) {
      setError("Code invalide ou expiré.")
      return
    }
    router.refresh()
    if (redirectTo) router.push(redirectTo)
  }

  const input = "w-full border-2 border-foreground bg-background px-3 py-2"
  const button = "w-full border-4 border-foreground bg-foreground px-3 py-2 font-bold text-background disabled:opacity-50"

  if (step === "email") {
    return (
      <form onSubmit={sendCode} className="space-y-3">
        <input
          type="email"
          required
          placeholder="ton@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={input}
        />
        <button type="submit" disabled={loading} className={button}>
          {loading ? "…" : "Recevoir mon code"}
        </button>
        {error && <p className="text-sm text-muted-foreground">{error}</p>}
      </form>
    )
  }

  return (
    <form onSubmit={verify} className="space-y-3">
      <p className="text-sm text-muted-foreground">Code envoyé à {email}.</p>
      <input
        inputMode="numeric"
        required
        placeholder="000000"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        className={`${input} tracking-[0.4em]`}
      />
      <button type="submit" disabled={loading} className={button}>
        {loading ? "…" : "Accéder"}
      </button>
      {error && <p className="text-sm text-muted-foreground">{error}</p>}
    </form>
  )
}
```

- [ ] **Step 2: Vérifier le typecheck + commit**

Run : `npm run typecheck`
Expected : aucune erreur.

```bash
git add -A && git commit -m "feat: formulaire OTP en deux étapes (client)"
```

---

## Task 6: Gate du reader + abonnement à l'accès

**Files:**
- Create: `components/auth/resource-gate.tsx`
- Modify: `app/(public)/r/[slug]/render.tsx`

- [ ] **Step 1: Écrire `components/auth/resource-gate.tsx`** (teaser + OtpForm)

```tsx
import { OtpForm } from "./otp-form"

export function ResourceGate({
  title,
  description,
  coverImageUrl,
}: {
  title: string
  description: string | null
  coverImageUrl: string | null
}) {
  return (
    <div className="mx-auto min-h-screen max-w-xl px-6 py-16">
      {coverImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverImageUrl} alt="" className="mb-6 w-full border-2 border-foreground" />
      )}
      <h1 className="text-4xl font-black tracking-tight">{title}</h1>
      {description && <p className="mt-3 text-muted-foreground">{description}</p>}
      <div className="mt-8 border-t-4 border-foreground pt-6">
        <p className="mb-3 font-bold">Laisse ton email pour accéder à cette ressource.</p>
        <OtpForm />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Remplacer `app/(public)/r/[slug]/render.tsx`** (gating + upsert abonnement)

```tsx
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { buildPageTree } from "@/lib/content/tree"
import { resolvePageByPath } from "@/lib/content/resolve"
import { extractToc, type TocItem } from "@/lib/content/toc"
import { canAccess } from "@/lib/access"
import { getResourceBySlug, getGrantedEmails, getPageModules, addSubscription } from "@/lib/content/queries"
import { ReaderShell } from "@/components/reader/reader-shell"
import { ModuleView } from "@/components/modules/registry"
import { ResourceGate } from "@/components/auth/resource-gate"

export async function renderResourcePage(slug: string, path: string[]) {
  const data = await getResourceBySlug(slug)
  if (!data) notFound()

  const session = await auth.api.getSession({ headers: await headers() })
  const email = session?.user.email ?? null
  const grantedEmails = data.resource.visibility === "private" ? await getGrantedEmails(data.resource.id) : []

  if (!canAccess(data.resource, email, grantedEmails)) {
    return (
      <ResourceGate
        title={data.resource.title}
        description={data.resource.description}
        coverImageUrl={data.resource.coverImageUrl}
      />
    )
  }

  if (session) await addSubscription(session.user.id, data.resource.id)

  const root = buildPageTree(data.flatPages)
  if (!root) notFound()

  const page = resolvePageByPath(root, path)
  if (!page) notFound()

  const mods = await getPageModules(page.id)

  const toc: TocItem[] = mods
    .filter((m) => m.type === "markdown" || m.type === "callout")
    .flatMap((m) => extractToc((m.content as { md: string }).md))

  return (
    <ReaderShell resourceTitle={data.resource.title} root={root} basePath={`/r/${slug}`} currentId={page.id} toc={toc}>
      <h1 className="mb-6 text-4xl font-black tracking-tight">{page.title}</h1>
      {mods.map((m) => (
        <ModuleView key={m.id} module={m} />
      ))}
    </ReaderShell>
  )
}
```

- [ ] **Step 3: Vérifier le typecheck + commit**

Run : `npm run typecheck`
Expected : aucune erreur.

```bash
git add -A && git commit -m "feat: gate teaser+OTP sur le reader + abonnement à l'accès"
```

---

## Task 7: Page de connexion

**Files:**
- Create: `app/connexion/page.tsx`

- [ ] **Step 1: Écrire `app/connexion/page.tsx`** (si déjà connecté → bibliothèque)

```tsx
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { OtpForm } from "@/components/auth/otp-form"

export const dynamic = "force-dynamic"

export default async function ConnexionPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session) redirect("/bibliotheque")

  return (
    <main className="mx-auto min-h-screen max-w-md px-6 py-20">
      <h1 className="text-4xl font-black tracking-tight">Connexion</h1>
      <p className="mt-3 text-muted-foreground">Reçois un code par email pour accéder à ta bibliothèque.</p>
      <div className="mt-8">
        <OtpForm redirectTo="/bibliotheque" />
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Vérifier le typecheck + commit**

Run : `npm run typecheck`
Expected : aucune erreur.

```bash
git add -A && git commit -m "feat: page de connexion"
```

---

## Task 8: Bibliothèque + server actions

**Files:**
- Create: `lib/actions/library.ts`, `app/bibliotheque/page.tsx`

- [ ] **Step 1: Écrire `lib/actions/library.ts`** (server actions)

```ts
"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { removeSubscription } from "@/lib/content/queries"

export async function unsubscribeAction(formData: FormData) {
  const resourceId = String(formData.get("resourceId"))
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return
  await removeSubscription(session.user.id, resourceId)
  revalidatePath("/bibliotheque")
}

export async function signOutAction() {
  await auth.api.signOut({ headers: await headers() })
  redirect("/connexion")
}
```

- [ ] **Step 2: Écrire `app/bibliotheque/page.tsx`**

```tsx
import Link from "next/link"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { listSubscriptions } from "@/lib/content/queries"
import { unsubscribeAction, signOutAction } from "@/lib/actions/library"

export const dynamic = "force-dynamic"

export default async function BibliothequePage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/connexion")

  const items = await listSubscriptions(session.user.id)

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="flex items-center justify-between">
        <h1 className="text-5xl font-black tracking-tight">Ma bibliothèque</h1>
        <form action={signOutAction}>
          <button type="submit" className="border-2 border-foreground px-3 py-1 text-sm font-bold">
            Se déconnecter
          </button>
        </form>
      </div>
      <p className="mt-3 text-muted-foreground">{session.user.email}</p>

      {items.length === 0 ? (
        <p className="mt-10 border-t-4 border-foreground pt-6">Aucune ressource pour l&apos;instant.</p>
      ) : (
        <ul className="mt-10 border-t-4 border-foreground">
          {items.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-4 border-b-4 border-foreground py-5">
              <Link href={`/r/${r.slug}`} className="flex-1">
                <span className="text-2xl font-bold">{r.title}</span>
                {r.description && <span className="mt-1 block text-muted-foreground">{r.description}</span>}
              </Link>
              <form action={unsubscribeAction}>
                <input type="hidden" name="resourceId" value={r.id} />
                <button type="submit" className="border-2 border-foreground px-3 py-1 text-sm font-bold hover:bg-muted">
                  Se désinscrire
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
```

- [ ] **Step 3: Vérifier le typecheck + commit**

Run : `npm run typecheck`
Expected : aucune erreur.

```bash
git add -A && git commit -m "feat: bibliothèque + désinscription + déconnexion"
```

---

## Task 9: Index curaté (featured)

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Remplacer `app/page.tsx`** (utilise `listFeaturedResources`, lien vers la connexion)

```tsx
import Link from "next/link"
import { listFeaturedResources } from "@/lib/content/queries"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  const items = await listFeaturedResources()
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="flex items-center justify-between">
        <h1 className="text-5xl font-black tracking-tight">Ressources</h1>
        <Link href="/bibliotheque" className="border-2 border-foreground px-3 py-1 text-sm font-bold">
          Ma bibliothèque
        </Link>
      </div>
      <p className="mt-3 text-muted-foreground">Pour approfondir l&apos;IA, l&apos;automatisation et le cloud.</p>
      <ul className="mt-10 border-t-4 border-foreground">
        {items.map((r) => (
          <li key={r.id} className="border-b-4 border-foreground">
            <Link href={`/r/${r.slug}`} className="block py-5 hover:bg-muted">
              <span className="text-2xl font-bold">{r.title}</span>
              {r.description && <span className="mt-1 block text-muted-foreground">{r.description}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
```

- [ ] **Step 2: Vérifier le typecheck + commit**

Run : `npm run typecheck`
Expected : aucune erreur.

```bash
git add -A && git commit -m "feat: index curaté (ressources featured)"
```

---

## Task 10: Seed — featured + ressource privée

**Files:**
- Modify: `db/seed.ts`

- [ ] **Step 1: Modifier l'insertion de `guide-ia`** pour la marquer featured (dans `db/seed.ts`, ajouter `featured: true` aux values de la ressource `guide-ia`)

```ts
    .values({
      slug: SLUG,
      title: "Guide IA",
      description: "Comprendre et appliquer l'IA en pratique.",
      visibility: "public",
      published: true,
      featured: true,
    })
```

- [ ] **Step 2: Ajouter une ressource privée d'exemple** à la fin de `seed()`, juste avant le `console.log` final, en important `resourceAccess` :

En tête de fichier, compléter l'import :
```ts
import { resources, pages, modules, resourceAccess } from "./schema"
```

Avant le `console.log` final :
```ts
  await db.delete(resources).where(eq(resources.slug, "atelier-prive"))
  const [priv] = await db
    .insert(resources)
    .values({
      slug: "atelier-prive",
      title: "Atelier privé",
      description: "Ressource réservée à un client.",
      visibility: "private",
      published: true,
      featured: false,
    })
    .returning()
  const [privRoot] = await db
    .insert(pages)
    .values({ resourceId: priv.id, parentId: null, slug: "", title: "Brief client", position: 0 })
    .returning()
  await db.insert(modules).values({
    pageId: privRoot.id,
    type: "markdown",
    position: 0,
    content: { md: "## Brief\n\nContenu réservé au client." },
  })
  await db.insert(resourceAccess).values({ resourceId: priv.id, email: "client@exemple.com" })
  console.log("Seed privé OK → /r/atelier-prive (client@exemple.com)")
```

- [ ] **Step 3: Lancer le seed**

Run : `npm run db:seed`
Expected : `Seed OK → /r/guide-ia` et `Seed privé OK → /r/atelier-prive (client@exemple.com)`.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: seed featured guide-ia + ressource privée d'exemple"
```

---

## Task 11: Vérification end-to-end

L'envoi OTP retombe sur `console.log` (Resend non configuré), donc le flux est testable sans secret. Le serveur dev tourne sur `:3001` (`:3000` occupé).

- [ ] **Step 1: Démarrer la base et le serveur**

```bash
docker compose up -d
npm run db:push
npm run db:seed
npm run dev > /tmp/lab-ress-dev.log 2>&1 &
```

- [ ] **Step 2: Vérifier le gate anonyme**

```bash
curl -s http://localhost:3001/r/guide-ia | grep -c "Laisse ton email"   # attendu : 1
curl -s http://localhost:3001/r/guide-ia | grep -c "id=\"contexte\""     # attendu : 0 (contenu masqué)
```

- [ ] **Step 3: Flux OTP complet (cookie jar)**

```bash
curl -s -X POST http://localhost:3001/api/auth/email-otp/send-verification-otp \
  -H 'content-type: application/json' -d '{"email":"lead@exemple.com","type":"sign-in"}'
CODE=$(grep -oE '\[OTP\] lead@exemple.com -> [0-9]+' /tmp/lab-ress-dev.log | tail -1 | grep -oE '[0-9]+$')
echo "code=$CODE"
curl -s -c /tmp/jar.txt -X POST http://localhost:3001/api/auth/sign-in/email-otp \
  -H 'content-type: application/json' -d "{\"email\":\"lead@exemple.com\",\"otp\":\"$CODE\"}"
```
Expected : la réponse de sign-in contient un token/utilisateur ; `/tmp/jar.txt` contient un cookie de session.

- [ ] **Step 4: Vérifier l'accès authentifié + bibliothèque**

```bash
curl -s -b /tmp/jar.txt http://localhost:3001/r/guide-ia | grep -c "id=\"contexte\""   # attendu : 1 (contenu visible)
curl -s -b /tmp/jar.txt http://localhost:3001/bibliotheque | grep -c "Guide IA"         # attendu : ≥1
```

- [ ] **Step 5: Vérifier la ressource privée**

```bash
# lead@exemple.com n'est PAS attribué → gate
curl -s -b /tmp/jar.txt http://localhost:3001/r/atelier-prive | grep -c "Laisse ton email"   # attendu : 1
curl -s -b /tmp/jar.txt http://localhost:3001/r/atelier-prive | grep -c "Contenu réservé"     # attendu : 0
```
Puis se connecter en tant que `client@exemple.com` (mêmes étapes que Step 3 avec un nouveau cookie jar) et vérifier que `/r/atelier-prive` montre « Contenu réservé ».

- [ ] **Step 6: Vérifier l'index curaté**

```bash
curl -s http://localhost:3001/ | grep -c "Guide IA"        # attendu : ≥1 (featured)
curl -s http://localhost:3001/ | grep -c "Atelier privé"   # attendu : 0 (non featured + privé)
```

- [ ] **Step 7: Gates finaux**

```bash
pkill -f "next dev"
npm test
npm run typecheck
npm run lint
npm run build
```
Expected : tout vert ; build standalone OK.

- [ ] **Step 8: Commit final éventuel** (si des ajustements ont été faits durant la vérification)

```bash
git add -A && git commit -m "test: vérification end-to-end lot 2"
```

---

## Self-review (couverture spec → plan)

- Auth emailOTP, email seul, session ~1 an, Resend + fallback → Tasks 1, 2. ✓
- Variables d'env (BETTER_AUTH_*, RESEND_*) → Task 1 step 2. ✓
- `visibility` public/private, `resource_access` par email, `featured` → Task 1 (schéma), Task 10 (seed). ✓
- `canAccess` pur + tests, `normalizeEmail` → Task 3. ✓
- Reader gaté (teaser + OTP), contenu si autorisé → Task 6. ✓
- Abonnement upserté à l'accès → Task 6 (`addSubscription` onConflictDoNothing). ✓
- `/bibliotheque` (liste, désinscription, déconnexion), redirige si non connecté → Task 8. ✓
- `/connexion` → Task 7. ✓
- Index featured uniquement → Tasks 4 (query) + 9 (page). ✓
- Refactor `db/schema` en auth/content/access → Task 1. ✓
- Email OTP template → Task 2. ✓
- Critères d'acceptation (gate, OTP, privé, désinscription, session, index, build) → Task 11. ✓

Cohérence des types : `canAccess(resource, email, grantedEmails)` même signature en Task 3, 6 ; `addSubscription/removeSubscription/listSubscriptions/getGrantedEmails/listFeaturedResources` définies en Task 4 et utilisées en Tasks 6, 8, 9 ; `OtpForm` props `{ redirectTo?: string }` cohérent entre Tasks 5, 6, 7 ; tables `user/session/account/verification` (Task 1) référencées par `lib/auth.ts` (Task 2) et `subscriptions.userId` (Task 1 access.ts).
