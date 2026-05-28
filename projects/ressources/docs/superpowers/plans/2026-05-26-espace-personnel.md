# Espace personnel — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter une page `/compte` (profil + déconnexion + gestion des abonnements) et recentrer `/bibliotheque` sur la lecture, reliées par une navigation partagée.

**Architecture:** Deux pages SSR `force-dynamic` sous le même en-tête. La logique d'affichage du nom est isolée dans un module pur testé. Les mutations passent par des server actions. Aucun changement de schéma.

**Tech Stack:** Next.js 16 (App Router, server actions), better-auth (`auth.api.updateUser`), Drizzle, Tailwind v4, Vitest.

---

### Task 1 : Logique pure du nom (`lib/account.ts`)

**Files:**
- Create: `lib/account.ts`
- Test: `lib/account.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

```ts
// lib/account.test.ts
import { describe, it, expect } from "vitest"
import { normalizeName, displayName } from "./account"

describe("normalizeName", () => {
  it("retire les espaces de début et de fin", () => {
    expect(normalizeName("  Manu  ")).toBe("Manu")
  })
  it("tronque à 80 caractères", () => {
    expect(normalizeName("a".repeat(100))).toHaveLength(80)
  })
  it("autorise la chaîne vide", () => {
    expect(normalizeName("   ")).toBe("")
  })
})

describe("displayName", () => {
  it("renvoie le nom quand il est présent", () => {
    expect(displayName({ name: "Manu", email: "m@x.io" })).toBe("Manu")
  })
  it("retombe sur l'email quand le nom est vide", () => {
    expect(displayName({ name: "", email: "m@x.io" })).toBe("m@x.io")
  })
  it("retombe sur l'email quand le nom est null", () => {
    expect(displayName({ name: null, email: "m@x.io" })).toBe("m@x.io")
  })
})
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run: `npm test -- lib/account.test.ts`
Expected: FAIL (module `./account` introuvable)

- [ ] **Step 3 : Implémenter le module**

```ts
// lib/account.ts
const MAX_NAME_LENGTH = 80

export function normalizeName(input: string): string {
  return input.trim().slice(0, MAX_NAME_LENGTH)
}

export function displayName(user: { name?: string | null; email: string }): string {
  const name = user.name?.trim()
  return name ? name : user.email
}
```

- [ ] **Step 4 : Lancer le test, vérifier le succès**

Run: `npm test -- lib/account.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5 : Commit**

```bash
git add lib/account.ts lib/account.test.ts
git commit -m "✨ Espace perso : logique pure du nom (normalize + display)"
```

---

### Task 2 : Server actions du compte (`lib/actions/account.ts`)

`lib/actions/library.ts` devient `lib/actions/account.ts` et gagne `updateNameAction`. La désinscription revalide les deux pages.

**Files:**
- Rename: `lib/actions/library.ts` → `lib/actions/account.ts`
- Modify: contenu du fichier renommé

- [ ] **Step 1 : Renommer le fichier (conserve l'historique git)**

Run: `git mv lib/actions/library.ts lib/actions/account.ts`

- [ ] **Step 2 : Réécrire le contenu**

```ts
// lib/actions/account.ts
"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { removeSubscription } from "@/lib/content/queries"
import { normalizeName } from "@/lib/account"

export async function unsubscribeAction(formData: FormData) {
  const resourceId = String(formData.get("resourceId"))
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return
  await removeSubscription(session.user.id, resourceId)
  revalidatePath("/compte")
  revalidatePath("/bibliotheque")
}

export async function updateNameAction(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return
  const name = normalizeName(String(formData.get("name") ?? ""))
  await auth.api.updateUser({ body: { name }, headers: await headers() })
  revalidatePath("/compte")
}

export async function signOutAction() {
  await auth.api.signOut({ headers: await headers() })
  redirect("/connexion")
}
```

- [ ] **Step 3 : Typecheck**

Run: `npm run typecheck`
Expected: PASS (aucune erreur). Si `auth.api.updateUser` n'accepte pas la forme `{ body, headers }`, inspecter le type exporté par `auth.api` et ajuster l'appel (better-auth expose `updateUser` sur l'API serveur).

- [ ] **Step 4 : Commit**

```bash
git add lib/actions/account.ts
git commit -m "✨ Espace perso : actions compte (renommage + updateName)"
```

---

### Task 3 : Navigation partagée (`components/library-nav.tsx`)

**Files:**
- Create: `components/library-nav.tsx`

- [ ] **Step 1 : Créer le composant**

```tsx
// components/library-nav.tsx
import Link from "next/link"
import { cn } from "@/lib/utils"

const links = [
  { href: "/bibliotheque", label: "Ma bibliothèque", key: "library" as const },
  { href: "/compte", label: "Mon compte", key: "account" as const },
]

export function LibraryNav({ active }: { active: "library" | "account" }) {
  return (
    <nav className="flex items-center gap-1">
      {links.map((l) => (
        <Link
          key={l.key}
          href={l.href}
          className={cn(
            "border-2 px-3 py-1.5 text-xs font-bold uppercase tracking-wide",
            l.key === active
              ? "border-ink bg-ink text-paper"
              : "border-transparent text-ink-soft hover:text-ink",
          )}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  )
}
```

- [ ] **Step 2 : Typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3 : Commit**

```bash
git add components/library-nav.tsx
git commit -m "✨ Espace perso : navigation partagée bibliothèque/compte"
```

---

### Task 4 : Page `/compte` (`app/compte/page.tsx`)

**Files:**
- Create: `app/compte/page.tsx`

- [ ] **Step 1 : Créer la page**

```tsx
// app/compte/page.tsx
import Link from "next/link"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { LogOut, X, Compass } from "lucide-react"
import { auth } from "@/lib/auth"
import { listSubscriptions } from "@/lib/content/queries"
import { displayName } from "@/lib/account"
import { unsubscribeAction, updateNameAction, signOutAction } from "@/lib/actions/account"
import { LibraryNav } from "@/components/library-nav"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"

export const dynamic = "force-dynamic"

export default async function ComptePage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/connexion")

  const items = await listSubscriptions(session.user.id)
  const { name, email } = session.user

  return (
    <div className="min-h-screen">
      <SiteHeader right={<LibraryNav active="account" />} />

      <main className="mx-auto max-w-3xl px-4 sm:px-6">
        <section className="border-b-2 border-ink py-12 sm:py-16">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.3em] text-accent">Espace lecteur</p>
          <h1 className="mt-3 text-5xl font-black tracking-tighter sm:text-6xl">Mon compte</h1>
          <p className="mt-4 font-mono text-sm text-ink-soft">{displayName({ name, email })}</p>
        </section>

        <section className="border-b-2 border-ink py-10">
          <h2 className="mb-6 font-mono text-xs font-extrabold uppercase tracking-widest text-ink-soft">Profil</h2>

          <form action={updateNameAction} className="max-w-md space-y-2">
            <label className="label" htmlFor="name">Nom</label>
            <input
              id="name"
              name="name"
              type="text"
              defaultValue={name ?? ""}
              maxLength={80}
              placeholder="Ton nom"
              className="field"
            />
            <button
              type="submit"
              className="press mt-2 inline-flex items-center border-2 border-ink bg-accent px-4 py-2 text-xs font-bold uppercase tracking-wide text-accent-ink shadow-brutal-sm"
            >
              Enregistrer
            </button>
          </form>

          <div className="mt-8 max-w-md">
            <p className="label">Email</p>
            <p className="font-mono text-sm">{email}</p>
          </div>

          <form action={signOutAction} className="mt-8">
            <button
              type="submit"
              className="press inline-flex items-center gap-2 border-2 border-ink bg-paper px-4 py-2 text-xs font-bold uppercase tracking-wide shadow-brutal-sm"
            >
              <LogOut className="size-4" strokeWidth={2.5} />
              Se déconnecter
            </button>
          </form>
        </section>

        <section className="py-10">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="font-mono text-xs font-extrabold uppercase tracking-widest text-ink-soft">Mes ressources</h2>
            <span className="font-mono text-xs text-ink-soft">{items.length.toString().padStart(2, "0")}</span>
          </div>

          {items.length === 0 ? (
            <div className="grid place-items-center border-2 border-dashed border-ink/40 py-16 text-center">
              <Compass className="size-8 text-ink-soft" strokeWidth={2} />
              <p className="mt-3 font-bold">Aucun abonnement.</p>
              <Link
                href="/"
                className="press mt-6 inline-flex items-center gap-2 border-2 border-ink bg-accent px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-accent-ink shadow-brutal"
              >
                Explorer les ressources
              </Link>
            </div>
          ) : (
            <ul className="divide-y-2 divide-ink border-2 border-ink">
              {items.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <Link href={`/r/${r.slug}`} className="font-bold hover:text-accent">
                    {r.title}
                  </Link>
                  <form action={unsubscribeAction}>
                    <input type="hidden" name="resourceId" value={r.id} />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-ink-soft transition-colors hover:text-ink"
                    >
                      <X className="size-3.5" strokeWidth={2.5} />
                      Se désinscrire
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
```

- [ ] **Step 2 : Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS

- [ ] **Step 3 : Commit**

```bash
git add app/compte/page.tsx
git commit -m "✨ Espace perso : page /compte (profil, déconnexion, abonnements)"
```

---

### Task 5 : Recentrer `/bibliotheque` sur la lecture

On retire le bouton de déconnexion de l'en-tête et le footer « Se désinscrire » des cartes ; l'en-tête reçoit `<LibraryNav active="library" />`.

**Files:**
- Modify: `app/bibliotheque/page.tsx`

- [ ] **Step 1 : Réécrire la page**

```tsx
// app/bibliotheque/page.tsx
import Link from "next/link"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { Compass } from "lucide-react"
import { auth } from "@/lib/auth"
import { listSubscriptions } from "@/lib/content/queries"
import { ResourceCard } from "@/components/resource-card"
import { LibraryNav } from "@/components/library-nav"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { Reveal } from "@/components/ui/reveal"

export const dynamic = "force-dynamic"

export default async function BibliothequePage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/connexion")

  const items = await listSubscriptions(session.user.id)

  return (
    <div className="min-h-screen">
      <SiteHeader right={<LibraryNav active="library" />} />

      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        <section className="border-b-2 border-ink py-12 sm:py-16">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.3em] text-accent">Espace lecteur</p>
          <h1 className="mt-3 text-5xl font-black tracking-tighter sm:text-6xl">Ma bibliothèque</h1>
          <p className="mt-4 font-mono text-sm text-ink-soft">{session.user.email}</p>
        </section>

        <section className="py-12">
          {items.length === 0 ? (
            <div className="grid place-items-center border-2 border-dashed border-ink/40 py-20 text-center">
              <Compass className="size-8 text-ink-soft" strokeWidth={2} />
              <p className="mt-3 font-bold">Ta bibliothèque est vide.</p>
              <p className="mt-1 max-w-sm text-sm text-ink-soft">
                Les ressources auxquelles tu accèdes se rangent ici automatiquement.
              </p>
              <Link
                href="/"
                className="press mt-6 inline-flex items-center gap-2 border-2 border-ink bg-accent px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-accent-ink shadow-brutal"
              >
                Explorer les ressources
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6 flex items-end justify-between">
                <h2 className="font-mono text-xs font-extrabold uppercase tracking-widest text-ink-soft">
                  Mes ressources
                </h2>
                <span className="font-mono text-xs text-ink-soft">{items.length.toString().padStart(2, "0")}</span>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((r, i) => (
                  <Reveal key={r.id} delay={Math.min(i * 0.05, 0.3)} className="h-full">
                    <ResourceCard
                      slug={r.slug}
                      title={r.title}
                      description={r.description}
                      coverImageUrl={r.coverImageUrl}
                    />
                  </Reveal>
                ))}
              </div>
            </>
          )}
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
```

- [ ] **Step 2 : Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS (plus aucune référence à `signOutAction`/`unsubscribeAction` dans ce fichier)

- [ ] **Step 3 : Commit**

```bash
git add app/bibliotheque/page.tsx
git commit -m "✨ Espace perso : bibliothèque recentrée sur la lecture"
```

---

### Task 6 : Vérification finale

**Files:** aucun (vérification)

- [ ] **Step 1 : Suite complète**

Run: `npm run typecheck && npm run lint && npm test`
Expected: tout PASS

- [ ] **Step 2 : Vérification visuelle (Playwright + OTP)**

```bash
npm run dev > /tmp/dev.log 2>&1 &
npx playwright install chromium   # 1re fois
DEV_LOG=/tmp/dev.log node scripts/shots.mjs login
node scripts/shots.mjs shoot compte
node scripts/shots.mjs shoot bibliotheque
```
Inspecter `/tmp/lab-shots/compte/` et `/tmp/lab-shots/bibliotheque/` : nav présente avec onglet actif, formulaire nom, email, déconnexion, liste d'abonnements avec « Se désinscrire » ; bibliothèque sans action de gestion sur les cartes.

- [ ] **Step 3 : Commit éventuel** (si ajustements après captures)

---

## Couverture spec

- Page `/compte` (profil nom + email + logout) → Task 4
- Nom éditable + fallback email → Task 1 (logique) + Task 2 (action) + Task 4 (form)
- Gestion des abonnements (liste + désinscription) hors bibliothèque → Task 4 + Task 5
- Navigation partagée → Task 3 (+ usage Task 4/5)
- Bibliothèque = lecture seule → Task 5
- Actions serveur (`account.ts`) → Task 2
- Tests logique pure → Task 1
- Vérif visuelle → Task 6
