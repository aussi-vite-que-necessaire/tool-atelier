# Spec 3 (Voice + writing_templates + visual_briefing) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter 4 entités scopées par user (voice, visual_briefing, writing_templates, visual_styles), seeder leurs défauts au signup via le hook Better-Auth existant, exposer 4 pages CRUD sous `/settings/...`, prouver l'isolation tenant par tests.

**Architecture:** Schémas Drizzle dans `src/lib/db/schemas/` (1 fichier par entité, barrel alphabétique). Repositories CRUD scopés `user_id` (pattern Spec 2). Hook Better-Auth existant remplacé par un appel unique `seedUserDefaults(userId)` qui upsert settings + voice + visual_briefing et crée le writing_template par défaut. Pages Server Components avec Server Actions wrapper/core split (pattern Spec 2 Brand). Forms client `useActionState` + `useFormStatus` + sonner toasts. Confirms delete via `<dialog>` natif HTML.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM 0.45, Postgres 16, Better-Auth 1.6, Vitest 3, Playwright, Tailwind v4, shadcn/ui (button/input/label/textarea/card/sonner déjà installés), `@paralleldrive/cuid2`, Zod 4, sonner.

**Repo cible:** `/Users/ManuAVQN/Code/content-os-v2/` (branche `main`).

---

## Phase 1 : Schémas Drizzle + migration

### Task 1: 4 schemas + barrel update

Pure ajout structurel. Aucun test à faire passer ; juste TS + lint.

**Files:**
- Create: `src/lib/db/schemas/voice.ts`
- Create: `src/lib/db/schemas/visual-briefing.ts`
- Create: `src/lib/db/schemas/writing-templates.ts`
- Create: `src/lib/db/schemas/visual-styles.ts`
- Modify: `src/lib/db/schema.ts` (ajouter les 4 exports, biome forcera l'ordre alphabétique)

- [ ] **Step 1: Créer `src/lib/db/schemas/voice.ts`**

```ts
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth';

export const voice = pgTable('voice', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type Voice = typeof voice.$inferSelect;
```

- [ ] **Step 2: Créer `src/lib/db/schemas/visual-briefing.ts`**

```ts
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth';

export const visualBriefing = pgTable('visual_briefing', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type VisualBriefing = typeof visualBriefing.$inferSelect;
```

- [ ] **Step 3: Créer `src/lib/db/schemas/writing-templates.ts`**

```ts
import { index, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { user } from './auth';

export const writingTemplates = pgTable(
  'writing_templates',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    platform: text('platform').notNull().default('linkedin'),
    structure: text('structure').notNull(),
    writingRules: text('writing_rules'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('writing_templates_user_id_idx').on(table.userId),
    unique('writing_templates_user_id_slug_unique').on(table.userId, table.slug),
  ],
);

export type WritingTemplate = typeof writingTemplates.$inferSelect;
```

- [ ] **Step 4: Créer `src/lib/db/schemas/visual-styles.ts`**

```ts
import { index, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { user } from './auth';

export const visualStyles = pgTable(
  'visual_styles',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    prompt: text('prompt').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('visual_styles_user_id_idx').on(table.userId),
    unique('visual_styles_user_id_slug_unique').on(table.userId, table.slug),
  ],
);

export type VisualStyle = typeof visualStyles.$inferSelect;
```

- [ ] **Step 5: Ajouter les 4 exports dans `src/lib/db/schema.ts`**

Ouvrir le fichier (qui re-exporte déjà 6 modules) et ajouter 4 lignes. Biome organisera l'ordre alphabétique automatiquement (auth, ideas, media, posts, publications, settings, visual_briefing, visual_styles, voice, writing_templates dans le nouvel état). Ajouter telles quelles à la fin, puis lancer biome :

```ts
export * from './schemas/visual-briefing';
export * from './schemas/visual-styles';
export * from './schemas/voice';
export * from './schemas/writing-templates';
```

- [ ] **Step 6: Lint pour forcer l'ordre alphabétique + vérifier compilation**

Run: `npm run lint`
Expected: vert. Biome aura réordonné les exports dans schema.ts.

- [ ] **Step 7: Vérifier que les tests existants passent toujours**

Run: `npm test`
Expected: vert (les 64 tests Spec 1+2 continuent de passer).

(Pas de commit séparé pour cette task : on commit après Task 2 quand la migration est en place.)

---

### Task 2: Générer + appliquer migration + étendre setup-integration

**Files:**
- Create: `drizzle/0002_*.sql` (nom auto-généré par drizzle-kit)
- Create: `drizzle/meta/0002_snapshot.json` + entry dans `drizzle/meta/_journal.json`
- Modify: `test/setup-integration.ts` (truncate les 4 nouvelles tables avant chaque test)

- [ ] **Step 1: Vérifier docker compose up**

Run: `docker compose ps`
Expected: postgres et redis healthy. Si non, `docker compose up -d`.

- [ ] **Step 2: Générer la migration**

Run: `npm run db:generate`
Expected: création d'un fichier `drizzle/0002_<adjectif_nom>.sql` qui contient :
- 4 `CREATE TABLE` (voice, visual_briefing, writing_templates, visual_styles).
- 4 `ALTER TABLE ... ADD CONSTRAINT FOREIGN KEY ... user_id REFERENCES "user"(id) ON DELETE CASCADE`.
- 2 `ALTER TABLE ... ADD CONSTRAINT writing_templates_user_id_slug_unique UNIQUE(user_id, slug)` (idem visual_styles).
- 2 `CREATE INDEX writing_templates_user_id_idx ON writing_templates(user_id)` (idem visual_styles).

Inspecter le fichier généré pour valider qu'il contient bien tout ça avant de continuer.

- [ ] **Step 3: Appliquer la migration**

Run: `npm run db:migrate`
Expected: "migrations applied successfully". Verify avec `docker compose exec -T postgres psql -U postgres -d contentos -c '\dt'` : les 4 nouvelles tables apparaissent.

- [ ] **Step 4: Étendre `test/setup-integration.ts`**

Le fichier actuel truncate 10 tables dans l'ordre topologique. Ajouter les 4 nouvelles AVANT settings (toutes dépendent de user uniquement, l'ordre relatif n'importe pas mais biome organisera) :

Remplacer le contenu par :

```ts
import { beforeEach } from 'vitest';
import { db } from '@/lib/db/client';
import {
  account,
  ideas,
  imageAssets,
  media,
  posts,
  publications,
  session,
  settings,
  user,
  verification,
  visualBriefing,
  visualStyles,
  voice,
  writingTemplates,
} from '@/lib/db/schema';

// Reset complet de la DB avant chaque test integration/worker pour isolation.
// L'ordre respecte les FK : on supprime les tables référençantes avant les référencées.
beforeEach(async () => {
  await db.delete(imageAssets);
  await db.delete(publications);
  await db.delete(posts);
  await db.delete(media);
  await db.delete(ideas);
  await db.delete(visualStyles);
  await db.delete(writingTemplates);
  await db.delete(visualBriefing);
  await db.delete(voice);
  await db.delete(settings);
  await db.delete(account);
  await db.delete(session);
  await db.delete(verification);
  await db.delete(user);
});
```

- [ ] **Step 5: Lint + tests**

Run: `npm run lint && npm test`
Expected: vert. Biome peut réordonner les imports (accepter l'auto-fix).

- [ ] **Step 6: Vérifier qu'un nouveau `db:generate` ne produit aucun diff**

Run: `npm run db:generate`
Expected: "No schema changes, nothing to migrate".

- [ ] **Step 7: Commit**

```bash
git add src/lib/db/ drizzle/ test/setup-integration.ts
git commit -m "$(cat <<'EOF'
🤖 feat(db): schemas + migration voice, visual_briefing, writing_templates, visual_styles

4 nouvelles tables scopées user_id avec FK ON DELETE CASCADE.
Singletons voice et visual_briefing avec user_id PK (pattern settings).
Listes writing_templates et visual_styles avec PK cuid2, UNIQUE(user_id, slug)
et index user_id. Truncate étendu dans setup-integration.ts.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2 : Default seed constants

### Task 3: Fichier `src/lib/db/seeds/user-defaults.ts` avec les 3 constantes

Pas encore de fonction de seeding. Juste les 3 constantes que les repos voice/visual_briefing et le hook utiliseront. Le contenu est copié verbatim du repo v1 `content-os` (situé à `/Users/ManuAVQN/Code/content-os/`).

**Files:**
- Create: `src/lib/db/seeds/user-defaults.ts`

- [ ] **Step 1: Créer le fichier avec les 3 constantes**

```ts
// Contenu seed par défaut pour les nouveaux users.
// Copié verbatim du repo v1 (content-os) au moment du portage Spec 3.

export const DEFAULT_VOICE_CONTENT = `# Voix éditoriale

Identité immuable de l'auteur quand il écrit. Indépendante du format, de la plateforme et du type de post. S'applique à toutes les générations.

## Persona

Fondateur indépendant. Construit en solo, à l'intersection produit, stratégie et exécution. Pratique la production éditoriale assistée par agents IA. Écrit pour ses pairs : fondateurs, opérateurs solo, créateurs de contenu pro.

## Ton

- Direct, factuel, tranché. L'auteur ne hedge pas, il assume une position.
- Première personne du singulier, ou phrase déclarative.
- Le post raconte une observation, une décision, ou un point de vue. Pas un tutoriel.
- Pas d'analogies niaises, pas de métaphores filées, pas de "imaginez si...".

## Anti-patterns absolus

Inviolables, peu importe le format ou le template.

- **Jamais de tiret cadratin** (\`—\`). Remplacer par virgule, parenthèses ou deux-points.
- **Pas de staccato creux** : éviter les cascades de phrases tronquées style "Il la lit. Il l'applique. Il avance." C'est du bruit.
- **Pas de négation performative** : ne jamais décrire ce qu'on "ne fait pas". Reformuler positivement ou supprimer.
- **Pas de hook teaser systématique** "hier j'ai... demain je...". Préférer un hook factuel ou tranché.
- **Pas de répétitions** : ne pas répéter les mots-clés saillants entre corps et closure.
`;

export const DEFAULT_VISUAL_BRIEFING_CONTENT = `Tu transformes un post en brief visuel de 2 à 3 phrases destiné à un modèle de génération d'image.

Ne décris ni la mise en page finale, ni le style (palette, ambiance, médium) : ces aspects appartiennent au template visuel et seront ajoutés ensuite. Concentre-toi uniquement sur le sujet à représenter : objets, lieux, métaphores visuelles, mouvements, gestes, atmosphères du sujet.

Sortie : 2 à 3 phrases, descriptives et concrètes, sans guillemets autour du post, sans meta-commentaire.`;

export const DEFAULT_WRITING_TEMPLATE = {
  name: 'Post LinkedIn standard',
  slug: 'linkedin-standard',
  platform: 'linkedin',
  structure: `Format : post LinkedIn de 800 à 1500 caractères, idéalement autour de 1000.

Squelette :
- HOOK : 1 à 2 phrases d'accroche, factuelles ou tranchées. Doivent pouvoir se lire seules.
- CORPS : 2 à 4 idées qui se déroulent. Aération avec retours à la ligne. Pas de paragraphes denses.
- CLOSURE : 1 phrase qui ouvre, propose une suite de pensée, ou tranche. Ne récapitule pas le hook.`,
  writingRules: null as string | null,
};
```

Note : le tiret cadratin dans DEFAULT_VOICE_CONTENT est inside a template literal (`` `—` ``) et fait partie du contenu literal de la voix éditoriale qui interdit elle-même cet usage. Garder verbatim, ce n'est pas une violation du code rule mais une donnée user.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: vert.

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/seeds/user-defaults.ts
git commit -m "$(cat <<'EOF'
🤖 chore(db): constantes seed pour voice, visual_briefing, writing_template

Contenu par défaut porté verbatim de la v1 (src/prompts/voice.md
et seedInitialVisualBriefing/seedInitialVoiceAndTemplate dans db.ts).
La fonction seedUserDefaults() viendra dans une task suivante, une
fois les repositories en place.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3 : Repositories (TDD)

Pattern uniforme : test integration RED → implémentation GREEN → commit. Tous les tests utilisent `db.insert(user)` direct (pas le hook Better-Auth) parce que le hook n'existe pas encore côté tests.

### Task 4: Repository voice (TDD)

**Files:**
- Create: `test/integration/voice-repository.test.ts`
- Create: `src/lib/db/repositories/voice.ts`

- [ ] **Step 1: Écrire le test integration (RED)**

`test/integration/voice-repository.test.ts` :

```ts
import { describe, expect, test } from 'vitest';
import { db } from '@/lib/db/client';
import { DEFAULT_VOICE_CONTENT } from '@/lib/db/seeds/user-defaults';
import { getVoice, updateVoice, upsertVoice } from '@/lib/db/repositories/voice';
import { user } from '@/lib/db/schema';

async function makeUser(id: string, email: string) {
  await db.insert(user).values({ id, email });
}

describe('voice repository', () => {
  test('getVoice retourne undefined si pas de row', async () => {
    await makeUser('u1', 'a@test.com');
    expect(await getVoice('u1')).toBeUndefined();
  });

  test('upsertVoice crée la row avec le contenu par défaut', async () => {
    await makeUser('u1', 'a@test.com');
    const v = await upsertVoice('u1');
    expect(v.userId).toBe('u1');
    expect(v.content).toBe(DEFAULT_VOICE_CONTENT);

    // Appel idempotent
    const again = await upsertVoice('u1');
    expect(again.content).toBe(DEFAULT_VOICE_CONTENT);
  });

  test('updateVoice modifie le contenu + updated_at', async () => {
    await makeUser('u1', 'a@test.com');
    const created = await upsertVoice('u1');
    const before = created.updatedAt;
    await new Promise((r) => setTimeout(r, 1100));
    const updated = await updateVoice('u1', { content: 'nouveau' });
    expect(updated?.content).toBe('nouveau');
    expect(updated!.updatedAt.getTime()).toBeGreaterThan(before.getTime());
  });
});
```

- [ ] **Step 2: Lancer les tests, observer le RED**

Run: `npm run test:integration -- voice-repository`
Expected: erreur de résolution de module `@/lib/db/repositories/voice`.

- [ ] **Step 3: Implémenter `src/lib/db/repositories/voice.ts`**

```ts
import { eq } from 'drizzle-orm';
import { db } from '../client';
import { DEFAULT_VOICE_CONTENT } from '../seeds/user-defaults';
import { type Voice, voice } from '../schema';

export async function getVoice(userId: string): Promise<Voice | undefined> {
  const rows = await db.select().from(voice).where(eq(voice.userId, userId)).limit(1);
  return rows[0];
}

export async function upsertVoice(userId: string): Promise<Voice> {
  await db
    .insert(voice)
    .values({ userId, content: DEFAULT_VOICE_CONTENT })
    .onConflictDoNothing();
  return (await getVoice(userId))!;
}

export async function updateVoice(
  userId: string,
  patch: { content: string },
): Promise<Voice | undefined> {
  await db
    .update(voice)
    .set({ content: patch.content, updatedAt: new Date() })
    .where(eq(voice.userId, userId));
  return getVoice(userId);
}
```

- [ ] **Step 4: Lancer les tests, observer le GREEN**

Run: `npm run test:integration -- voice-repository`
Expected: 3 tests passent.

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: vert.

- [ ] **Step 6: Commit**

```bash
git add test/integration/voice-repository.test.ts src/lib/db/repositories/voice.ts
git commit -m "$(cat <<'EOF'
🤖 feat(db): repository voice (singleton scopé user_id)

3 fonctions : getVoice, upsertVoice (idempotent via onConflictDoNothing),
updateVoice. Pattern miroir de settings repo (Spec 2).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Repository visual_briefing (TDD)

**Files:**
- Create: `test/integration/visual-briefing-repository.test.ts`
- Create: `src/lib/db/repositories/visual-briefing.ts`

- [ ] **Step 1: Écrire le test integration (RED)**

`test/integration/visual-briefing-repository.test.ts` :

```ts
import { describe, expect, test } from 'vitest';
import { db } from '@/lib/db/client';
import { DEFAULT_VISUAL_BRIEFING_CONTENT } from '@/lib/db/seeds/user-defaults';
import {
  getVisualBriefing,
  updateVisualBriefing,
  upsertVisualBriefing,
} from '@/lib/db/repositories/visual-briefing';
import { user } from '@/lib/db/schema';

async function makeUser(id: string, email: string) {
  await db.insert(user).values({ id, email });
}

describe('visual_briefing repository', () => {
  test('getVisualBriefing retourne undefined si pas de row', async () => {
    await makeUser('u1', 'a@test.com');
    expect(await getVisualBriefing('u1')).toBeUndefined();
  });

  test('upsertVisualBriefing crée la row avec le contenu par défaut', async () => {
    await makeUser('u1', 'a@test.com');
    const v = await upsertVisualBriefing('u1');
    expect(v.userId).toBe('u1');
    expect(v.content).toBe(DEFAULT_VISUAL_BRIEFING_CONTENT);

    const again = await upsertVisualBriefing('u1');
    expect(again.content).toBe(DEFAULT_VISUAL_BRIEFING_CONTENT);
  });

  test('updateVisualBriefing modifie le contenu + updated_at', async () => {
    await makeUser('u1', 'a@test.com');
    const created = await upsertVisualBriefing('u1');
    const before = created.updatedAt;
    await new Promise((r) => setTimeout(r, 1100));
    const updated = await updateVisualBriefing('u1', { content: 'nouveau brief' });
    expect(updated?.content).toBe('nouveau brief');
    expect(updated!.updatedAt.getTime()).toBeGreaterThan(before.getTime());
  });
});
```

- [ ] **Step 2: Lancer les tests, observer le RED**

Run: `npm run test:integration -- visual-briefing-repository`
Expected: erreur de résolution de module.

- [ ] **Step 3: Implémenter `src/lib/db/repositories/visual-briefing.ts`**

```ts
import { eq } from 'drizzle-orm';
import { db } from '../client';
import { DEFAULT_VISUAL_BRIEFING_CONTENT } from '../seeds/user-defaults';
import { type VisualBriefing, visualBriefing } from '../schema';

export async function getVisualBriefing(userId: string): Promise<VisualBriefing | undefined> {
  const rows = await db
    .select()
    .from(visualBriefing)
    .where(eq(visualBriefing.userId, userId))
    .limit(1);
  return rows[0];
}

export async function upsertVisualBriefing(userId: string): Promise<VisualBriefing> {
  await db
    .insert(visualBriefing)
    .values({ userId, content: DEFAULT_VISUAL_BRIEFING_CONTENT })
    .onConflictDoNothing();
  return (await getVisualBriefing(userId))!;
}

export async function updateVisualBriefing(
  userId: string,
  patch: { content: string },
): Promise<VisualBriefing | undefined> {
  await db
    .update(visualBriefing)
    .set({ content: patch.content, updatedAt: new Date() })
    .where(eq(visualBriefing.userId, userId));
  return getVisualBriefing(userId);
}
```

- [ ] **Step 4: Lancer les tests, observer le GREEN**

Run: `npm run test:integration -- visual-briefing-repository`
Expected: 3 tests passent.

- [ ] **Step 5: Lint + commit**

```bash
npm run lint
git add test/integration/visual-briefing-repository.test.ts src/lib/db/repositories/visual-briefing.ts
git commit -m "$(cat <<'EOF'
🤖 feat(db): repository visual_briefing (singleton scopé user_id)

3 fonctions miroirs du repo voice (get, upsert idempotent, update).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Repository writing_templates (TDD)

5 fonctions CRUD. `create` retourne `WritingTemplate | undefined` (undefined si conflit slug).

**Files:**
- Create: `test/integration/writing-templates-repository.test.ts`
- Create: `src/lib/db/repositories/writing-templates.ts`

- [ ] **Step 1: Écrire le test integration (RED)**

`test/integration/writing-templates-repository.test.ts` :

```ts
import { describe, expect, test } from 'vitest';
import { db } from '@/lib/db/client';
import {
  createWritingTemplate,
  deleteWritingTemplate,
  getWritingTemplate,
  listWritingTemplates,
  updateWritingTemplate,
} from '@/lib/db/repositories/writing-templates';
import { user } from '@/lib/db/schema';

async function makeUser(id: string, email: string) {
  await db.insert(user).values({ id, email });
}

const SAMPLE = {
  name: 'Sample',
  slug: 'sample',
  platform: 'linkedin',
  structure: 'HOOK / CORPS / CLOSURE',
  writingRules: null,
};

describe('writing_templates repository', () => {
  test('createWritingTemplate insère une row', async () => {
    await makeUser('u1', 'a@test.com');
    const t = await createWritingTemplate('u1', SAMPLE);
    expect(t?.id).toMatch(/^[a-z0-9]{20,30}$/);
    expect(t?.userId).toBe('u1');
    expect(t?.name).toBe('Sample');
    expect(t?.slug).toBe('sample');
    expect(t?.platform).toBe('linkedin');
    expect(t?.writingRules).toBeNull();
  });

  test('createWritingTemplate retourne undefined sur conflit (user_id, slug)', async () => {
    await makeUser('u1', 'a@test.com');
    await createWritingTemplate('u1', SAMPLE);
    const dup = await createWritingTemplate('u1', SAMPLE);
    expect(dup).toBeUndefined();
  });

  test('getWritingTemplate retourne la row pour le bon user', async () => {
    await makeUser('u1', 'a@test.com');
    const created = await createWritingTemplate('u1', SAMPLE);
    const found = await getWritingTemplate('u1', created!.id);
    expect(found?.name).toBe('Sample');
  });

  test('listWritingTemplates retourne tous les templates du user', async () => {
    await makeUser('u1', 'a@test.com');
    await createWritingTemplate('u1', SAMPLE);
    await createWritingTemplate('u1', { ...SAMPLE, slug: 'sample-2' });
    const rows = await listWritingTemplates('u1');
    expect(rows).toHaveLength(2);
  });

  test('updateWritingTemplate modifie name + updated_at', async () => {
    await makeUser('u1', 'a@test.com');
    const created = await createWritingTemplate('u1', SAMPLE);
    const before = created!.updatedAt;
    await new Promise((r) => setTimeout(r, 1100));
    const updated = await updateWritingTemplate('u1', created!.id, { name: 'Renommé' });
    expect(updated?.name).toBe('Renommé');
    expect(updated!.updatedAt.getTime()).toBeGreaterThan(before.getTime());
  });

  test('deleteWritingTemplate supprime la row', async () => {
    await makeUser('u1', 'a@test.com');
    const created = await createWritingTemplate('u1', SAMPLE);
    await deleteWritingTemplate('u1', created!.id);
    expect(await getWritingTemplate('u1', created!.id)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Lancer les tests, observer le RED**

Run: `npm run test:integration -- writing-templates-repository`
Expected: erreur de résolution de module.

- [ ] **Step 3: Implémenter `src/lib/db/repositories/writing-templates.ts`**

```ts
import { and, eq } from 'drizzle-orm';
import { db } from '../client';
import { createId } from '../id';
import { type WritingTemplate, writingTemplates } from '../schema';

export type CreateWritingTemplateInput = {
  name: string;
  slug: string;
  platform: string;
  structure: string;
  writingRules?: string | null;
};

export type UpdateWritingTemplatePatch = Partial<{
  name: string;
  slug: string;
  platform: string;
  structure: string;
  writingRules: string | null;
}>;

export async function createWritingTemplate(
  userId: string,
  data: CreateWritingTemplateInput,
): Promise<WritingTemplate | undefined> {
  const id = createId();
  const [row] = await db
    .insert(writingTemplates)
    .values({
      id,
      userId,
      name: data.name,
      slug: data.slug,
      platform: data.platform,
      structure: data.structure,
      writingRules: data.writingRules ?? null,
    })
    .onConflictDoNothing({ target: [writingTemplates.userId, writingTemplates.slug] })
    .returning();
  return row;
}

export async function getWritingTemplate(
  userId: string,
  id: string,
): Promise<WritingTemplate | undefined> {
  const rows = await db
    .select()
    .from(writingTemplates)
    .where(and(eq(writingTemplates.id, id), eq(writingTemplates.userId, userId)))
    .limit(1);
  return rows[0];
}

export async function listWritingTemplates(userId: string): Promise<WritingTemplate[]> {
  return db.select().from(writingTemplates).where(eq(writingTemplates.userId, userId));
}

export async function updateWritingTemplate(
  userId: string,
  id: string,
  patch: UpdateWritingTemplatePatch,
): Promise<WritingTemplate | undefined> {
  const rows = await db
    .update(writingTemplates)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(writingTemplates.id, id), eq(writingTemplates.userId, userId)))
    .returning();
  return rows[0];
}

export async function deleteWritingTemplate(userId: string, id: string): Promise<void> {
  await db
    .delete(writingTemplates)
    .where(and(eq(writingTemplates.id, id), eq(writingTemplates.userId, userId)));
}
```

- [ ] **Step 4: Lancer les tests, observer le GREEN**

Run: `npm run test:integration -- writing-templates-repository`
Expected: 6 tests passent (5 happy path + 1 conflit slug).

- [ ] **Step 5: Lint + commit**

```bash
npm run lint
git add test/integration/writing-templates-repository.test.ts src/lib/db/repositories/writing-templates.ts
git commit -m "$(cat <<'EOF'
🤖 feat(db): repository writing_templates CRUD scopé user_id

5 fonctions CRUD + onConflictDoNothing sur (user_id, slug) pour
permettre l'idempotence du seed. createWritingTemplate retourne
undefined sur conflit, l'appelant décide (hook ignore, action
remonte une erreur de validation).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Repository visual_styles (TDD)

**Files:**
- Create: `test/integration/visual-styles-repository.test.ts`
- Create: `src/lib/db/repositories/visual-styles.ts`

- [ ] **Step 1: Écrire le test integration (RED)**

`test/integration/visual-styles-repository.test.ts` :

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
  slug: 'cinematic',
  prompt: 'rendu cinématographique, lumière diffuse',
};

describe('visual_styles repository', () => {
  test('createVisualStyle insère une row', async () => {
    await makeUser('u1', 'a@test.com');
    const s = await createVisualStyle('u1', SAMPLE);
    expect(s?.id).toMatch(/^[a-z0-9]{20,30}$/);
    expect(s?.userId).toBe('u1');
    expect(s?.name).toBe('Cinematic');
    expect(s?.prompt).toBe(SAMPLE.prompt);
  });

  test('createVisualStyle retourne undefined sur conflit (user_id, slug)', async () => {
    await makeUser('u1', 'a@test.com');
    await createVisualStyle('u1', SAMPLE);
    const dup = await createVisualStyle('u1', SAMPLE);
    expect(dup).toBeUndefined();
  });

  test('getVisualStyle retourne la row', async () => {
    await makeUser('u1', 'a@test.com');
    const created = await createVisualStyle('u1', SAMPLE);
    const found = await getVisualStyle('u1', created!.id);
    expect(found?.name).toBe('Cinematic');
  });

  test('listVisualStyles retourne tous les styles du user', async () => {
    await makeUser('u1', 'a@test.com');
    await createVisualStyle('u1', SAMPLE);
    await createVisualStyle('u1', { ...SAMPLE, slug: 'cinematic-2' });
    const rows = await listVisualStyles('u1');
    expect(rows).toHaveLength(2);
  });

  test('updateVisualStyle modifie prompt + updated_at', async () => {
    await makeUser('u1', 'a@test.com');
    const created = await createVisualStyle('u1', SAMPLE);
    const before = created!.updatedAt;
    await new Promise((r) => setTimeout(r, 1100));
    const updated = await updateVisualStyle('u1', created!.id, { prompt: 'nouveau prompt' });
    expect(updated?.prompt).toBe('nouveau prompt');
    expect(updated!.updatedAt.getTime()).toBeGreaterThan(before.getTime());
  });

  test('deleteVisualStyle supprime la row', async () => {
    await makeUser('u1', 'a@test.com');
    const created = await createVisualStyle('u1', SAMPLE);
    await deleteVisualStyle('u1', created!.id);
    expect(await getVisualStyle('u1', created!.id)).toBeUndefined();
  });
});
```

- [ ] **Step 2: RED**

Run: `npm run test:integration -- visual-styles-repository`
Expected: erreur de résolution de module.

- [ ] **Step 3: Implémenter `src/lib/db/repositories/visual-styles.ts`**

```ts
import { and, eq } from 'drizzle-orm';
import { db } from '../client';
import { createId } from '../id';
import { type VisualStyle, visualStyles } from '../schema';

export type CreateVisualStyleInput = {
  name: string;
  slug: string;
  prompt: string;
};

export type UpdateVisualStylePatch = Partial<CreateVisualStyleInput>;

export async function createVisualStyle(
  userId: string,
  data: CreateVisualStyleInput,
): Promise<VisualStyle | undefined> {
  const id = createId();
  const [row] = await db
    .insert(visualStyles)
    .values({ id, userId, ...data })
    .onConflictDoNothing({ target: [visualStyles.userId, visualStyles.slug] })
    .returning();
  return row;
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

- [ ] **Step 4: GREEN + lint + commit**

```bash
npm run test:integration -- visual-styles-repository
npm run lint
git add test/integration/visual-styles-repository.test.ts src/lib/db/repositories/visual-styles.ts
git commit -m "$(cat <<'EOF'
🤖 feat(db): repository visual_styles CRUD scopé user_id

Pattern miroir de writing-templates : 5 fonctions CRUD + onConflictDoNothing
sur (user_id, slug).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4 : Centralized seed function + Better-Auth hook

### Task 8: Fonction `seedUserDefaults` + tests (TDD)

**Files:**
- Modify: `src/lib/db/seeds/user-defaults.ts` (ajout de la fonction)
- Create: `test/integration/user-defaults-seed.test.ts`

- [ ] **Step 1: Écrire le test integration (RED)**

`test/integration/user-defaults-seed.test.ts` :

```ts
import { describe, expect, test } from 'vitest';
import { db } from '@/lib/db/client';
import {
  DEFAULT_VISUAL_BRIEFING_CONTENT,
  DEFAULT_VOICE_CONTENT,
  DEFAULT_WRITING_TEMPLATE,
  seedUserDefaults,
} from '@/lib/db/seeds/user-defaults';
import { getSettings } from '@/lib/db/repositories/settings';
import { getVisualBriefing } from '@/lib/db/repositories/visual-briefing';
import { getVoice } from '@/lib/db/repositories/voice';
import { listWritingTemplates } from '@/lib/db/repositories/writing-templates';
import { user } from '@/lib/db/schema';

async function makeUser(id: string, email: string) {
  await db.insert(user).values({ id, email });
}

describe('seedUserDefaults', () => {
  test('crée settings + voice + visual_briefing + writing_template par défaut', async () => {
    await makeUser('u1', 'a@test.com');
    await seedUserDefaults('u1');

    const settings = await getSettings('u1');
    expect(settings).toBeDefined();
    expect(settings?.brandName).toBe('');

    const voice = await getVoice('u1');
    expect(voice?.content).toBe(DEFAULT_VOICE_CONTENT);

    const briefing = await getVisualBriefing('u1');
    expect(briefing?.content).toBe(DEFAULT_VISUAL_BRIEFING_CONTENT);

    const templates = await listWritingTemplates('u1');
    expect(templates).toHaveLength(1);
    expect(templates[0]?.slug).toBe(DEFAULT_WRITING_TEMPLATE.slug);
    expect(templates[0]?.name).toBe(DEFAULT_WRITING_TEMPLATE.name);
  });

  test('idempotent : deuxième appel ne duplique pas', async () => {
    await makeUser('u1', 'a@test.com');
    await seedUserDefaults('u1');
    await seedUserDefaults('u1');

    const templates = await listWritingTemplates('u1');
    expect(templates).toHaveLength(1);
  });
});
```

- [ ] **Step 2: RED**

Run: `npm run test:integration -- user-defaults-seed`
Expected: erreur car `seedUserDefaults` n'est pas exporté.

- [ ] **Step 3: Étendre `src/lib/db/seeds/user-defaults.ts` avec la fonction**

Ouvrir le fichier (créé en Task 3) et ajouter en bas, juste après les 3 constantes :

```ts
import { upsertSettings } from '../repositories/settings';
import { upsertVisualBriefing } from '../repositories/visual-briefing';
import { upsertVoice } from '../repositories/voice';
import { createWritingTemplate } from '../repositories/writing-templates';

export async function seedUserDefaults(userId: string): Promise<void> {
  await upsertSettings(userId);
  await upsertVoice(userId);
  await upsertVisualBriefing(userId);
  await createWritingTemplate(userId, DEFAULT_WRITING_TEMPLATE);
}
```

Note : les imports vont en haut du fichier (au-dessus des `export const`), pas en bas. Biome appliquera l'ordre standard.

- [ ] **Step 4: GREEN**

Run: `npm run test:integration -- user-defaults-seed`
Expected: 2 tests passent.

- [ ] **Step 5: Lint + commit**

```bash
npm run lint
git add src/lib/db/seeds/user-defaults.ts test/integration/user-defaults-seed.test.ts
git commit -m "$(cat <<'EOF'
🤖 feat(db): seedUserDefaults() pour centraliser le seeding des singletons

Une fonction async qui upsert settings + voice + visual_briefing puis
crée le writing_template par défaut. Idempotente grâce aux
onConflictDoNothing dans les repositories sous-jacents.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Wire Better-Auth hook + supprimer fallback brand page

**Files:**
- Modify: `src/lib/auth/server.ts` (remplacer le hook existant)
- Modify: `src/app/(app)/settings/brand/page.tsx` (retirer le fallback `settings ?? {...}`)

- [ ] **Step 1: Modifier le hook Better-Auth dans `src/lib/auth/server.ts`**

Remplacer le bloc `databaseHooks: { user: { create: { after: ... } } }` existant. Ouvrir le fichier et modifier :

État actuel (extrait) :
```ts
import { settings } from '@/lib/db/schema';
// ...
  databaseHooks: {
    user: {
      create: {
        after: async (createdUser) => {
          await db.insert(settings).values({ userId: createdUser.id }).onConflictDoNothing();
        },
      },
    },
  },
```

Nouvel état :
```ts
import { seedUserDefaults } from '@/lib/db/seeds/user-defaults';
// ...
  databaseHooks: {
    user: {
      create: {
        after: async (createdUser) => {
          await seedUserDefaults(createdUser.id);
        },
      },
    },
  },
```

Retirer l'import `import { settings } from '@/lib/db/schema';` et l'import `import { db } from '@/lib/db/client';` s'ils ne sont plus utilisés ailleurs dans le fichier (vérifier visuellement). Garder uniquement ce qui sert.

- [ ] **Step 2: Modifier `src/app/(app)/settings/brand/page.tsx` pour retirer le fallback**

État actuel (extrait pertinent) :
```tsx
const settings = await getSettings(session.user.id);
const initialValues = settings ?? {
  brandName: '',
  brandColor: '#000000',
  brandSignature: '',
};
```

Nouvel état :
```tsx
const settings = await getSettings(session.user.id);
if (!settings) {
  throw new Error('settings row missing for authenticated user');
}
```

Puis remplacer les références `initialValues.brandName` (etc.) par `settings.brandName` partout dans la page. Si le composant `<BrandForm initialValues={{...}} />` est appelé avec `initialValues` construit à partir de `initialValues.brandName`, le remplacer par `settings.brandName`. Garder l'API du component `<BrandForm>` inchangée.

- [ ] **Step 3: Lint + tests integration + build**

Run: `npm run lint && npm run test:integration && npm run build`
Expected: tout vert. Les tests `settings-action.test.ts` continuent de passer parce qu'ils créent les users manuellement via `db.insert(user)` + `upsertSettings` (le hook n'est PAS déclenché par `db.insert(user)`).

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth/server.ts src/app/\(app\)/settings/brand/page.tsx
git commit -m "$(cat <<'EOF'
🤖 feat(auth): hook signup délègue à seedUserDefaults()

Remplace le hook ad-hoc qui n'insérait que settings par un appel
unique à seedUserDefaults() qui couvre les 4 singletons + le
writing_template par défaut. Conséquence : la page Brand peut
retirer son fallback in-memory et supposer que la row settings
existe toujours.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 5 : Tenant isolation

### Task 10: Extensions du harness tenant-isolation

Ajouter 2 fixtures harness (writing_templates, visual_styles) + 2 describes bespoke (voice, visual_briefing). Pattern identique aux 5 fixtures existantes (Spec 2).

**Files:**
- Modify: `test/integration/tenant-isolation.test.ts`

- [ ] **Step 1: Ajouter les imports en haut du fichier**

Ajouter les imports nécessaires (biome organisera l'ordre alphabétique) :

```ts
import {
  getVisualBriefing,
  updateVisualBriefing,
  upsertVisualBriefing,
} from '@/lib/db/repositories/visual-briefing';
import {
  createVisualStyle,
  deleteVisualStyle,
  getVisualStyle,
  listVisualStyles,
  updateVisualStyle,
} from '@/lib/db/repositories/visual-styles';
import { getVoice, updateVoice, upsertVoice } from '@/lib/db/repositories/voice';
import {
  createWritingTemplate,
  deleteWritingTemplate,
  getWritingTemplate,
  listWritingTemplates,
  updateWritingTemplate,
} from '@/lib/db/repositories/writing-templates';
```

- [ ] **Step 2: Ajouter 2 describes bespoke pour les singletons**

Après le describe `settings — tenant isolation` existant (et avant les `runTenantIsolationSuite(...)` calls), ajouter :

```ts
describe('voice — tenant isolation', () => {
  test('user A ne voit pas la voice de user B', async () => {
    await db.insert(user).values([
      { id: 'alice', email: 'alice@test.com' },
      { id: 'bob', email: 'bob@test.com' },
    ]);
    await upsertVoice('alice');
    await upsertVoice('bob');
    await updateVoice('alice', { content: 'AliceVoice' });
    await updateVoice('bob', { content: 'BobVoice' });

    expect((await getVoice('alice'))?.content).toBe('AliceVoice');
    expect((await getVoice('bob'))?.content).toBe('BobVoice');
  });

  test('updateVoice sur A ne touche pas B', async () => {
    await db.insert(user).values([
      { id: 'alice', email: 'alice@test.com' },
      { id: 'bob', email: 'bob@test.com' },
    ]);
    await upsertVoice('alice');
    await upsertVoice('bob');

    await updateVoice('alice', { content: 'ChangedByAlice' });
    const bob = await getVoice('bob');
    // Bob garde le contenu par défaut (seed)
    expect(bob?.content).not.toBe('ChangedByAlice');
  });
});

describe('visual_briefing — tenant isolation', () => {
  test('user A ne voit pas le briefing de user B', async () => {
    await db.insert(user).values([
      { id: 'alice', email: 'alice@test.com' },
      { id: 'bob', email: 'bob@test.com' },
    ]);
    await upsertVisualBriefing('alice');
    await upsertVisualBriefing('bob');
    await updateVisualBriefing('alice', { content: 'AliceBrief' });
    await updateVisualBriefing('bob', { content: 'BobBrief' });

    expect((await getVisualBriefing('alice'))?.content).toBe('AliceBrief');
    expect((await getVisualBriefing('bob'))?.content).toBe('BobBrief');
  });

  test('updateVisualBriefing sur A ne touche pas B', async () => {
    await db.insert(user).values([
      { id: 'alice', email: 'alice@test.com' },
      { id: 'bob', email: 'bob@test.com' },
    ]);
    await upsertVisualBriefing('alice');
    await upsertVisualBriefing('bob');

    await updateVisualBriefing('alice', { content: 'ChangedByAlice' });
    const bob = await getVisualBriefing('bob');
    expect(bob?.content).not.toBe('ChangedByAlice');
  });
});
```

- [ ] **Step 3: Ajouter 2 appels harness pour les listes**

Tout à la fin du fichier (après les 5 appels harness Spec 2 existants) :

```ts
runTenantIsolationSuite('writing_templates', {
  seed: (uid) =>
    createWritingTemplate(uid, {
      name: 'Sample',
      slug: 'sample',
      platform: 'linkedin',
      structure: 'X',
      writingRules: null,
    }) as Promise<{ id: string; name: string }>,
  rowId: (r) => r.id,
  reload: (uid, id) => getWritingTemplate(uid, id),
  updatePatch: { name: 'hacked' },
  updateAssertions: (row) => {
    expect(row.name).toBe('Sample');
  },
  get: getWritingTemplate,
  list: listWritingTemplates,
  update: updateWritingTemplate,
  delete: deleteWritingTemplate,
});

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

Note sur le cast `as Promise<{ id: string; name: string }>` : les repos retournent `WritingTemplate | undefined` (pour gérer le conflit slug), mais le harness attend `Promise<TRow>`. Le seed ne génère pas de conflit (chaque test crée un user neuf), donc undefined n'arrive jamais. Le cast satisfait TS sans changer le runtime.

- [ ] **Step 4: Lancer la suite tenant-isolation**

Run: `npm run test:integration -- tenant-isolation`
Expected: 4 (settings + voice + briefing bespokes × 2 chacun = 6) + 5 × 4 (harness ideas, posts, publications, media, image_assets dont 7 tests image_assets) + 2 × 4 (writing_templates + visual_styles) = autour de **30 tests**. Tous verts.

- [ ] **Step 5: Suite integration complète + lint**

Run: `npm run lint && npm run test:integration`
Expected: tout vert.

- [ ] **Step 6: Commit**

```bash
git add test/integration/tenant-isolation.test.ts
git commit -m "$(cat <<'EOF'
🤖 test(integration): tenant isolation pour voice, visual_briefing, writing_templates, visual_styles

2 fixtures harness (writing_templates, visual_styles) + 2 describes
bespoke (voice, visual_briefing singletons, pattern settings).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 6 : UI singletons (voice + visual_briefing)

### Task 11: Page /settings/voice (full stack avec TDD sur le core)

Pattern wrapper/core de Spec 2 Brand. Le core est testé en integration, le wrapper + page + form sont scaffoldés sur le même modèle.

**Files:**
- Create: `test/integration/voice-action.test.ts`
- Create: `src/app/(app)/settings/voice/actions-core.ts`
- Create: `src/app/(app)/settings/voice/actions.ts`
- Create: `src/app/(app)/settings/voice/voice-form.tsx`
- Create: `src/app/(app)/settings/voice/page.tsx`

- [ ] **Step 1: Écrire le test integration du core (RED)**

`test/integration/voice-action.test.ts` :

```ts
import { describe, expect, test } from 'vitest';
import { updateVoiceCore } from '@/app/(app)/settings/voice/actions-core';
import { db } from '@/lib/db/client';
import { getVoice, upsertVoice } from '@/lib/db/repositories/voice';
import { user } from '@/lib/db/schema';

async function makeUser(id: string, email: string) {
  await db.insert(user).values({ id, email });
  await upsertVoice(id);
}

function fd(values: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.append(k, v);
  return f;
}

describe('updateVoiceCore', () => {
  test('success : met à jour le content et retourne success', async () => {
    await makeUser('u1', 'a@test.com');
    const result = await updateVoiceCore('u1', fd({ content: 'Nouvelle voix' }));
    expect(result).toEqual({ status: 'success' });

    const v = await getVoice('u1');
    expect(v?.content).toBe('Nouvelle voix');
  });

  test('validation error : content vide', async () => {
    await makeUser('u1', 'a@test.com');
    const before = await getVoice('u1');
    const result = await updateVoiceCore('u1', fd({ content: '' }));
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.message).toBe('validation');
      expect(result.fieldErrors?.content).toBeDefined();
    }

    const after = await getVoice('u1');
    expect(after?.content).toBe(before?.content);
  });
});
```

- [ ] **Step 2: RED**

Run: `npm run test:integration -- voice-action`
Expected: erreur de résolution de module.

- [ ] **Step 3: Implémenter `src/app/(app)/settings/voice/actions-core.ts`**

```ts
import { z } from 'zod';
import { updateVoice } from '@/lib/db/repositories/voice';

export type VoiceActionState =
  | { status: 'idle' }
  | { status: 'success' }
  | { status: 'error'; message: string; fieldErrors?: Record<string, string> };

const voiceSchema = z.object({
  content: z.string().min(1).max(10000),
});

export async function updateVoiceCore(
  userId: string,
  formData: FormData,
): Promise<VoiceActionState> {
  const raw = { content: String(formData.get('content') ?? '') };
  const parsed = voiceSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? '');
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { status: 'error', message: 'validation', fieldErrors };
  }

  await updateVoice(userId, { content: parsed.data.content });
  return { status: 'success' };
}
```

- [ ] **Step 4: GREEN**

Run: `npm run test:integration -- voice-action`
Expected: 2 tests passent.

- [ ] **Step 5: Créer `src/app/(app)/settings/voice/actions.ts` (wrapper)**

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth/server';
import { type VoiceActionState, updateVoiceCore } from './actions-core';

export async function updateVoiceAction(
  _prev: VoiceActionState,
  formData: FormData,
): Promise<VoiceActionState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { status: 'error', message: 'unauthenticated' };
  }
  const result = await updateVoiceCore(session.user.id, formData);
  if (result.status === 'success') {
    revalidatePath('/settings/voice');
  }
  return result;
}
```

- [ ] **Step 6: Créer `src/app/(app)/settings/voice/voice-form.tsx` (client)**

```tsx
'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { VoiceActionState } from './actions-core';
import { updateVoiceAction } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Enregistrement…' : 'Enregistrer'}
    </Button>
  );
}

export function VoiceForm({ initialContent }: { initialContent: string }) {
  const [state, formAction] = useActionState<VoiceActionState, FormData>(updateVoiceAction, {
    status: 'idle',
  });

  useEffect(() => {
    if (state.status === 'success') toast.success('Voix mise à jour');
    else if (state.status === 'error') {
      toast.error(state.message === 'validation' ? 'Champs invalides' : 'Erreur lors de la sauvegarde');
    }
  }, [state]);

  const fieldErrors = state.status === 'error' ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="content">Contenu</Label>
        <Textarea
          id="content"
          name="content"
          defaultValue={initialContent}
          maxLength={10000}
          rows={20}
          className="font-mono text-sm"
        />
        {fieldErrors?.content && <p className="text-sm text-red-600">{fieldErrors.content}</p>}
      </div>
      <SubmitButton />
    </form>
  );
}
```

- [ ] **Step 7: Créer `src/app/(app)/settings/voice/page.tsx`**

```tsx
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/server';
import { getVoice } from '@/lib/db/repositories/voice';
import { VoiceForm } from './voice-form';

export default async function VoicePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/signin');

  const voice = await getVoice(session.user.id);
  if (!voice) {
    throw new Error('voice row missing for authenticated user');
  }

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold">Voix éditoriale</h2>
        <p className="text-sm text-neutral-600">
          Identité immuable de l'auteur. S'applique à toutes les générations.
        </p>
      </header>
      <VoiceForm initialContent={voice.content} />
    </div>
  );
}
```

- [ ] **Step 8: Lint + build**

Run: `npm run lint && npm run build`
Expected: vert. La route `/settings/voice` apparaît dans le table.

- [ ] **Step 9: Commit**

```bash
git add test/integration/voice-action.test.ts src/app/\(app\)/settings/voice/
git commit -m "$(cat <<'EOF'
🤖 feat(settings): page /settings/voice avec Server Action wrapper/core

Pattern wrapper/core split de Spec 2 Brand. updateVoiceCore avec validation
Zod (min 1, max 10000), updateVoiceAction lit la session et délègue.
Form client useActionState + sonner toasts.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Page /settings/visual-briefing (même pattern)

**Files:**
- Create: `test/integration/visual-briefing-action.test.ts`
- Create: `src/app/(app)/settings/visual-briefing/actions-core.ts`
- Create: `src/app/(app)/settings/visual-briefing/actions.ts`
- Create: `src/app/(app)/settings/visual-briefing/visual-briefing-form.tsx`
- Create: `src/app/(app)/settings/visual-briefing/page.tsx`

- [ ] **Step 1: Test integration core (RED)**

`test/integration/visual-briefing-action.test.ts` :

```ts
import { describe, expect, test } from 'vitest';
import { updateVisualBriefingCore } from '@/app/(app)/settings/visual-briefing/actions-core';
import { db } from '@/lib/db/client';
import { getVisualBriefing, upsertVisualBriefing } from '@/lib/db/repositories/visual-briefing';
import { user } from '@/lib/db/schema';

async function makeUser(id: string, email: string) {
  await db.insert(user).values({ id, email });
  await upsertVisualBriefing(id);
}

function fd(values: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.append(k, v);
  return f;
}

describe('updateVisualBriefingCore', () => {
  test('success : met à jour le content', async () => {
    await makeUser('u1', 'a@test.com');
    const result = await updateVisualBriefingCore('u1', fd({ content: 'Nouveau brief' }));
    expect(result).toEqual({ status: 'success' });
    expect((await getVisualBriefing('u1'))?.content).toBe('Nouveau brief');
  });

  test('validation error : content vide', async () => {
    await makeUser('u1', 'a@test.com');
    const result = await updateVisualBriefingCore('u1', fd({ content: '' }));
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.fieldErrors?.content).toBeDefined();
    }
  });
});
```

- [ ] **Step 2: RED**

Run: `npm run test:integration -- visual-briefing-action`
Expected: module not found.

- [ ] **Step 3: Implémenter `actions-core.ts`**

```ts
import { z } from 'zod';
import { updateVisualBriefing } from '@/lib/db/repositories/visual-briefing';

export type VisualBriefingActionState =
  | { status: 'idle' }
  | { status: 'success' }
  | { status: 'error'; message: string; fieldErrors?: Record<string, string> };

const schema = z.object({ content: z.string().min(1).max(10000) });

export async function updateVisualBriefingCore(
  userId: string,
  formData: FormData,
): Promise<VisualBriefingActionState> {
  const raw = { content: String(formData.get('content') ?? '') };
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? '');
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { status: 'error', message: 'validation', fieldErrors };
  }
  await updateVisualBriefing(userId, { content: parsed.data.content });
  return { status: 'success' };
}
```

- [ ] **Step 4: GREEN**

Run: `npm run test:integration -- visual-briefing-action`
Expected: 2 tests passent.

- [ ] **Step 5: Créer `actions.ts` (wrapper)**

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth/server';
import { type VisualBriefingActionState, updateVisualBriefingCore } from './actions-core';

export async function updateVisualBriefingAction(
  _prev: VisualBriefingActionState,
  formData: FormData,
): Promise<VisualBriefingActionState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { status: 'error', message: 'unauthenticated' };
  const result = await updateVisualBriefingCore(session.user.id, formData);
  if (result.status === 'success') revalidatePath('/settings/visual-briefing');
  return result;
}
```

- [ ] **Step 6: Créer `visual-briefing-form.tsx`**

```tsx
'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { VisualBriefingActionState } from './actions-core';
import { updateVisualBriefingAction } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Enregistrement…' : 'Enregistrer'}
    </Button>
  );
}

export function VisualBriefingForm({ initialContent }: { initialContent: string }) {
  const [state, formAction] = useActionState<VisualBriefingActionState, FormData>(
    updateVisualBriefingAction,
    { status: 'idle' },
  );

  useEffect(() => {
    if (state.status === 'success') toast.success('Briefing visuel mis à jour');
    else if (state.status === 'error') {
      toast.error(state.message === 'validation' ? 'Champs invalides' : 'Erreur lors de la sauvegarde');
    }
  }, [state]);

  const fieldErrors = state.status === 'error' ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="content">Contenu</Label>
        <Textarea
          id="content"
          name="content"
          defaultValue={initialContent}
          maxLength={10000}
          rows={12}
          className="font-mono text-sm"
        />
        {fieldErrors?.content && <p className="text-sm text-red-600">{fieldErrors.content}</p>}
      </div>
      <SubmitButton />
    </form>
  );
}
```

- [ ] **Step 7: Créer `page.tsx`**

```tsx
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/server';
import { getVisualBriefing } from '@/lib/db/repositories/visual-briefing';
import { VisualBriefingForm } from './visual-briefing-form';

export default async function VisualBriefingPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/signin');

  const briefing = await getVisualBriefing(session.user.id);
  if (!briefing) {
    throw new Error('visual_briefing row missing for authenticated user');
  }

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold">Briefing visuel</h2>
        <p className="text-sm text-neutral-600">
          Comment l'IA traduit un post en brief de sujet pour la génération d'image.
        </p>
      </header>
      <VisualBriefingForm initialContent={briefing.content} />
    </div>
  );
}
```

- [ ] **Step 8: Lint + build + commit**

```bash
npm run lint && npm run build
git add test/integration/visual-briefing-action.test.ts src/app/\(app\)/settings/visual-briefing/
git commit -m "$(cat <<'EOF'
🤖 feat(settings): page /settings/visual-briefing (singleton textarea)

Miroir de /settings/voice : pattern wrapper/core, Zod validation
min 1 max 10000, sonner toast.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 7 : UI list (writing_templates)

### Task 13: List page + WritingTemplateForm (composant partagé)

Pas de tests sur cette task (purement structurelle, couverte par E2E + tests des actions plus tard).

**Files:**
- Create: `src/app/(app)/settings/writing-templates/page.tsx`
- Create: `src/app/(app)/settings/writing-templates/writing-template-form.tsx`

- [ ] **Step 1: Créer `page.tsx` (liste)**

```tsx
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { auth } from '@/lib/auth/server';
import { listWritingTemplates } from '@/lib/db/repositories/writing-templates';

export default async function WritingTemplatesListPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/signin');

  const templates = await listWritingTemplates(session.user.id);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Templates d'écriture</h2>
          <p className="text-sm text-neutral-600">
            Format et règles spécifiques par type de post.
          </p>
        </div>
        <Button asChild>
          <Link href="/settings/writing-templates/new">+ Nouveau</Link>
        </Button>
      </header>

      {templates.length === 0 ? (
        <p className="text-sm text-neutral-600">Aucun template pour le moment.</p>
      ) : (
        <ul className="space-y-3">
          {templates.map((t) => (
            <li key={t.id}>
              <Link href={`/settings/writing-templates/${t.id}`} className="block">
                <Card className="p-4 hover:bg-neutral-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{t.name}</p>
                      <p className="text-xs text-neutral-500">
                        {t.platform} · {t.slug}
                      </p>
                    </div>
                  </div>
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

- [ ] **Step 2: Créer `writing-template-form.tsx` (client, partagé create + edit)**

```tsx
'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export type WritingTemplateActionState =
  | { status: 'idle' }
  | { status: 'success' }
  | { status: 'error'; message: string; fieldErrors?: Record<string, string> };

type Initial = {
  name: string;
  slug: string;
  platform: string;
  structure: string;
  writingRules: string | null;
};

const EMPTY_INITIAL: Initial = {
  name: '',
  slug: '',
  platform: 'linkedin',
  structure: '',
  writingRules: null,
};

function SubmitButton({ mode }: { mode: 'create' | 'edit' }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Enregistrement…' : mode === 'create' ? 'Créer' : 'Enregistrer'}
    </Button>
  );
}

export function WritingTemplateForm({
  mode,
  initial,
  action,
  successMessage,
}: {
  mode: 'create' | 'edit';
  initial?: Initial;
  action: (
    prev: WritingTemplateActionState,
    formData: FormData,
  ) => Promise<WritingTemplateActionState>;
  successMessage: string;
}) {
  const values = initial ?? EMPTY_INITIAL;
  const [state, formAction] = useActionState<WritingTemplateActionState, FormData>(action, {
    status: 'idle',
  });

  useEffect(() => {
    if (state.status === 'success') toast.success(successMessage);
    else if (state.status === 'error') {
      if (state.message === 'duplicate-slug') toast.error('Slug déjà utilisé');
      else if (state.message === 'validation') toast.error('Champs invalides');
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
        <Label htmlFor="slug">Slug</Label>
        <Input
          id="slug"
          name="slug"
          type="text"
          defaultValue={values.slug}
          maxLength={60}
          pattern="^[a-z0-9-]+$"
        />
        {fieldErrors?.slug && <p className="text-sm text-red-600">{fieldErrors.slug}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="platform">Plateforme</Label>
        <Input id="platform" name="platform" type="text" defaultValue={values.platform} readOnly />
      </div>

      <div className="space-y-2">
        <Label htmlFor="structure">Structure</Label>
        <Textarea
          id="structure"
          name="structure"
          defaultValue={values.structure}
          maxLength={5000}
          rows={10}
          className="font-mono text-sm"
        />
        {fieldErrors?.structure && (
          <p className="text-sm text-red-600">{fieldErrors.structure}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="writingRules">Règles d'écriture (optionnel)</Label>
        <Textarea
          id="writingRules"
          name="writingRules"
          defaultValue={values.writingRules ?? ''}
          maxLength={5000}
          rows={6}
          className="font-mono text-sm"
        />
        {fieldErrors?.writingRules && (
          <p className="text-sm text-red-600">{fieldErrors.writingRules}</p>
        )}
      </div>

      <SubmitButton mode={mode} />
    </form>
  );
}
```

- [ ] **Step 3: Lint + build**

Run: `npm run lint && npm run build`
Expected: vert. La route `/settings/writing-templates` apparaît, mais cliquer sur "Nouveau" produira un 404 (Task 14 ajoute la route).

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/settings/writing-templates/page.tsx src/app/\(app\)/settings/writing-templates/writing-template-form.tsx
git commit -m "$(cat <<'EOF'
🤖 feat(settings): list page writing_templates + form component partagé

Page liste avec cards cliquables. Composant WritingTemplateForm
partagé entre create et edit via prop mode. Action passée en prop
pour découpler du chemin de route.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: Route /settings/writing-templates/new (create)

**Files:**
- Create: `test/integration/writing-template-create-action.test.ts`
- Create: `src/app/(app)/settings/writing-templates/new/actions-core.ts`
- Create: `src/app/(app)/settings/writing-templates/new/actions.ts`
- Create: `src/app/(app)/settings/writing-templates/new/page.tsx`

- [ ] **Step 1: Test integration core (RED)**

`test/integration/writing-template-create-action.test.ts` :

```ts
import { describe, expect, test } from 'vitest';
import { createWritingTemplateCore } from '@/app/(app)/settings/writing-templates/new/actions-core';
import { db } from '@/lib/db/client';
import {
  createWritingTemplate,
  listWritingTemplates,
} from '@/lib/db/repositories/writing-templates';
import { user } from '@/lib/db/schema';

async function makeUser(id: string, email: string) {
  await db.insert(user).values({ id, email });
}

function fd(values: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.append(k, v);
  return f;
}

describe('createWritingTemplateCore', () => {
  test('success : crée le template', async () => {
    await makeUser('u1', 'a@test.com');
    const result = await createWritingTemplateCore(
      'u1',
      fd({
        name: 'Carrousel LinkedIn',
        slug: 'carrousel',
        platform: 'linkedin',
        structure: 'HOOK / 5-7 slides / CTA',
        writingRules: '',
      }),
    );
    expect(result.status).toBe('success');

    const rows = await listWritingTemplates('u1');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.slug).toBe('carrousel');
  });

  test('validation error : slug invalide (espaces)', async () => {
    await makeUser('u1', 'a@test.com');
    const result = await createWritingTemplateCore(
      'u1',
      fd({
        name: 'X',
        slug: 'slug invalide',
        platform: 'linkedin',
        structure: 'S',
        writingRules: '',
      }),
    );
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.fieldErrors?.slug).toBeDefined();
    }
  });

  test('duplicate-slug : retourne erreur sur conflit', async () => {
    await makeUser('u1', 'a@test.com');
    await createWritingTemplate('u1', {
      name: 'X',
      slug: 'duplicate',
      platform: 'linkedin',
      structure: 'S',
      writingRules: null,
    });
    const result = await createWritingTemplateCore(
      'u1',
      fd({
        name: 'Y',
        slug: 'duplicate',
        platform: 'linkedin',
        structure: 'S',
        writingRules: '',
      }),
    );
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.message).toBe('duplicate-slug');
      expect(result.fieldErrors?.slug).toBeDefined();
    }
  });
});
```

- [ ] **Step 2: RED**

Run: `npm run test:integration -- writing-template-create-action`
Expected: module not found.

- [ ] **Step 3: Implémenter `actions-core.ts`**

```ts
import { z } from 'zod';
import { createWritingTemplate } from '@/lib/db/repositories/writing-templates';
import type { WritingTemplateActionState } from '../writing-template-form';

const schema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9-]+$/),
  platform: z.enum(['linkedin']),
  structure: z.string().min(1).max(5000),
  writingRules: z.string().max(5000),
});

export async function createWritingTemplateCore(
  userId: string,
  formData: FormData,
): Promise<WritingTemplateActionState> {
  const raw = {
    name: String(formData.get('name') ?? ''),
    slug: String(formData.get('slug') ?? ''),
    platform: String(formData.get('platform') ?? ''),
    structure: String(formData.get('structure') ?? ''),
    writingRules: String(formData.get('writingRules') ?? ''),
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

  const created = await createWritingTemplate(userId, {
    name: parsed.data.name,
    slug: parsed.data.slug,
    platform: parsed.data.platform,
    structure: parsed.data.structure,
    writingRules: parsed.data.writingRules === '' ? null : parsed.data.writingRules,
  });

  if (!created) {
    return {
      status: 'error',
      message: 'duplicate-slug',
      fieldErrors: { slug: 'Slug déjà utilisé.' },
    };
  }

  return { status: 'success' };
}
```

- [ ] **Step 4: GREEN**

Run: `npm run test:integration -- writing-template-create-action`
Expected: 3 tests passent.

- [ ] **Step 5: Créer `actions.ts` (wrapper avec redirect)**

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/server';
import type { WritingTemplateActionState } from '../writing-template-form';
import { createWritingTemplateCore } from './actions-core';

export async function createWritingTemplateAction(
  _prev: WritingTemplateActionState,
  formData: FormData,
): Promise<WritingTemplateActionState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { status: 'error', message: 'unauthenticated' };

  const result = await createWritingTemplateCore(session.user.id, formData);
  if (result.status === 'success') {
    revalidatePath('/settings/writing-templates');
    redirect('/settings/writing-templates');
  }
  return result;
}
```

Note : `redirect()` throw une `NEXT_REDIRECT` error qui propage hors de l'action, c'est le pattern Next.js standard. La toast de succès n'est pas affichée parce qu'on quitte la page. Le succès est implicite par la navigation.

- [ ] **Step 6: Créer `page.tsx`**

```tsx
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/server';
import { WritingTemplateForm } from '../writing-template-form';
import { createWritingTemplateAction } from './actions';

export default async function NewWritingTemplatePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/signin');

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold">Nouveau template d'écriture</h2>
      </header>
      <WritingTemplateForm
        mode="create"
        action={createWritingTemplateAction}
        successMessage="Template créé"
      />
    </div>
  );
}
```

- [ ] **Step 7: Lint + build + commit**

```bash
npm run lint && npm run build
git add test/integration/writing-template-create-action.test.ts src/app/\(app\)/settings/writing-templates/new/
git commit -m "$(cat <<'EOF'
🤖 feat(settings): route /settings/writing-templates/new (create)

Server Action wrapper/core split. Zod validation (slug regex,
longueurs), gestion explicite du conflit slug avec message
"duplicate-slug". Redirect vers la liste après succès.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: Route /settings/writing-templates/[id] (edit + delete)

**Files:**
- Create: `test/integration/writing-template-edit-action.test.ts`
- Create: `src/app/(app)/settings/writing-templates/[id]/actions-core.ts`
- Create: `src/app/(app)/settings/writing-templates/[id]/actions.ts`
- Create: `src/app/(app)/settings/writing-templates/[id]/page.tsx`

- [ ] **Step 1: Test integration cores (RED)**

`test/integration/writing-template-edit-action.test.ts` :

```ts
import { describe, expect, test } from 'vitest';
import {
  deleteWritingTemplateCore,
  updateWritingTemplateCore,
} from '@/app/(app)/settings/writing-templates/[id]/actions-core';
import { db } from '@/lib/db/client';
import {
  createWritingTemplate,
  getWritingTemplate,
} from '@/lib/db/repositories/writing-templates';
import { user } from '@/lib/db/schema';

async function makeUser(id: string, email: string) {
  await db.insert(user).values({ id, email });
}

function fd(values: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.append(k, v);
  return f;
}

describe('updateWritingTemplateCore', () => {
  test('success : modifie le name', async () => {
    await makeUser('u1', 'a@test.com');
    const created = await createWritingTemplate('u1', {
      name: 'Orig',
      slug: 'orig',
      platform: 'linkedin',
      structure: 'S',
      writingRules: null,
    });
    const result = await updateWritingTemplateCore(
      'u1',
      created!.id,
      fd({
        name: 'Renommé',
        slug: 'orig',
        platform: 'linkedin',
        structure: 'S',
        writingRules: '',
      }),
    );
    expect(result.status).toBe('success');

    const fresh = await getWritingTemplate('u1', created!.id);
    expect(fresh?.name).toBe('Renommé');
  });

  test('update sur template d\'un autre user : 404', async () => {
    await makeUser('u1', 'a@test.com');
    await makeUser('u2', 'b@test.com');
    const owned = await createWritingTemplate('u1', {
      name: 'X',
      slug: 'x',
      platform: 'linkedin',
      structure: 'S',
      writingRules: null,
    });
    const result = await updateWritingTemplateCore(
      'u2',
      owned!.id,
      fd({
        name: 'Hacked',
        slug: 'hacked',
        platform: 'linkedin',
        structure: 'S',
        writingRules: '',
      }),
    );
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.message).toBe('not-found');
    }

    const stillOwned = await getWritingTemplate('u1', owned!.id);
    expect(stillOwned?.name).toBe('X');
  });
});

describe('deleteWritingTemplateCore', () => {
  test('success : supprime le template du user', async () => {
    await makeUser('u1', 'a@test.com');
    const created = await createWritingTemplate('u1', {
      name: 'X',
      slug: 'x',
      platform: 'linkedin',
      structure: 'S',
      writingRules: null,
    });
    const result = await deleteWritingTemplateCore('u1', created!.id);
    expect(result.status).toBe('success');
    expect(await getWritingTemplate('u1', created!.id)).toBeUndefined();
  });
});
```

- [ ] **Step 2: RED**

Run: `npm run test:integration -- writing-template-edit-action`
Expected: module not found.

- [ ] **Step 3: Implémenter `actions-core.ts`**

```ts
import { z } from 'zod';
import {
  deleteWritingTemplate,
  getWritingTemplate,
  updateWritingTemplate,
} from '@/lib/db/repositories/writing-templates';
import type { WritingTemplateActionState } from '../writing-template-form';

const updateSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9-]+$/),
  platform: z.enum(['linkedin']),
  structure: z.string().min(1).max(5000),
  writingRules: z.string().max(5000),
});

export async function updateWritingTemplateCore(
  userId: string,
  id: string,
  formData: FormData,
): Promise<WritingTemplateActionState> {
  const existing = await getWritingTemplate(userId, id);
  if (!existing) {
    return { status: 'error', message: 'not-found' };
  }

  const raw = {
    name: String(formData.get('name') ?? ''),
    slug: String(formData.get('slug') ?? ''),
    platform: String(formData.get('platform') ?? ''),
    structure: String(formData.get('structure') ?? ''),
    writingRules: String(formData.get('writingRules') ?? ''),
  };

  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? '');
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { status: 'error', message: 'validation', fieldErrors };
  }

  await updateWritingTemplate(userId, id, {
    name: parsed.data.name,
    slug: parsed.data.slug,
    platform: parsed.data.platform,
    structure: parsed.data.structure,
    writingRules: parsed.data.writingRules === '' ? null : parsed.data.writingRules,
  });

  return { status: 'success' };
}

export async function deleteWritingTemplateCore(
  userId: string,
  id: string,
): Promise<WritingTemplateActionState> {
  const existing = await getWritingTemplate(userId, id);
  if (!existing) {
    return { status: 'error', message: 'not-found' };
  }
  await deleteWritingTemplate(userId, id);
  return { status: 'success' };
}
```

- [ ] **Step 4: GREEN**

Run: `npm run test:integration -- writing-template-edit-action`
Expected: 3 tests passent.

- [ ] **Step 5: Créer `actions.ts` (wrappers update + delete)**

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/server';
import type { WritingTemplateActionState } from '../writing-template-form';
import { deleteWritingTemplateCore, updateWritingTemplateCore } from './actions-core';

export async function updateWritingTemplateAction(
  id: string,
  _prev: WritingTemplateActionState,
  formData: FormData,
): Promise<WritingTemplateActionState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { status: 'error', message: 'unauthenticated' };

  const result = await updateWritingTemplateCore(session.user.id, id, formData);
  if (result.status === 'success') {
    revalidatePath(`/settings/writing-templates/${id}`);
    revalidatePath('/settings/writing-templates');
  }
  return result;
}

export async function deleteWritingTemplateActionRaw(id: string): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return;

  await deleteWritingTemplateCore(session.user.id, id);
  revalidatePath('/settings/writing-templates');
  redirect('/settings/writing-templates');
}
```

Note : `updateWritingTemplateAction` prend `id` en premier argument et est bindé au moment de l'appel côté form (`updateWritingTemplateAction.bind(null, id)`). `deleteWritingTemplateActionRaw` est appelée depuis un `<form action={...}>` séparé de la page edit (pas de `useActionState`, pas de `prev` state, juste `<button type="submit">`).

- [ ] **Step 6: Créer `page.tsx`**

```tsx
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { auth } from '@/lib/auth/server';
import { getWritingTemplate } from '@/lib/db/repositories/writing-templates';
import { WritingTemplateForm } from '../writing-template-form';
import { deleteWritingTemplateActionRaw, updateWritingTemplateAction } from './actions';

export default async function EditWritingTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/signin');

  const { id } = await params;
  const template = await getWritingTemplate(session.user.id, id);
  if (!template) notFound();

  const updateAction = updateWritingTemplateAction.bind(null, id);
  const deleteAction = deleteWritingTemplateActionRaw.bind(null, id);

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold">Éditer le template</h2>
      </header>

      <WritingTemplateForm
        mode="edit"
        initial={{
          name: template.name,
          slug: template.slug,
          platform: template.platform,
          structure: template.structure,
          writingRules: template.writingRules,
        }}
        action={updateAction}
        successMessage="Template mis à jour"
      />

      <hr />

      <section className="space-y-2">
        <h3 className="text-lg font-semibold text-red-700">Zone dangereuse</h3>
        <p className="text-sm text-neutral-600">La suppression est définitive.</p>
        <form
          action={async () => {
            'use server';
            await deleteAction();
          }}
        >
          <Button
            type="button"
            variant="destructive"
            onClick={(e) => {
              const dialog = (e.currentTarget.closest('form')?.querySelector('dialog') as HTMLDialogElement | null);
              dialog?.showModal();
            }}
          >
            Supprimer ce template
          </Button>
          <dialog className="rounded-md p-6 shadow-xl backdrop:bg-black/40">
            <p className="mb-4 text-sm">Confirmer la suppression ?</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="px-3 py-1 text-sm"
                onClick={(e) => {
                  (e.currentTarget.closest('dialog') as HTMLDialogElement).close();
                }}
              >
                Annuler
              </button>
              <button type="submit" className="rounded bg-red-600 px-3 py-1 text-sm text-white">
                Supprimer
              </button>
            </div>
          </dialog>
        </form>
      </section>
    </div>
  );
}
```

**Important** : le `<dialog>` natif + `onClick` handler nécessite que cette section soit un Client Component. Comme `page.tsx` est Server Component, extraire la "Danger zone" dans un Client Component séparé est plus propre. Le bouton "Supprimer" doit ouvrir la dialog ; la confirmation submit le form parent qui appelle `deleteAction`.

Réécrire : extraire `DangerZone` en client component :

`src/app/(app)/settings/writing-templates/[id]/danger-zone.tsx` :

```tsx
'use client';

import { useRef } from 'react';
import { Button } from '@/components/ui/button';

export function DangerZone({ deleteAction }: { deleteAction: () => Promise<void> }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <section className="space-y-2">
      <h3 className="text-lg font-semibold text-red-700">Zone dangereuse</h3>
      <p className="text-sm text-neutral-600">La suppression est définitive.</p>
      <Button type="button" variant="destructive" onClick={() => dialogRef.current?.showModal()}>
        Supprimer ce template
      </Button>
      <dialog ref={dialogRef} className="rounded-md p-6 shadow-xl backdrop:bg-black/40">
        <p className="mb-4 text-sm">Confirmer la suppression ?</p>
        <div className="flex justify-end gap-2">
          <button type="button" className="px-3 py-1 text-sm" onClick={() => dialogRef.current?.close()}>
            Annuler
          </button>
          <form action={deleteAction}>
            <button type="submit" className="rounded bg-red-600 px-3 py-1 text-sm text-white">
              Supprimer
            </button>
          </form>
        </div>
      </dialog>
    </section>
  );
}
```

Et dans `page.tsx`, remplacer le bloc `<section>...</section>` (avec le form et le dialog) par :

```tsx
import { DangerZone } from './danger-zone';
// ...
<hr />
<DangerZone deleteAction={deleteAction} />
```

Ajouter cette task substep : créer aussi `danger-zone.tsx` (5e fichier).

**Files (révisé):**
- Create: `test/integration/writing-template-edit-action.test.ts`
- Create: `src/app/(app)/settings/writing-templates/[id]/actions-core.ts`
- Create: `src/app/(app)/settings/writing-templates/[id]/actions.ts`
- Create: `src/app/(app)/settings/writing-templates/[id]/page.tsx`
- Create: `src/app/(app)/settings/writing-templates/[id]/danger-zone.tsx`

Mise à jour de `page.tsx` (version finale) :

```tsx
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth/server';
import { getWritingTemplate } from '@/lib/db/repositories/writing-templates';
import { WritingTemplateForm } from '../writing-template-form';
import { deleteWritingTemplateActionRaw, updateWritingTemplateAction } from './actions';
import { DangerZone } from './danger-zone';

export default async function EditWritingTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/signin');

  const { id } = await params;
  const template = await getWritingTemplate(session.user.id, id);
  if (!template) notFound();

  const updateAction = updateWritingTemplateAction.bind(null, id);
  const deleteAction = deleteWritingTemplateActionRaw.bind(null, id);

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold">Éditer le template</h2>
      </header>

      <WritingTemplateForm
        mode="edit"
        initial={{
          name: template.name,
          slug: template.slug,
          platform: template.platform,
          structure: template.structure,
          writingRules: template.writingRules,
        }}
        action={updateAction}
        successMessage="Template mis à jour"
      />

      <hr />
      <DangerZone deleteAction={deleteAction} />
    </div>
  );
}
```

- [ ] **Step 7: Lint + build + commit**

```bash
npm run lint && npm run build
git add test/integration/writing-template-edit-action.test.ts src/app/\(app\)/settings/writing-templates/\[id\]/
git commit -m "$(cat <<'EOF'
🤖 feat(settings): route /settings/writing-templates/[id] (edit + delete)

actions-core split en updateCore + deleteCore avec lookup
existence en amont (retour 'not-found' si row absente OU
appartenant à un autre user). DangerZone client component
encapsule le <dialog> de confirmation natif. Delete redirige
vers la liste.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 8 : UI list (visual_styles)

### Task 16: List page + VisualStyleForm

Pattern miroir de Task 13 (writing_templates list).

**Files:**
- Create: `src/app/(app)/settings/visual-styles/page.tsx`
- Create: `src/app/(app)/settings/visual-styles/visual-style-form.tsx`

- [ ] **Step 1: Créer `page.tsx` (liste)**

```tsx
import Link from 'next/link';
import { headers } from 'next/headers';
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
        <Button asChild>
          <Link href="/settings/visual-styles/new">+ Nouveau</Link>
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
                  <p className="text-xs text-neutral-500">{s.slug}</p>
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

- [ ] **Step 2: Créer `visual-style-form.tsx`**

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

type Initial = { name: string; slug: string; prompt: string };

const EMPTY_INITIAL: Initial = { name: '', slug: '', prompt: '' };

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
      if (state.message === 'duplicate-slug') toast.error('Slug déjà utilisé');
      else if (state.message === 'validation') toast.error('Champs invalides');
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
        <Label htmlFor="slug">Slug</Label>
        <Input
          id="slug"
          name="slug"
          type="text"
          defaultValue={values.slug}
          maxLength={60}
          pattern="^[a-z0-9-]+$"
        />
        {fieldErrors?.slug && <p className="text-sm text-red-600">{fieldErrors.slug}</p>}
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

- [ ] **Step 3: Lint + build + commit**

```bash
npm run lint && npm run build
git add src/app/\(app\)/settings/visual-styles/page.tsx src/app/\(app\)/settings/visual-styles/visual-style-form.tsx
git commit -m "$(cat <<'EOF'
🤖 feat(settings): list page visual_styles + form component partagé

Pattern miroir de writing_templates : page liste + form partagé
create/edit. 3 champs (name, slug, prompt).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 17: Route /settings/visual-styles/new (create)

**Files:**
- Create: `test/integration/visual-style-create-action.test.ts`
- Create: `src/app/(app)/settings/visual-styles/new/actions-core.ts`
- Create: `src/app/(app)/settings/visual-styles/new/actions.ts`
- Create: `src/app/(app)/settings/visual-styles/new/page.tsx`

- [ ] **Step 1: Test integration core (RED)**

`test/integration/visual-style-create-action.test.ts` :

```ts
import { describe, expect, test } from 'vitest';
import { createVisualStyleCore } from '@/app/(app)/settings/visual-styles/new/actions-core';
import { db } from '@/lib/db/client';
import { createVisualStyle, listVisualStyles } from '@/lib/db/repositories/visual-styles';
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
      fd({ name: 'Cinematic', slug: 'cinematic', prompt: 'rendu cinéma' }),
    );
    expect(result.status).toBe('success');

    const rows = await listVisualStyles('u1');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.slug).toBe('cinematic');
  });

  test('validation error : slug invalide', async () => {
    await makeUser('u1', 'a@test.com');
    const result = await createVisualStyleCore(
      'u1',
      fd({ name: 'X', slug: 'BAD SLUG', prompt: 'P' }),
    );
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.fieldErrors?.slug).toBeDefined();
    }
  });

  test('duplicate-slug : retourne erreur sur conflit', async () => {
    await makeUser('u1', 'a@test.com');
    await createVisualStyle('u1', { name: 'X', slug: 'dup', prompt: 'P' });
    const result = await createVisualStyleCore(
      'u1',
      fd({ name: 'Y', slug: 'dup', prompt: 'Q' }),
    );
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.message).toBe('duplicate-slug');
    }
  });
});
```

- [ ] **Step 2: RED**

Run: `npm run test:integration -- visual-style-create-action`
Expected: module not found.

- [ ] **Step 3: Implémenter `actions-core.ts`**

```ts
import { z } from 'zod';
import { createVisualStyle } from '@/lib/db/repositories/visual-styles';
import type { VisualStyleActionState } from '../visual-style-form';

const schema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9-]+$/),
  prompt: z.string().min(1).max(2000),
});

export async function createVisualStyleCore(
  userId: string,
  formData: FormData,
): Promise<VisualStyleActionState> {
  const raw = {
    name: String(formData.get('name') ?? ''),
    slug: String(formData.get('slug') ?? ''),
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

  const created = await createVisualStyle(userId, parsed.data);
  if (!created) {
    return {
      status: 'error',
      message: 'duplicate-slug',
      fieldErrors: { slug: 'Slug déjà utilisé.' },
    };
  }

  return { status: 'success' };
}
```

- [ ] **Step 4: GREEN**

Run: `npm run test:integration -- visual-style-create-action`
Expected: 3 tests passent.

- [ ] **Step 5: Créer `actions.ts` + `page.tsx`**

`actions.ts` :

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/server';
import type { VisualStyleActionState } from '../visual-style-form';
import { createVisualStyleCore } from './actions-core';

export async function createVisualStyleAction(
  _prev: VisualStyleActionState,
  formData: FormData,
): Promise<VisualStyleActionState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { status: 'error', message: 'unauthenticated' };

  const result = await createVisualStyleCore(session.user.id, formData);
  if (result.status === 'success') {
    revalidatePath('/settings/visual-styles');
    redirect('/settings/visual-styles');
  }
  return result;
}
```

`page.tsx` :

```tsx
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/server';
import { VisualStyleForm } from '../visual-style-form';
import { createVisualStyleAction } from './actions';

export default async function NewVisualStylePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/signin');

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold">Nouveau style visuel</h2>
      </header>
      <VisualStyleForm
        mode="create"
        action={createVisualStyleAction}
        successMessage="Style créé"
      />
    </div>
  );
}
```

- [ ] **Step 6: Lint + build + commit**

```bash
npm run lint && npm run build
git add test/integration/visual-style-create-action.test.ts src/app/\(app\)/settings/visual-styles/new/
git commit -m "$(cat <<'EOF'
🤖 feat(settings): route /settings/visual-styles/new (create)

Pattern miroir writing_templates/new. Zod validation + conflit
slug géré explicitement.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 18: Route /settings/visual-styles/[id] (edit + delete)

**Files:**
- Create: `test/integration/visual-style-edit-action.test.ts`
- Create: `src/app/(app)/settings/visual-styles/[id]/actions-core.ts`
- Create: `src/app/(app)/settings/visual-styles/[id]/actions.ts`
- Create: `src/app/(app)/settings/visual-styles/[id]/page.tsx`
- Create: `src/app/(app)/settings/visual-styles/[id]/danger-zone.tsx`

- [ ] **Step 1: Test integration cores (RED)**

`test/integration/visual-style-edit-action.test.ts` :

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
    const created = await createVisualStyle('u1', { name: 'X', slug: 'x', prompt: 'orig' });
    const result = await updateVisualStyleCore(
      'u1',
      created!.id,
      fd({ name: 'X', slug: 'x', prompt: 'nouveau' }),
    );
    expect(result.status).toBe('success');
    expect((await getVisualStyle('u1', created!.id))?.prompt).toBe('nouveau');
  });

  test('update sur style d\'un autre user : not-found', async () => {
    await makeUser('u1', 'a@test.com');
    await makeUser('u2', 'b@test.com');
    const owned = await createVisualStyle('u1', { name: 'X', slug: 'x', prompt: 'orig' });
    const result = await updateVisualStyleCore(
      'u2',
      owned!.id,
      fd({ name: 'Hacked', slug: 'x', prompt: 'hacked' }),
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
    const created = await createVisualStyle('u1', { name: 'X', slug: 'x', prompt: 'P' });
    const result = await deleteVisualStyleCore('u1', created!.id);
    expect(result.status).toBe('success');
    expect(await getVisualStyle('u1', created!.id)).toBeUndefined();
  });
});
```

- [ ] **Step 2: RED**

Run: `npm run test:integration -- visual-style-edit-action`
Expected: module not found.

- [ ] **Step 3: Implémenter `actions-core.ts`**

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
  slug: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9-]+$/),
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
    slug: String(formData.get('slug') ?? ''),
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

- [ ] **Step 4: GREEN**

Run: `npm run test:integration -- visual-style-edit-action`
Expected: 3 tests passent.

- [ ] **Step 5: Créer `actions.ts` + `danger-zone.tsx` + `page.tsx`**

`actions.ts` :

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/server';
import type { VisualStyleActionState } from '../visual-style-form';
import { deleteVisualStyleCore, updateVisualStyleCore } from './actions-core';

export async function updateVisualStyleAction(
  id: string,
  _prev: VisualStyleActionState,
  formData: FormData,
): Promise<VisualStyleActionState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { status: 'error', message: 'unauthenticated' };

  const result = await updateVisualStyleCore(session.user.id, id, formData);
  if (result.status === 'success') {
    revalidatePath(`/settings/visual-styles/${id}`);
    revalidatePath('/settings/visual-styles');
  }
  return result;
}

export async function deleteVisualStyleActionRaw(id: string): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return;
  await deleteVisualStyleCore(session.user.id, id);
  revalidatePath('/settings/visual-styles');
  redirect('/settings/visual-styles');
}
```

`danger-zone.tsx` (miroir de la version writing_templates) :

```tsx
'use client';

import { useRef } from 'react';
import { Button } from '@/components/ui/button';

export function DangerZone({ deleteAction }: { deleteAction: () => Promise<void> }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <section className="space-y-2">
      <h3 className="text-lg font-semibold text-red-700">Zone dangereuse</h3>
      <p className="text-sm text-neutral-600">La suppression est définitive.</p>
      <Button type="button" variant="destructive" onClick={() => dialogRef.current?.showModal()}>
        Supprimer ce style
      </Button>
      <dialog ref={dialogRef} className="rounded-md p-6 shadow-xl backdrop:bg-black/40">
        <p className="mb-4 text-sm">Confirmer la suppression ?</p>
        <div className="flex justify-end gap-2">
          <button type="button" className="px-3 py-1 text-sm" onClick={() => dialogRef.current?.close()}>
            Annuler
          </button>
          <form action={deleteAction}>
            <button type="submit" className="rounded bg-red-600 px-3 py-1 text-sm text-white">
              Supprimer
            </button>
          </form>
        </div>
      </dialog>
    </section>
  );
}
```

`page.tsx` :

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
        initial={{ name: style.name, slug: style.slug, prompt: style.prompt }}
        action={updateAction}
        successMessage="Style mis à jour"
      />

      <hr />
      <DangerZone deleteAction={deleteAction} />
    </div>
  );
}
```

- [ ] **Step 6: Lint + build + commit**

```bash
npm run lint && npm run build
git add test/integration/visual-style-edit-action.test.ts src/app/\(app\)/settings/visual-styles/\[id\]/
git commit -m "$(cat <<'EOF'
🤖 feat(settings): route /settings/visual-styles/[id] (edit + delete)

Pattern miroir writing_templates/[id] : updateCore + deleteCore
avec lookup existence, DangerZone client component, redirect
après delete.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 9 : Sidebar + E2E + finalisation

### Task 19: Mise à jour de la sidebar settings

**Files:**
- Modify: `src/components/settings/settings-sidebar.tsx`

- [ ] **Step 1: Activer les 4 liens dans la sidebar**

Ouvrir le fichier et remplacer le bloc `items: Item[]` actuel :

```ts
const items: Item[] = [
  { label: 'Brand', href: '/settings/brand' },
  { label: 'Voix', href: '/settings/voice' },
  { label: "Templates d'écriture", href: '/settings/writing-templates' },
  { label: 'Visual briefing', href: '/settings/visual-briefing' },
  { label: 'Visual styles', href: '/settings/visual-styles' },
  { label: 'Clés API' },
];
```

(Seul `Clés API` reste sans href, traité en Spec 7.)

- [ ] **Step 2: Lint + build + tests existants**

Run: `npm run lint && npm run build && npm run test:e2e -- settings-brand`
Expected: vert. Le test `settings-brand` E2E continue de passer (l'assertion `expect(page.getByText("Voix")).toBeVisible()` tient même si le lien est maintenant cliquable).

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/settings-sidebar.tsx
git commit -m "$(cat <<'EOF'
🤖 feat(settings): sidebar active les liens voice, writing-templates, visual-briefing, visual-styles

4 placeholders posés en Spec 2 reçoivent maintenant leur href.
Seul 'Clés API' reste désactivé (Spec 7).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 20: E2E Playwright complet

**Files:**
- Create: `test/e2e/settings-editorial.spec.ts`

- [ ] **Step 1: Créer le fichier de test E2E**

`test/e2e/settings-editorial.spec.ts` :

```ts
import { expect, type Page, test } from '@playwright/test';

async function fetchMagicLink(page: Page, email: string): Promise<string> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const res = await page.request.get(`/api/__test__/emails?to=${encodeURIComponent(email)}`);
    const { emails } = await res.json();
    if (emails.length > 0) {
      const html = emails[0].html as string;
      const match = html.match(/href="([^"]+)"/);
      if (!match) throw new Error('Magic link not found');
      return match[1]!;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Magic link email never arrived');
}

async function signup(page: Page, email: string): Promise<void> {
  await page.request.delete('/api/__test__/emails');
  await page.goto('/signin');
  await page.fill('input[type="email"]', email);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/verify/);
  const magicUrl = await fetchMagicLink(page, email);
  await page.goto(magicUrl);
  await expect(page).toHaveURL('/');
}

test.describe('Settings editorial', () => {
  test('voice flow : voir seed, éditer, save, reload, persiste', async ({ page }) => {
    await signup(page, `pw-voice-${Date.now()}@test.invalid`);

    await page.goto('/settings/voice');
    await expect(page.getByText('Voix éditoriale')).toBeVisible();

    // Le seed v1 contient "Identité immuable"
    const textarea = page.locator('textarea[name="content"]');
    await expect(textarea).toHaveValue(/Identité immuable/);

    await textarea.fill('Voix de test E2E');
    await page.click('button[type="submit"]');
    await expect(page.getByText('Voix mise à jour')).toBeVisible({ timeout: 5_000 });

    await page.reload();
    await expect(page.locator('textarea[name="content"]')).toHaveValue('Voix de test E2E');
  });

  test('visual_briefing flow : voir seed, éditer, save, reload, persiste', async ({ page }) => {
    await signup(page, `pw-brief-${Date.now()}@test.invalid`);

    await page.goto('/settings/visual-briefing');
    await expect(page.getByText('Briefing visuel')).toBeVisible();

    const textarea = page.locator('textarea[name="content"]');
    await expect(textarea).toHaveValue(/Tu transformes un post/);

    await textarea.fill('Brief de test E2E');
    await page.click('button[type="submit"]');
    await expect(page.getByText('Briefing visuel mis à jour')).toBeVisible({ timeout: 5_000 });

    await page.reload();
    await expect(page.locator('textarea[name="content"]')).toHaveValue('Brief de test E2E');
  });

  test('writing_templates edit flow : voir seed, éditer name, sauver, vu en liste', async ({
    page,
  }) => {
    await signup(page, `pw-wt-edit-${Date.now()}@test.invalid`);

    await page.goto('/settings/writing-templates');
    await expect(page.getByText('Post LinkedIn standard')).toBeVisible();

    await page.click('text=Post LinkedIn standard');
    await expect(page).toHaveURL(/\/settings\/writing-templates\/[^/]+$/);
    await expect(page.getByText('Éditer le template')).toBeVisible();

    await page.fill('input[name="name"]', 'LinkedIn renommé');
    await page.click('button[type="submit"]');
    await expect(page.getByText('Template mis à jour')).toBeVisible({ timeout: 5_000 });

    await page.goto('/settings/writing-templates');
    await expect(page.getByText('LinkedIn renommé')).toBeVisible();
  });

  test('writing_templates create flow : créer un nouveau template, vu en liste', async ({
    page,
  }) => {
    await signup(page, `pw-wt-new-${Date.now()}@test.invalid`);

    await page.goto('/settings/writing-templates/new');
    await expect(page.getByText('Nouveau template d\'écriture')).toBeVisible();

    await page.fill('input[name="name"]', 'Carrousel');
    await page.fill('input[name="slug"]', 'carrousel');
    await page.fill('textarea[name="structure"]', 'HOOK / SLIDES / CTA');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/settings\/writing-templates$/);
    await expect(page.getByText('Carrousel')).toBeVisible();
    // Le seed par défaut reste aussi
    await expect(page.getByText('Post LinkedIn standard')).toBeVisible();
  });

  test('writing_templates delete flow : supprimer le seed via dialog', async ({ page }) => {
    await signup(page, `pw-wt-del-${Date.now()}@test.invalid`);

    await page.goto('/settings/writing-templates');
    await page.click('text=Post LinkedIn standard');
    await expect(page.getByText('Éditer le template')).toBeVisible();

    await page.click('text=Supprimer ce template');
    // Le dialog natif ouvert, cliquer sur le bouton "Supprimer" final
    const dialog = page.locator('dialog');
    await expect(dialog).toBeVisible();
    await dialog.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/settings\/writing-templates$/);
    await expect(page.getByText('Aucun template pour le moment')).toBeVisible();
  });

  test('visual_styles create flow : liste vide, créer un style', async ({ page }) => {
    await signup(page, `pw-vs-${Date.now()}@test.invalid`);

    await page.goto('/settings/visual-styles');
    await expect(page.getByText('Aucun style pour le moment')).toBeVisible();

    await page.click('text=+ Nouveau');
    await page.fill('input[name="name"]', 'Cinematic');
    await page.fill('input[name="slug"]', 'cinematic');
    await page.fill('textarea[name="prompt"]', 'rendu cinéma diffus');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/settings\/visual-styles$/);
    await expect(page.getByText('Cinematic')).toBeVisible();
  });
});
```

- [ ] **Step 2: Build + lancer les E2E**

Run: `npm run build && npm run test:e2e`
Expected: auth.spec.ts (1 test) + settings-brand.spec.ts (2 tests) + settings-editorial.spec.ts (6 tests) = **9 tests passent**.

- [ ] **Step 3: Commit**

```bash
git add test/e2e/settings-editorial.spec.ts
git commit -m "$(cat <<'EOF'
🤖 test(e2e): /settings/voice, /visual-briefing, /writing-templates, /visual-styles

6 tests E2E couvrant : voice + briefing flows (seed → edit → reload →
persiste), writing_templates edit + create + delete flows, et
visual_styles create flow.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 21: Vérification finale + push + watch CI

**Files:** aucun changement de code.

- [ ] **Step 1: Lint**

Run: `npm run lint`
Expected: vert.

- [ ] **Step 2: Tous les tests (unit + integration + worker)**

Run: `npm test`
Expected: tous verts. Total attendu : 64 (Spec 1+2) + ~38 (Spec 3) = ~102 tests.

- [ ] **Step 3: E2E**

Run: `npm run build && npm run test:e2e`
Expected: 9 tests verts.

- [ ] **Step 4: db:generate idempotent**

Run: `npm run db:generate`
Expected: "No schema changes, nothing to migrate".

- [ ] **Step 5: git status clean**

Run: `git status`
Expected: working tree clean.

- [ ] **Step 6: git log overview**

Run: `git log --oneline origin/main..HEAD`
Expected: ~20 commits depuis Spec 2 final, tous avec préfixe 🤖.

- [ ] **Step 7: Push origin main**

Run: `git push origin main`
Expected: push réussi.

- [ ] **Step 8: Watch CI**

Run: `gh run list --branch main --limit 1 --json databaseId --jq '.[0].databaseId' | xargs gh run watch --exit-status`
Expected: les 5 jobs (lint, unit, integration, worker, e2e) passent verts.

- [ ] **Step 9: Vérifier CI green**

Run: `gh run view --json conclusion --jq '.conclusion'` sur le run le plus récent.
Expected: `"success"`.

---

## Notes pour l'exécutant

- **Stack Docker** : `docker compose up -d` dans `/Users/ManuAVQN/Code/content-os-v2/` avant chaque session de tests. Postgres + Redis.
- **biome.json** exclut `src/components/ui/*` du lint, donc les composants shadcn générés (button.tsx, etc.) ne sont pas reformatés. Aucun composant ajouté dans cette spec n'utilise cette dispense.
- **Em-dash** : interdit dans tout le code et les commentaires. La règle s'applique aussi aux commit messages. Les rares em-dashes acceptés sont (a) inside test display strings comme `voice — tenant isolation` (consistance Spec 2), (b) à l'intérieur de DEFAULT_VOICE_CONTENT (donnée user littérale).
- **Le hook Better-Auth existant** dans `src/lib/auth/server.ts` doit être REMPLACÉ en Task 9, pas dupliqué. Ne pas créer un deuxième `databaseHooks.user.create.after`.
- **`useActionState` + `useFormStatus`** : React 19 natifs. Cherche pas `react-hook-form` dans le projet, on l'utilise pas.
- **`<dialog>` natif HTML** : utilise `ref.showModal()` côté JS, `<form method="dialog">` ou un `<form action={serverAction}>` à l'intérieur fait submit + ferme. Tester via `page.locator('dialog')` côté Playwright.
- **Test E2E `fetchMagicLink`** : helper existant déjà utilisé dans `settings-brand.spec.ts`. Copier le pattern (le helper est local au fichier, pas dans `helpers/`).
- **biome auto-fix** : si une étape échoue sur lint à cause d'un ordre d'import, lancer `npx biome check --write <file>` puis re-lancer le lint manuellement. Ne pas re-stage automatiquement sans inspecter le diff.
- **Drizzle ON CONFLICT** : `onConflictDoNothing({ target: [...columns] })` cible explicitement la contrainte unique. Sans `target`, Drizzle utilise n'importe quelle contrainte qui violerait, ce qui peut produire des comportements surprenants si plusieurs UNIQUE existent.
