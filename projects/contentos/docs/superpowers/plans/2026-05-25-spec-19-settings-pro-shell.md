# Espace Settings « pro » — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner aux réglages un shell dédié plein écran (sidebar collée à gauche), un langage visuel « cartes douces » mono cohérent, et un éditeur de visual templates en cartes avec variables en lignes compactes repliables.

**Architecture:** On sort `/settings/**` du groupe `(app)` (qui impose le header global + un `<main>` centré) vers un nouveau groupe `(settings)` doté de son propre layout plein écran. Les URLs `/settings/...` restent identiques. Les pages settings sont ré-habillées via deux primitives de présentation (`SettingsPage`, `SettingsCard`). L'éditeur de template passe en cartes + lignes de variables repliables, l'aperçu live sticky est conservé.

**Tech Stack:** Next.js 16 App Router (route groups, layouts imbriqués), React 19, Tailwind, Base UI, Playwright, Biome, tsc.

**Note tests :** pas de harnais de test unitaire React dans ce repo. Validation par `tsc --noEmit`, `biome check .`, `npm run build`, specs Playwright E2E (URLs `/settings` inchangées) et contrôle visuel. La logique serveur (actions/cores) n'est pas modifiée.

---

## File Structure

Création :
- `src/app/(settings)/layout.tsx` — shell plein écran : auth + sidebar full-height + zone contenu scrollable + `<Toaster/>`.
- `src/components/settings/settings-page.tsx` — en-tête de page (crumb « Réglages » + titre + description) + slot enfants.
- `src/components/settings/settings-card.tsx` — carte blanche titrée réutilisable.

Déplacement (git mv, sous-arbre entier) :
- `src/app/(app)/settings/**` → `src/app/(settings)/settings/**`.

Suppression :
- `src/app/(settings)/settings/layout.tsx` (l'ancien `settings/layout.tsx` déplacé ; remplacé par le shell `(settings)/layout.tsx`).

Modification :
- `src/components/settings/settings-sidebar.tsx` — logo + entrées + « Retour à l'app », style cartes douces.
- Pages settings (brand, voice ×3, writing-templates ×3, visual-styles ×3, connections, api-keys, visual-templates ×4) — ré-habillage via `SettingsPage`/`SettingsCard`.
- `src/app/(settings)/settings/visual-templates/variables-schema-editor.tsx` — lignes compactes repliables.
- `src/app/(settings)/settings/visual-templates/visual-template-form.tsx` — cartes + code repliable.
- `src/app/(settings)/settings/visual-templates/[id]/page.tsx` — aperçu PNG en carte.
- 1 import source + ~10 imports de tests : `@/app/(app)/settings/` → `@/app/(settings)/settings/`.
- E2E : settings-brand, settings-editorial, settings-api-keys, visual-templates, template-image-var.

---

## Task 1 : Déplacer settings vers le groupe `(settings)` + shell plein écran

**Files:**
- Move: `src/app/(app)/settings/**` → `src/app/(settings)/settings/**`
- Create: `src/app/(settings)/layout.tsx`
- Delete: `src/app/(settings)/settings/layout.tsx`
- Modify: `src/components/settings/settings-sidebar.tsx`
- Modify: `src/app/(app)/posts/[id]/_components/add-visual-dialog.tsx` + tests (alias)

- [ ] **Step 1 : Déplacer le sous-arbre**

```bash
mkdir -p "src/app/(settings)"
git mv "src/app/(app)/settings" "src/app/(settings)/settings"
git rm "src/app/(settings)/settings/layout.tsx"
```

- [ ] **Step 2 : Mettre à jour les imports alias `@/app/(app)/settings/` → `@/app/(settings)/settings/`**

```bash
grep -rl "app/(app)/settings" src/ test/ | xargs sed -i '' "s#@/app/(app)/settings/#@/app/(settings)/settings/#g"
grep -rn "app/(app)/settings" src/ test/ || echo "OK: plus aucune référence à l'ancien chemin"
```

- [ ] **Step 3 : Créer le shell `(settings)/layout.tsx`**

```tsx
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { SettingsSidebar } from '@/components/settings/settings-sidebar';
import { Toaster } from '@/components/ui/sonner';
import { auth } from '@/lib/auth/server';

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/signin');

  return (
    <div className="flex min-h-screen bg-neutral-100">
      <SettingsSidebar email={session.user.email} />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-8 py-10">{children}</div>
      </main>
      <Toaster />
    </div>
  );
}
```

- [ ] **Step 4 : Réécrire la sidebar (logo + entrées + retour app, cartes douces)**

`src/components/settings/settings-sidebar.tsx` :

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const items: { label: string; href: string }[] = [
  { label: 'Brand', href: '/settings/brand' },
  { label: 'Voix', href: '/settings/voice' },
  { label: "Templates d'écriture", href: '/settings/writing-templates' },
  { label: 'Visual styles', href: '/settings/visual-styles' },
  { label: 'Visual templates', href: '/settings/visual-templates' },
  { label: 'Connexions', href: '/settings/connections' },
  { label: 'Clés API', href: '/settings/api-keys' },
];

export function SettingsSidebar({ email }: { email: string }) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-neutral-200 bg-neutral-50 px-3 py-4">
      <Link href="/" className="px-3 pb-4 text-lg font-semibold">
        content-os
      </Link>
      <p className="px-3 pb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
        Réglages
      </p>
      <nav aria-label="Réglages" className="flex flex-col gap-1">
        {items.map((item) => {
          const active = pathname?.startsWith(item.href) ?? false;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'rounded-lg px-3 py-2 text-sm',
                active
                  ? 'bg-white font-medium text-neutral-900 shadow-sm'
                  : 'text-neutral-600 hover:bg-white/60',
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto px-3 pt-4 text-xs text-neutral-500">
        <p className="truncate pb-2">{email}</p>
        <Link href="/" className="hover:text-neutral-900">
          ← Retour à l'app
        </Link>
      </div>
    </aside>
  );
}
```

- [ ] **Step 5 : Valider la structure**

Run:
```bash
npx tsc --noEmit
npx biome check --write .
rm -rf .next && npm run build
```
Expected: build OK, route `/settings/...` listées sous `(settings)`. (Les pages settings ré-habillage suivent ; à ce stade elles s'affichent dans le nouveau shell, encore avec leur ancien style — c'est normal.)

- [ ] **Step 6 : Commit**

```bash
git add -A
git commit -m "🤖 feat(settings): shell dédié plein écran (groupe (settings), sidebar collée)"
```

---

## Task 2 : Primitives de présentation `SettingsPage` + `SettingsCard`

**Files:**
- Create: `src/components/settings/settings-page.tsx`
- Create: `src/components/settings/settings-card.tsx`

- [ ] **Step 1 : `settings-page.tsx`**

```tsx
export function SettingsPage({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Réglages</p>
          <h2 className="text-2xl font-semibold text-neutral-900">{title}</h2>
          {description && <p className="mt-1 text-sm text-neutral-500">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      {children}
    </div>
  );
}
```

- [ ] **Step 2 : `settings-card.tsx`**

```tsx
import { cn } from '@/lib/utils';

export function SettingsCard({
  title,
  description,
  className,
  children,
}: {
  title?: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        'rounded-xl border border-neutral-200 bg-white p-6 shadow-sm',
        className,
      )}
    >
      {title && <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>}
      {description && <p className="mt-1 text-xs text-neutral-500">{description}</p>}
      {(title || description) && <div className="h-4" />}
      {children}
    </section>
  );
}
```

- [ ] **Step 3 : Valider + commit**

```bash
npx tsc --noEmit && npx biome check --write src/components/settings/
git add src/components/settings/settings-page.tsx src/components/settings/settings-card.tsx
git commit -m "🤖 feat(settings): primitives SettingsPage + SettingsCard (cartes douces)"
```

---

## Task 3 : Ré-habiller les pages simples

Pour **chaque** page liste/formulaire ci-dessous : remplacer le `<header>`/titres ad hoc par `<SettingsPage title=… description=…>` et envelopper le contenu (formulaire ou liste) dans un ou plusieurs `<SettingsCard>`. Conserver tous les `name`/`htmlFor`/labels des champs (compat E2E). Le bouton « + Nouveau/Nouvelle » va dans le prop `action` de `SettingsPage`.

**Files (Modify) :**
- `src/app/(settings)/settings/brand/page.tsx` (+ `brand-form.tsx` si besoin de wrapping)
- `src/app/(settings)/settings/voice/page.tsx`, `new/page.tsx`, `[id]/page.tsx`
- `src/app/(settings)/settings/writing-templates/page.tsx`, `new/page.tsx`, `[id]/page.tsx`
- `src/app/(settings)/settings/visual-styles/page.tsx`, `new/page.tsx`, `[id]/page.tsx`
- `src/app/(settings)/settings/connections/page.tsx`
- `src/app/(settings)/settings/api-keys/page.tsx`
- `src/app/(settings)/settings/page.tsx` (redirige vers `/settings/brand` — vérifier qu'il redirige toujours)

- [ ] **Step 1 : Exemple de référence — `brand/page.tsx`**

Le composant serveur charge déjà `settings`. Remplacer le rendu par :

```tsx
import { SettingsCard } from '@/components/settings/settings-card';
import { SettingsPage } from '@/components/settings/settings-page';
// … imports existants (auth, getSettings, BrandForm) …

// dans le return, à la place du <div className="space-y-6"><header>…</header>…</div> :
return (
  <SettingsPage title="Identité de marque" description="Ces valeurs servent de défauts aux templates et signatures.">
    <SettingsCard>
      <BrandForm
        initialValues={{
          brandName: settings.brandName,
          brandColor: settings.brandColor,
          brandSignature: settings.brandSignature,
        }}
      />
    </SettingsCard>
  </SettingsPage>
);
```

- [ ] **Step 2 : Appliquer le même patron aux autres pages**

Pour les **listes** (voice, writing-templates, visual-styles) : `SettingsPage` avec `action={<Button render={<Link href="…/new"/>} nativeButton={false}>+ Nouveau</Button>}` et la liste d'items rendue telle quelle (les items sont déjà des cartes `Card`). Pour les **formulaires** (new/[id]) : `SettingsPage` + `SettingsCard` autour du form. Pour `connections` et `api-keys` : `SettingsPage` + cartes autour des sections existantes. Garder libellés/`name` inchangés.

- [ ] **Step 3 : Valider + commit**

```bash
npx tsc --noEmit && npx biome check --write "src/app/(settings)/"
rm -rf .next && npm run build
git add -A
git commit -m "🤖 feat(settings): ré-habillage cartes douces des pages réglages"
```

---

## Task 4 : Variables en lignes compactes repliables

**Files:**
- Modify: `src/app/(settings)/settings/visual-templates/variables-schema-editor.tsx`

Conserver toute la logique (`Draft`, `toDraft`, `toSpec`, état `rows`, hidden input `serialized`, `onChange`). Changer seulement le rendu : chaque variable = une **ligne résumé** cliquable (puce type + name + label + résumé contraintes), qui déplie le panneau d'édition fin sous la ligne.

- [ ] **Step 1 : Ajouter l'état « ligne ouverte »**

Dans le composant, après `const [rows, setRows] = …` :

```tsx
const [openUid, setOpenUid] = useState<string | null>(null);
```

Et un helper de résumé des contraintes, au-dessus du `return` :

```tsx
function summarize(d: Draft): string {
  const parts: string[] = [];
  if (d.type === 'string' && (d.min !== undefined || d.max !== undefined)) {
    parts.push(`${d.min ?? 0}–${d.max ?? '∞'}`);
  }
  if (d.optional) parts.push('opt');
  return parts.join(' · ');
}
const TYPE_LABEL: Record<Draft['type'], string> = {
  string: 'texte',
  image: 'image',
  list: 'liste',
  color: 'couleur',
};
```

- [ ] **Step 2 : Remplacer le rendu de chaque ligne**

Remplacer le `{rows.map(({ uid, draft: v }) => ( <div key={uid} className="border rounded p-3 space-y-2"> … </div> ))}` par : une ligne résumé + le bloc d'édition existant affiché seulement si `openUid === uid`.

```tsx
{rows.map(({ uid, draft: v }) => {
  const open = openUid === uid;
  return (
    <div key={uid} className="rounded-lg border border-neutral-200 bg-white">
      <button
        type="button"
        onClick={() => setOpenUid(open ? null : uid)}
        className="flex w-full items-center gap-3 px-3 py-2 text-left"
      >
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-600">
          {TYPE_LABEL[v.type]}
        </span>
        <span className="text-sm font-medium text-neutral-900">{v.name || '(sans nom)'}</span>
        <span className="text-xs text-neutral-500">{v.label}</span>
        <span className="ml-auto text-[10px] text-neutral-400">{summarize(v)}</span>
        <span className="text-neutral-400">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="space-y-2 border-t border-neutral-100 p-3">
          {/* … bloc d'édition existant : Type select, Name, Label, Description,
                Min/Max (si string), optional, bouton Supprimer … (inchangé) */}
        </div>
      )}
    </div>
  );
})}
```

Coller à l'intérieur du `{open && (…)}` exactement les champs déjà présents (le `grid grid-cols-3` Type/Name/Label, la Description, le `grid` Min/Max + optional, et le bouton Supprimer). Le bouton « + Ajouter une variable » devient :

```tsx
<Button
  type="button"
  variant="outline"
  size="sm"
  onClick={() => {
    const uid = nextUid();
    setRows((arr) => [...arr, { uid, draft: { name: '', label: '', type: 'string', max: 100 } }]);
    setOpenUid(uid); // la nouvelle ligne s'ouvre dépliée
  }}
>
  + Ajouter une variable
</Button>
```

- [ ] **Step 3 : Valider + commit**

```bash
npx tsc --noEmit && npx biome check --write "src/app/(settings)/settings/visual-templates/variables-schema-editor.tsx"
git add -A
git commit -m "🤖 feat(settings): variables en lignes compactes repliables"
```

---

## Task 5 : Éditeur en cartes + code repliable

**Files:**
- Modify: `src/app/(settings)/settings/visual-templates/visual-template-form.tsx`
- Modify: `src/app/(settings)/settings/visual-templates/[id]/page.tsx`

Le form est déjà en deux colonnes (gauche champs, droite aperçu sticky). Regrouper la colonne gauche en cartes via `SettingsCard` : **Identité** (Nom/Slug puis Plateforme/Width/Height), **Variables** (`VariablesSchemaEditor`), **Sample vars** (repliable), **Code** (déjà un `<details>` — le conserver). Le `<SubmitButton/>` reste sous les cartes. Conserver labels/`name`.

- [ ] **Step 1 : Envelopper les sections gauche dans `SettingsCard`**

Importer `import { SettingsCard } from '@/components/settings/settings-card';`. Dans la colonne gauche (`<div className="min-w-0 space-y-6">`), envelopper :
- les deux grids identité/dimensions dans `<SettingsCard title="Identité">…</SettingsCard>` ;
- le bloc Variables dans `<SettingsCard title="Variables">…</SettingsCard>` ;
- le bloc Sample vars dans `<SettingsCard title="Sample vars (JSON)">…</SettingsCard>` (ou transformer en `<details>`) ;
- garder le `<details>` Code tel quel.

Aucune logique d'état ne change (width/height/bodyHtml/css/sampleVars/schema contrôlés, aperçu live inchangé).

- [ ] **Step 2 : Aperçu PNG en carte sur `[id]/page.tsx`**

Remplacer la section `Aperçu image (PNG)` par un `SettingsCard title="Aperçu image (PNG)"` enveloppant `<PreviewPanel … />`, et la zone dangereuse par un `SettingsCard`. Conserver le bouton « Prévisualiser » (E2E) et la `DangerZone`.

- [ ] **Step 3 : Valider + commit**

```bash
npx tsc --noEmit && npx biome check --write "src/app/(settings)/settings/visual-templates/"
rm -rf .next && npm run build
git add -A
git commit -m "🤖 feat(settings): éditeur de template en cartes (code repliable)"
```

---

## Task 6 : Adapter les E2E + validation finale

**Files:**
- Modify: `test/e2e/visual-templates.spec.ts`, `test/e2e/template-image-var.spec.ts`
- Vérifier (probablement intacts) : `settings-brand.spec.ts`, `settings-editorial.spec.ts`, `settings-api-keys.spec.ts`

Les URLs `/settings/...` sont inchangées. Le point sensible : remplir une variable nécessite maintenant de **déplier sa ligne**. Dans les specs qui créent une variable (`visual-templates`, `template-image-var`), après `+ Ajouter une variable` la nouvelle ligne s'ouvre dépliée automatiquement (Step 4) → les `getByLabel('Name…')`/`Label`/`Max` restent accessibles **sans clic supplémentaire**. Vérifier ; si une ligne pré-existante doit être éditée, cliquer d'abord son résumé.

- [ ] **Step 1 : Lancer les E2E settings/templates**

```bash
pkill -f "tsx watch"; lsof -ti :3000 | xargs kill -9 2>/dev/null; sleep 1
npx playwright test visual-templates template-image-var settings-brand settings-editorial settings-api-keys
```
Expected : tout vert. Sinon, ajuster les sélecteurs (déplier la ligne de variable avant de remplir).

- [ ] **Step 2 : Validation complète**

```bash
npx tsc --noEmit && npx biome check . && npm test
pkill -f "tsx watch"; lsof -ti :3000 | xargs kill -9 2>/dev/null; sleep 1
npx playwright test
```
Expected : tsc/biome clean, 381 unit/intégration verts, E2E complets verts.

- [ ] **Step 3 : Contrôle visuel** (`npm run dev` + worker) : sidebar collée plein écran, cartes douces, éditeur lisible (variables en lignes, code replié). C'est de l'affichage : à valider de visu.

- [ ] **Step 4 : Commit + PR**

```bash
git add -A && git commit -m "🤖 test(e2e): adapte settings/éditeur au shell pro"
git push -u origin spec-19/settings-pro-shell
gh pr create --title "Spec 19 — espace Settings pro (shell dédié, cartes douces, éditeur lignes)" --body "…"
```
Ne pas merger sans le feu vert de Manu.

---

## Self-Review

**Couverture spec :**
- Shell dédié `(settings)` + sidebar collée + retour app → Task 1. ✓
- Cartes douces sur toutes les pages → Tasks 2 + 3. ✓
- Éditeur : variables lignes repliables → Task 4 ; cartes + code repliable + aperçu sticky → Task 5. ✓
- Pas de drag-reorder → absent du plan. ✓
- URLs inchangées + imports alias mis à jour → Task 1 Step 2. ✓
- E2E adaptés → Task 6. ✓

**Placeholders :** le bloc d'édition de variable réutilise le JSX existant (référencé explicitement, à coller dans le `{open && …}`). PR `--body "…"` à rédiger au moment du push (résumé des changements). Pas d'autre placeholder de logique.

**Cohérence des types :** `SettingsSidebar` prend `email: string` (fourni par le layout). `SettingsPage` (title/description/action/children), `SettingsCard` (title?/description?/className?/children) — utilisés tels quels dans Task 3 et 5. `VariablesSchemaEditor` garde sa signature (`name`, `initial`, `onChange`).

**Risque principal :** le `git mv` + sed des alias. Vérifié par `tsc` + `build` + E2E (URLs identiques). Double `<Toaster/>` impossible (arbres `(app)`/`(settings)` disjoints).
