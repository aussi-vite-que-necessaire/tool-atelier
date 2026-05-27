# Drop slug from visual_styles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retirer le champ `slug` de l'entité `visual_styles` (schema, migration, repo, actions, UI, tests integration + E2E) sans toucher `writing_templates`.

**Architecture:** Refactor atomique. Le `slug` est tellement transverse (schema → repo → actions → form → list → edit page → tests → E2E) que toute coupure intermédiaire laisserait le tree en état non-compilable. Donc Task 1 = un commit atomique qui modifie tous les fichiers concernés + génère/applique la migration. Task 2 = vérification E2E + push + watch CI.

**Tech Stack:** Next.js 16, Drizzle ORM 0.45 + drizzle-kit, Postgres 16, Vitest 3, Playwright, biome.

**Repo cible:** `/Users/ManuAVQN/Code/content-os-v2/` (branche `main`).

**État de départ:** branche `main` propre au commit `1f580db` (le bouton home posté juste avant cette spec). Docker compose up (postgres + redis healthy).

---

## Task 1: Drop slug everywhere + migration + tests

Tout en un commit. Édite d'abord tous les fichiers de code et de tests (qui ne référencent plus `slug`), puis modifie le schema, puis génère et applique la migration, puis lance lint + tests + build. Cet ordre garantit que la migration drizzle-kit voit bien le diff et que rien ne tourne avant que tout soit cohérent.

**Files:**
- Modify: `src/lib/db/schemas/visual-styles.ts`
- Create: `drizzle/0003_<auto>.sql` (nom auto par drizzle-kit)
- Create: `drizzle/meta/0003_snapshot.json`
- Modify: `drizzle/meta/_journal.json`
- Modify: `src/lib/db/repositories/visual-styles.ts`
- Modify: `src/app/(app)/settings/visual-styles/new/actions-core.ts`
- Modify: `src/app/(app)/settings/visual-styles/[id]/actions-core.ts`
- Modify: `src/app/(app)/settings/visual-styles/visual-style-form.tsx`
- Modify: `src/app/(app)/settings/visual-styles/page.tsx`
- Modify: `src/app/(app)/settings/visual-styles/[id]/page.tsx`
- Modify: `test/integration/visual-styles-repository.test.ts`
- Modify: `test/integration/visual-style-create-action.test.ts`
- Modify: `test/integration/visual-style-edit-action.test.ts`
- Modify: `test/integration/tenant-isolation.test.ts`
- Modify: `test/e2e/settings-editorial.spec.ts`

---

- [ ] **Step 1: Modifier le repo (`src/lib/db/repositories/visual-styles.ts`)**

Nouveau contenu intégral :

```ts
import { and, eq } from 'drizzle-orm';
import { db } from '../client';
import { createId } from '../id';
import { type VisualStyle, visualStyles } from '../schema';

export type CreateVisualStyleInput = {
  name: string;
  prompt: string;
};

export type UpdateVisualStylePatch = Partial<CreateVisualStyleInput>;

export async function createVisualStyle(
  userId: string,
  data: CreateVisualStyleInput,
): Promise<VisualStyle> {
  const id = createId();
  const [row] = await db
    .insert(visualStyles)
    .values({ id, userId, ...data })
    .returning();
  return row!;
}

export async function getVisualStyle(
  userId: string,
  id: string,
): Promise<VisualStyle | undefined> {
  const rows = await db
    .select()
    .from(visualStyles)
    .where(and(eq(visualStyles.id, id), eq(visualStyles.userId, userId)))
    .limit(1);
  return rows[0];
}

export async function listVisualStyles(userId: string): Promise<VisualStyle[]> {
  return db.select().from(visualStyles).where(eq(visualStyles.userId, userId));
}

export async function updateVisualStyle(
  userId: string,
  id: string,
  patch: UpdateVisualStylePatch,
): Promise<VisualStyle | undefined> {
  const rows = await db
    .update(visualStyles)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(visualStyles.id, id), eq(visualStyles.userId, userId)))
    .returning();
  return rows[0];
}

export async function deleteVisualStyle(userId: string, id: string): Promise<void> {
  await db
    .delete(visualStyles)
    .where(and(eq(visualStyles.id, id), eq(visualStyles.userId, userId)));
}
```

Changements vs état actuel :
- `CreateVisualStyleInput` ne contient plus `slug`.
- `createVisualStyle` retourne `Promise<VisualStyle>` (non-optional). Le `row!` garantit le non-null parce que `.returning()` après un insert qui n'a pas thrown renvoie toujours au moins une ligne.
- Plus de `.onConflictDoNothing({ target: ... })`.
- Le reste (`get`, `list`, `update`, `delete`) est inchangé fonctionnellement (les signatures n'ont jamais référencé `slug`).

- [ ] **Step 2: Modifier `src/app/(app)/settings/visual-styles/new/actions-core.ts`**

Nouveau contenu intégral :

```ts
import { z } from 'zod';
import { createVisualStyle } from '@/lib/db/repositories/visual-styles';
import type { VisualStyleActionState } from '../visual-style-form';

const schema = z.object({
  name: z.string().min(1).max(100),
  prompt: z.string().min(1).max(2000),
});

export async function createVisualStyleCore(
  userId: string,
  formData: FormData,
): Promise<VisualStyleActionState> {
  const raw = {
    name: String(formData.get('name') ?? ''),
    prompt: String(formData.get('prompt') ?? ''),
  };

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? '');
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { status: 'error', message: 'validation', fieldErrors };
  }

  await createVisualStyle(userId, parsed.data);
  return { status: 'success' };
}
```

Changements vs état actuel :
- Schema Zod : plus de clé `slug`.
- `raw` : plus de clé `slug`.
- Branche `if (!created)` retirée (plus de cas `duplicate-slug` possible).

- [ ] **Step 3: Modifier `src/app/(app)/settings/visual-styles/[id]/actions-core.ts`**

Nouveau contenu intégral :

```ts
import { z } from 'zod';
import {
  deleteVisualStyle,
  getVisualStyle,
  updateVisualStyle,
} from '@/lib/db/repositories/visual-styles';
import type { VisualStyleActionState } from '../visual-style-form';

const schema = z.object({
  name: z.string().min(1).max(100),
  prompt: z.string().min(1).max(2000),
});

export async function updateVisualStyleCore(
  userId: string,
  id: string,
  formData: FormData,
): Promise<VisualStyleActionState> {
  const existing = await getVisualStyle(userId, id);
  if (!existing) return { status: 'error', message: 'not-found' };

  const raw = {
    name: String(formData.get('name') ?? ''),
    prompt: String(formData.get('prompt') ?? ''),
  };

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? '');
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { status: 'error', message: 'validation', fieldErrors };
  }

  await updateVisualStyle(userId, id, parsed.data);
  return { status: 'success' };
}

export async function deleteVisualStyleCore(
  userId: string,
  id: string,
): Promise<VisualStyleActionState> {
  const existing = await getVisualStyle(userId, id);
  if (!existing) return { status: 'error', message: 'not-found' };
  await deleteVisualStyle(userId, id);
  return { status: 'success' };
}
```

Changements : schema Zod et `raw` ne contiennent plus `slug`. `deleteVisualStyleCore` inchangé.

- [ ] **Step 4: Modifier `src/app/(app)/settings/visual-styles/visual-style-form.tsx`**

Nouveau contenu intégral :

```tsx
'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export type VisualStyleActionState =
  | { status: 'idle' }
  | { status: 'success' }
  | { status: 'error'; message: string; fieldErrors?: Record<string, string> };

type Initial = { name: string; prompt: string };

const EMPTY_INITIAL: Initial = { name: '', prompt: '' };

function SubmitButton({ mode }: { mode: 'create' | 'edit' }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Enregistrement…' : mode === 'create' ? 'Créer' : 'Enregistrer'}
    </Button>
  );
}

export function VisualStyleForm({
  mode,
  initial,
  action,
  successMessage,
}: {
  mode: 'create' | 'edit';
  initial?: Initial;
  action: (
    prev: VisualStyleActionState,
    formData: FormData,
  ) => Promise<VisualStyleActionState>;
  successMessage: string;
}) {
  const values = initial ?? EMPTY_INITIAL;
  const [state, formAction] = useActionState<VisualStyleActionState, FormData>(action, {
    status: 'idle',
  });

  useEffect(() => {
    if (state.status === 'success') toast.success(successMessage);
    else if (state.status === 'error') {
      if (state.message === 'validation') toast.error('Champs invalides');
      else toast.error('Erreur lors de la sauvegarde');
    }
  }, [state, successMessage]);

  const fieldErrors = state.status === 'error' ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Nom</Label>
        <Input id="name" name="name" type="text" defaultValue={values.name} maxLength={100} />
        {fieldErrors?.name && <p className="text-sm text-red-600">{fieldErrors.name}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="prompt">Prompt</Label>
        <Textarea
          id="prompt"
          name="prompt"
          defaultValue={values.prompt}
          maxLength={2000}
          rows={6}
        />
        {fieldErrors?.prompt && <p className="text-sm text-red-600">{fieldErrors.prompt}</p>}
      </div>

      <SubmitButton mode={mode} />
    </form>
  );
}
```

Changements vs état actuel :
- `Initial` ne contient plus `slug`.
- `EMPTY_INITIAL` ne contient plus `slug`.
- Le `<div>` `<Input id="slug" name="slug" ...>` est retiré entièrement.
- Le `useEffect` ne contient plus la branche `if (state.message === 'duplicate-slug') ...`.
- Note : l'ellipsis `…` dans `'Enregistrement…'` est U+2026 (caractère unicode unique), pas trois points ASCII.

- [ ] **Step 5: Modifier `src/app/(app)/settings/visual-styles/page.tsx` (liste)**

Nouveau contenu intégral :

```tsx
import { headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { auth } from '@/lib/auth/server';
import { listVisualStyles } from '@/lib/db/repositories/visual-styles';

export default async function VisualStylesListPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/signin');

  const styles = await listVisualStyles(session.user.id);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Styles visuels</h2>
          <p className="text-sm text-neutral-600">
            Mini-prompts injectés dans la pipeline d'image.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/settings/visual-styles/new" />}>
          + Nouveau
        </Button>
      </header>

      {styles.length === 0 ? (
        <p className="text-sm text-neutral-600">Aucun style pour le moment.</p>
      ) : (
        <ul className="space-y-3">
          {styles.map((s) => (
            <li key={s.id}>
              <Link href={`/settings/visual-styles/${s.id}`} className="block">
                <Card className="p-4 hover:bg-neutral-50">
                  <p className="font-medium">{s.name}</p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

Changement vs état actuel : la card ne contient plus que `<p className="font-medium">{s.name}</p>`. Le `<p className="text-xs text-neutral-500">{s.slug}</p>` est retiré.

Si la version actuelle a un ordre d'imports différent post-biome, garde l'ordre auto. L'essentiel est le contenu du JSX.

- [ ] **Step 6: Modifier `src/app/(app)/settings/visual-styles/[id]/page.tsx` (edit)**

Nouveau contenu intégral :

```tsx
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth/server';
import { getVisualStyle } from '@/lib/db/repositories/visual-styles';
import { VisualStyleForm } from '../visual-style-form';
import { deleteVisualStyleActionRaw, updateVisualStyleAction } from './actions';
import { DangerZone } from './danger-zone';

export default async function EditVisualStylePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/signin');

  const { id } = await params;
  const style = await getVisualStyle(session.user.id, id);
  if (!style) notFound();

  const updateAction = updateVisualStyleAction.bind(null, id);
  const deleteAction = deleteVisualStyleActionRaw.bind(null, id);

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold">Éditer le style</h2>
      </header>

      <VisualStyleForm
        mode="edit"
        initial={{ name: style.name, prompt: style.prompt }}
        action={updateAction}
        successMessage="Style mis à jour"
      />

      <hr />
      <DangerZone deleteAction={deleteAction} />
    </div>
  );
}
```

Changement : `initial={{ name: style.name, prompt: style.prompt }}` (plus de `slug: style.slug`).

- [ ] **Step 7: Modifier `test/integration/visual-styles-repository.test.ts`**

Nouveau contenu intégral :

```ts
import { describe, expect, test } from 'vitest';
import { db } from '@/lib/db/client';
import {
  createVisualStyle,
  deleteVisualStyle,
  getVisualStyle,
  listVisualStyles,
  updateVisualStyle,
} from '@/lib/db/repositories/visual-styles';
import { user } from '@/lib/db/schema';

async function makeUser(id: string, email: string) {
  await db.insert(user).values({ id, email });
}

const SAMPLE = {
  name: 'Cinematic',
  prompt: 'rendu cinématographique, lumière diffuse',
};

describe('visual_styles repository', () => {
  test('createVisualStyle insère une row', async () => {
    await makeUser('u1', 'a@test.com');
    const s = await createVisualStyle('u1', SAMPLE);
    expect(s.id).toMatch(/^[a-z0-9]{20,30}$/);
    expect(s.userId).toBe('u1');
    expect(s.name).toBe('Cinematic');
    expect(s.prompt).toBe(SAMPLE.prompt);
  });

  test('getVisualStyle retourne la row', async () => {
    await makeUser('u1', 'a@test.com');
    const created = await createVisualStyle('u1', SAMPLE);
    const found = await getVisualStyle('u1', created.id);
    expect(found?.name).toBe('Cinematic');
  });

  test('listVisualStyles retourne tous les styles du user', async () => {
    await makeUser('u1', 'a@test.com');
    await createVisualStyle('u1', SAMPLE);
    await createVisualStyle('u1', { ...SAMPLE, name: 'Cinematic 2' });
    const rows = await listVisualStyles('u1');
    expect(rows).toHaveLength(2);
  });

  test('updateVisualStyle modifie prompt + updated_at', async () => {
    await makeUser('u1', 'a@test.com');
    const created = await createVisualStyle('u1', SAMPLE);
    const before = created.updatedAt;
    await new Promise((r) => setTimeout(r, 1100));
    const updated = await updateVisualStyle('u1', created.id, { prompt: 'nouveau prompt' });
    expect(updated?.prompt).toBe('nouveau prompt');
    expect(updated!.updatedAt.getTime()).toBeGreaterThan(before.getTime());
  });

  test('deleteVisualStyle supprime la row', async () => {
    await makeUser('u1', 'a@test.com');
    const created = await createVisualStyle('u1', SAMPLE);
    await deleteVisualStyle('u1', created.id);
    expect(await getVisualStyle('u1', created.id)).toBeUndefined();
  });
});
```

Changements vs version actuelle :
- `SAMPLE` : plus de `slug`.
- Test `'createVisualStyle retourne undefined sur conflit (user_id, slug)'` retiré.
- Test `listVisualStyles` : la deuxième création utilise `{ ...SAMPLE, name: 'Cinematic 2' }` au lieu de `{ ...SAMPLE, slug: 'cinematic-2' }`.
- Comme `createVisualStyle` retourne maintenant `VisualStyle` (non-optional), les `s?.id`, `s?.userId`, `s?.name`, `s?.prompt` deviennent `s.id`, `s.userId`, etc. Idem `created!.id` → `created.id`. Idem `created!.updatedAt` reste avec `!` car `updateVisualStyle` retourne toujours `| undefined` (peut être `undefined` si la row n'existe plus, théoriquement) : garde `updated!`.
- Total : 5 tests au lieu de 6.

- [ ] **Step 8: Modifier `test/integration/visual-style-create-action.test.ts`**

Nouveau contenu intégral :

```ts
import { describe, expect, test } from 'vitest';
import { createVisualStyleCore } from '@/app/(app)/settings/visual-styles/new/actions-core';
import { db } from '@/lib/db/client';
import { listVisualStyles } from '@/lib/db/repositories/visual-styles';
import { user } from '@/lib/db/schema';

async function makeUser(id: string, email: string) {
  await db.insert(user).values({ id, email });
}

function fd(values: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.append(k, v);
  return f;
}

describe('createVisualStyleCore', () => {
  test('success : crée le style', async () => {
    await makeUser('u1', 'a@test.com');
    const result = await createVisualStyleCore(
      'u1',
      fd({ name: 'Cinematic', prompt: 'rendu cinéma' }),
    );
    expect(result.status).toBe('success');

    const rows = await listVisualStyles('u1');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe('Cinematic');
  });

  test('validation error : name vide', async () => {
    await makeUser('u1', 'a@test.com');
    const result = await createVisualStyleCore(
      'u1',
      fd({ name: '', prompt: 'P' }),
    );
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.fieldErrors?.name).toBeDefined();
    }
  });
});
```

Changements :
- Import `createVisualStyle` (non utilisé après suppression du test de conflit) retiré.
- Test `'validation error : slug invalide'` retiré.
- Test `'duplicate-slug : retourne erreur sur conflit'` retiré.
- Le test success vérifie maintenant le `name` au lieu du `slug`.
- Ajout d'un test minimal sur la validation : `name: ''` doit déclencher l'erreur `fieldErrors.name`. Cohérent avec le pattern des autres tests d'actions.

- [ ] **Step 9: Modifier `test/integration/visual-style-edit-action.test.ts`**

Nouveau contenu intégral :

```ts
import { describe, expect, test } from 'vitest';
import {
  deleteVisualStyleCore,
  updateVisualStyleCore,
} from '@/app/(app)/settings/visual-styles/[id]/actions-core';
import { db } from '@/lib/db/client';
import { createVisualStyle, getVisualStyle } from '@/lib/db/repositories/visual-styles';
import { user } from '@/lib/db/schema';

async function makeUser(id: string, email: string) {
  await db.insert(user).values({ id, email });
}

function fd(values: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.append(k, v);
  return f;
}

describe('updateVisualStyleCore', () => {
  test('success : modifie le prompt', async () => {
    await makeUser('u1', 'a@test.com');
    const created = await createVisualStyle('u1', { name: 'X', prompt: 'orig' });
    const result = await updateVisualStyleCore(
      'u1',
      created.id,
      fd({ name: 'X', prompt: 'nouveau' }),
    );
    expect(result.status).toBe('success');
    expect((await getVisualStyle('u1', created.id))?.prompt).toBe('nouveau');
  });

  test("update sur style d'un autre user : not-found", async () => {
    await makeUser('u1', 'a@test.com');
    await makeUser('u2', 'b@test.com');
    const owned = await createVisualStyle('u1', { name: 'X', prompt: 'orig' });
    const result = await updateVisualStyleCore(
      'u2',
      owned.id,
      fd({ name: 'Hacked', prompt: 'hacked' }),
    );
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.message).toBe('not-found');
    }
  });
});

describe('deleteVisualStyleCore', () => {
  test('success : supprime', async () => {
    await makeUser('u1', 'a@test.com');
    const created = await createVisualStyle('u1', { name: 'X', prompt: 'P' });
    const result = await deleteVisualStyleCore('u1', created.id);
    expect(result.status).toBe('success');
    expect(await getVisualStyle('u1', created.id)).toBeUndefined();
  });
});
```

Changements :
- Les 3 appels à `createVisualStyle(...)` ne passent plus `slug`, seulement `{ name, prompt }`.
- Les 2 appels à `fd({...})` ne passent plus `slug`, seulement `{ name, prompt }`.
- `created!.id`, `owned!.id` → `created.id`, `owned.id` (return non-optional).

- [ ] **Step 10: Modifier `test/integration/tenant-isolation.test.ts`**

Dans le bloc `runTenantIsolationSuite('visual_styles', { ... })` à la fin du fichier, retirer la clé `slug: 'sample'` du `seed`. Avant :

```ts
runTenantIsolationSuite('visual_styles', {
  seed: (uid) =>
    createVisualStyle(uid, {
      name: 'Sample',
      slug: 'sample',
      prompt: 'rendu sample',
    }) as Promise<{ id: string; name: string }>,
  rowId: (r) => r.id,
  reload: (uid, id) => getVisualStyle(uid, id),
  updatePatch: { name: 'hacked' },
  updateAssertions: (row) => {
    expect(row.name).toBe('Sample');
  },
  get: getVisualStyle,
  list: listVisualStyles,
  update: updateVisualStyle,
  delete: deleteVisualStyle,
});
```

Après :

```ts
runTenantIsolationSuite('visual_styles', {
  seed: (uid) =>
    createVisualStyle(uid, {
      name: 'Sample',
      prompt: 'rendu sample',
    }) as Promise<{ id: string; name: string }>,
  rowId: (r) => r.id,
  reload: (uid, id) => getVisualStyle(uid, id),
  updatePatch: { name: 'hacked' },
  updateAssertions: (row) => {
    expect(row.name).toBe('Sample');
  },
  get: getVisualStyle,
  list: listVisualStyles,
  update: updateVisualStyle,
  delete: deleteVisualStyle,
});
```

Le cast `as Promise<{ id: string; name: string }>` peut maintenant être retiré aussi (puisque `createVisualStyle` retourne `Promise<VisualStyle>` non-optional, et `VisualStyle` est assignable à `{ id: string; name: string }`), mais le garder ne casse rien — laisser tel quel pour minimiser le diff. Le `writing_templates` voisin garde son cast pour sa propre raison (slug conflict toujours possible là-bas).

Ne touche à rien d'autre dans ce fichier.

- [ ] **Step 11: Modifier `test/e2e/settings-editorial.spec.ts`**

Dans le test `'visual_styles create flow : liste vide, créer un style'`, retirer la ligne `await page.fill('input[name="slug"]', 'cinematic');`. Le bloc concerné devient :

```ts
test('visual_styles create flow : liste vide, créer un style', async ({ page }) => {
  await signup(page, `pw-vs-${Date.now()}@test.invalid`);

  await page.goto('/settings/visual-styles');
  await expect(page.getByText('Aucun style pour le moment')).toBeVisible();

  await page.click('text=+ Nouveau');
  await page.fill('input[name="name"]', 'Cinematic');
  await page.fill('textarea[name="prompt"]', 'rendu cinéma diffus');
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL(/\/settings\/visual-styles$/);
  await expect(page.getByText('Cinematic')).toBeVisible();
});
```

Ne touche pas aux autres tests E2E.

- [ ] **Step 12: Modifier le schéma (`src/lib/db/schemas/visual-styles.ts`)**

Nouveau contenu intégral :

```ts
import { index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth';

export const visualStyles = pgTable(
  'visual_styles',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    prompt: text('prompt').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [index('visual_styles_user_id_idx').on(table.userId)],
);

export type VisualStyle = typeof visualStyles.$inferSelect;
```

Changements :
- Import : retirer `unique`.
- Champ `slug` retiré.
- Tableau retour du callback : ne contient plus que `index(...)` (plus de `unique(...)`).

- [ ] **Step 13: Générer la migration**

Run: `cd /Users/ManuAVQN/Code/content-os-v2 && npm run db:generate`
Expected: création d'un nouveau fichier `drizzle/0003_<adjectif>_<nom>.sql` qui doit contenir :
- `ALTER TABLE "visual_styles" DROP CONSTRAINT "visual_styles_user_id_slug_unique";`
- `ALTER TABLE "visual_styles" DROP COLUMN "slug";`

Plus un snapshot `drizzle/meta/0003_snapshot.json` et une entrée ajoutée dans `drizzle/meta/_journal.json`.

- [ ] **Step 14: Inspecter la migration**

Run: `cat drizzle/0003_*.sql`
Vérifier que les deux `ALTER TABLE` sont présents et qu'aucun autre changement n'a été émis (le diff ne devrait toucher QUE la table `visual_styles`).

Si drizzle émet l'ordre `DROP COLUMN` AVANT `DROP CONSTRAINT`, c'est OK : Postgres autorise le drop d'une colonne référencée par une UNIQUE, ce qui drop la contrainte en cascade. Mais l'ordre attendu de drizzle-kit est `DROP CONSTRAINT` d'abord. Quel que soit l'ordre émis, accepter.

- [ ] **Step 15: Appliquer la migration**

Run: `cd /Users/ManuAVQN/Code/content-os-v2 && npm run db:migrate`
Expected: "migrations applied successfully".

Vérifier l'état réel de la table :
```bash
docker compose exec -T postgres psql -U postgres -d contentos -c '\d visual_styles'
```
Expected: pas de colonne `slug`, pas de contrainte `visual_styles_user_id_slug_unique`. L'index `visual_styles_user_id_idx` reste.

- [ ] **Step 16: Lint**

Run: `cd /Users/ManuAVQN/Code/content-os-v2 && npm run lint`
Expected: vert. Biome peut auto-reorder les imports dans les fichiers modifiés ; accepter.

- [ ] **Step 17: Tests integration**

Run: `cd /Users/ManuAVQN/Code/content-os-v2 && npm run test:integration`
Expected: tous verts. Les compteurs spécifiques :
- `visual-styles-repository.test.ts` : 5 tests (au lieu de 6, le test de conflit a disparu).
- `visual-style-create-action.test.ts` : 2 tests au lieu de 3 (retire 'validation slug' + 'duplicate-slug', ajoute 'validation name vide'). Net : -1.
- `visual-style-edit-action.test.ts` : 3 tests (success update + cross-tenant + delete). Inchangé.
- `tenant-isolation.test.ts` : nombre inchangé (le harness exécute toujours le même nombre de tests par fixture).
- Le reste de la suite intacte.

Total attendu : 110 tests (112 actuels moins 2 : -1 sur repo, -1 sur create-action).

- [ ] **Step 18: Build Next.js**

Run: `cd /Users/ManuAVQN/Code/content-os-v2 && npm run build`
Expected: build vert, toutes les routes `/settings/visual-styles*` restent listées.

- [ ] **Step 19: Vérifier db:generate idempotent**

Run: `cd /Users/ManuAVQN/Code/content-os-v2 && npm run db:generate`
Expected: "No schema changes, nothing to migrate" (ou équivalent).

Si un diff sort, STOP — il y a un mismatch entre le schema source et le snapshot 0003.

- [ ] **Step 20: Commit**

```bash
cd /Users/ManuAVQN/Code/content-os-v2
git add src/lib/db/schemas/visual-styles.ts src/lib/db/repositories/visual-styles.ts \
  'src/app/(app)/settings/visual-styles/' \
  test/integration/visual-styles-repository.test.ts \
  test/integration/visual-style-create-action.test.ts \
  test/integration/visual-style-edit-action.test.ts \
  test/integration/tenant-isolation.test.ts \
  test/e2e/settings-editorial.spec.ts \
  drizzle/
git commit -m "$(cat <<'EOF'
🤖 refactor(visual_styles): drop slug column

Slug était legacy v1. En v2 les visual_styles sont référencés par id
(pas de FK ni de routing par slug), donc le champ ne sert à rien.
Suppression complète : schema, migration 0003 (DROP CONSTRAINT +
DROP COLUMN), repo (CreateInput, onConflictDoNothing), actions cores
(Zod, branche duplicate-slug), form, list page, edit page, tous les
tests integration + E2E.

Pas de UNIQUE(name) en remplacement : YAGNI.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: E2E + push + watch CI

Pas de changement de code. Verif finale puis push.

**Files:** aucun.

- [ ] **Step 1: Lancer la suite E2E complète**

Run: `cd /Users/ManuAVQN/Code/content-os-v2 && npm run build && npm run test:e2e`
Expected: 9 tests verts (auth + brand 2 + editorial 6). Durée ~1.3 min (le rate-limit retry sur le 6e signup Better-Auth reste, voir backlog Spec 3).

- [ ] **Step 2: git status clean**

Run: `git status`
Expected: working tree clean.

- [ ] **Step 3: Aperçu du commit à pusher**

Run: `git log --oneline origin/main..HEAD`
Expected: 1 commit, prefix `🤖 refactor(visual_styles):`.

- [ ] **Step 4: Push origin main**

Run: `git push origin main`
Expected: push réussi.

- [ ] **Step 5: Watch CI**

```bash
RUN_ID=$(gh run list --branch main --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$RUN_ID" --exit-status
```
Expected: 5 jobs (lint, unit, integration, worker, e2e) tous verts.

- [ ] **Step 6: Vérifier conclusion CI**

Run: `gh run view "$RUN_ID" --json conclusion --jq '.conclusion'`
Expected: `"success"`.

---

## Notes pour l'exécutant

- **Ordre dans Task 1** : édite d'abord les sources/tests de surface (steps 1-11) PUIS le schema (step 12), PUIS génère + applique la migration (steps 13-15). Si tu modifies le schema avant les consumers, TypeScript et les tests cassent visiblement, mais ce n'est pas grave si tu n'exécutes ni l'un ni l'autre avant que tout soit aligné. Le commit final est atomique.
- **Em-dash** : pas de tiret cadratin nulle part dans le code, les commentaires ou les messages de commit. Les ellipsis unicode `…` (U+2026) dans `'Enregistrement…'` sont OK.
- **Le `Button` est base-ui** : `nativeButton={false} render={<Link ... />}` pour le bouton-lien (cf. Task 13 de Spec 3). Le bouton submit normal (`<Button type="submit">`) marche tel quel.
- **Pas de touch sur writing_templates** : le slug y reste, il sera référencé par le pipeline de génération plus tard.
- **biome auto-fix** : si la lint râle sur l'ordre des imports, lance `npx biome check --write <file>`, vérifie le diff, re-stage si OK.
- **Si `npm run db:generate` au step 19 émet un diff** : c'est un signal que l'édition du schema (step 12) a divergé de l'attendu. Inspecter et corriger.
