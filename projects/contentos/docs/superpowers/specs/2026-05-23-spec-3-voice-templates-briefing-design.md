# Spec 3 (Voice + writing_templates + visual_briefing) Design

> **Position dans la roadmap v2** : 3e spec sur 8. Suit Spec 1 (bootstrap) et Spec 2 (schema business + page Brand). Active 4 des 5 placeholders de la sidebar `/settings/...` posée en Spec 2.

## Objectif

Permettre à un user signé d'éditer son identité éditoriale (voix), son brief image, ses templates d'écriture et ses styles graphiques. Avant Spec 3 le user signe et arrive sur un dashboard vide ; après Spec 3 il dispose d'un contenu par défaut (porté de v1) pour les 4 entités et peut le personnaliser.

## Scope

**Inclus :**
- 4 nouvelles entités scopées `user_id` : `voice`, `visual_briefing`, `writing_templates`, `visual_styles`.
- 4 pages sous `/settings/...` avec édition complète (CRUD pour les listes, save pour les singletons).
- Hook Better-Auth `databaseHooks.user.create.after` qui seed les défauts à chaque signup, **y compris** `settings` (centralisation du seeding pour les 5 singletons + 1 default writing_template).
- Tests integration + harness tenant isolation + E2E Playwright sur les 4 pages.
- Suppression du fallback in-memory dans `src/app/(app)/settings/brand/page.tsx` rendu obsolète par le seeding centralisé.

**Hors scope :**
- FK `posts.writing_template_id → writing_templates(id)` : laissée à Spec 4 (pipeline texte).
- Script de migration des users pré-existants : pas applicable, pas de production en cours.
- API REST/MCP sur ces entités : Spec 7.

## Architecture cible

### Schémas Drizzle

4 fichiers dans `src/lib/db/schemas/` :

```
voice           (user_id text PK → user.id CASCADE, content text NOT NULL, updated_at timestamp NOT NULL defaultNow)
visual_briefing (user_id text PK → user.id CASCADE, content text NOT NULL, updated_at timestamp NOT NULL defaultNow)

writing_templates (
  id           text PK cuid2,
  user_id      text NOT NULL FK CASCADE,
  name         text NOT NULL,
  slug         text NOT NULL,
  platform     text NOT NULL DEFAULT 'linkedin',
  structure    text NOT NULL,
  writing_rules text NULL,
  created_at   timestamp NOT NULL defaultNow,
  updated_at   timestamp NOT NULL defaultNow,
  UNIQUE (user_id, slug),
  INDEX writing_templates_user_id_idx (user_id)
)

visual_styles (
  id          text PK cuid2,
  user_id     text NOT NULL FK CASCADE,
  name        text NOT NULL,
  slug        text NOT NULL,
  prompt      text NOT NULL,
  created_at  timestamp NOT NULL defaultNow,
  updated_at  timestamp NOT NULL defaultNow,
  UNIQUE (user_id, slug),
  INDEX visual_styles_user_id_idx (user_id)
)
```

Tous les noms d'index/contraintes sont laissés à drizzle-kit (convention par défaut).

Le barrel `src/lib/db/schema.ts` re-exporte ces 4 nouveaux fichiers (alphabétique, biome enforce l'ordre).

### Repositories (`src/lib/db/repositories/`)

**Singletons** :
- `voice.ts` : `getVoice(userId)`, `upsertVoice(userId)`, `updateVoice(userId, { content })`.
- `visual-briefing.ts` : `getVisualBriefing(userId)`, `upsertVisualBriefing(userId)`, `updateVisualBriefing(userId, { content })`.

`upsertVoice` et `upsertVisualBriefing` insèrent une row avec le contenu par défaut (importé depuis `src/lib/db/seeds/user-defaults.ts`) si absente, no-op si présente.

**Listes** :
- `writing-templates.ts` : 5 fonctions CRUD (create, get, list, update, delete) signatures `(userId, ...)`, WHERE scopé.
- `visual-styles.ts` : idem.

`createWritingTemplate` et `createVisualStyle` utilisent `INSERT ... ON CONFLICT (user_id, slug) DO NOTHING ... RETURNING *` pour que le seed soit idempotent. Si conflit, la fonction retourne `undefined`, l'appelant décide (le hook ignore ; la Server Action remonte une erreur de validation slug).

Update patches autorisent tous les champs éditables : `Partial<{ name, slug, platform, structure, writing_rules }>` pour writing_templates ; `Partial<{ name, slug, prompt }>` pour visual_styles. Pas d'`Omit` exotique.

### Seeding centralisé

Nouveau fichier `src/lib/db/seeds/user-defaults.ts` :

```ts
export const DEFAULT_VOICE_CONTENT: string;          // copie verbatim de v1 src/prompts/voice.md
export const DEFAULT_VISUAL_BRIEFING_CONTENT: string;// copie verbatim du seedInitialVisualBriefing v1
export const DEFAULT_WRITING_TEMPLATE: {
  name: 'Post LinkedIn standard',
  slug: 'linkedin-standard',
  platform: 'linkedin',
  structure: string,    // copie verbatim v1
  writing_rules: null,
};

export async function seedUserDefaults(userId: string): Promise<void> {
  await upsertSettings(userId);
  await upsertVoice(userId);
  await upsertVisualBriefing(userId);
  await createWritingTemplate(userId, DEFAULT_WRITING_TEMPLATE); // ON CONFLICT DO NOTHING
}
```

Aucun default visual_style : un user crée les siens à la demande.

**Hook Better-Auth** dans `src/lib/auth/server.ts` :

```ts
export const auth = betterAuth({
  // ... (config existante)
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await seedUserDefaults(user.id);
        },
      },
    },
  },
});
```

**Stratégie d'erreur** : fail-fast. Si `seedUserDefaults` throw, l'inscription user remonte l'erreur (Better-Auth a déjà committé le user ; Spec 3 accepte ce risque résiduel rare, un script de réparation pourra être écrit en Spec 8 si besoin). Pas de partial-seed silencieux.

**Conséquence Spec 2** : `src/app/(app)/settings/brand/page.tsx` retire le fallback `settings ?? { brandName: '', ... }`. La page suppose que `getSettings(userId)` retourne toujours une row. Si exceptionnellement absente (user pré-Spec3), la page throw : comportement acceptable, ces users n'existent pas en pratique.

### Routes & pages UI

Organisation conservatrice : un dossier par entité sous `src/app/(app)/settings/`. Pattern wrapper/core pour les Server Actions (Spec 2 Brand) appliqué partout.

```
src/app/(app)/settings/
├── voice/
│   ├── page.tsx               server : lit voice, render <VoiceForm initial={...} />
│   ├── actions.ts             'use server' : session + delegate au core
│   ├── actions-core.ts        pure : (userId, FormData) → ActionState, Zod
│   └── voice-form.tsx         client : useActionState + textarea + Save + sonner
├── visual-briefing/
│   └── ... (4 fichiers, même shape)
├── writing-templates/
│   ├── page.tsx               server : liste, lien "+ Nouveau"
│   ├── new/
│   │   ├── page.tsx           server : render <WritingTemplateForm mode="create" />
│   │   ├── actions.ts
│   │   └── actions-core.ts
│   ├── [id]/
│   │   ├── page.tsx           server : lit template, render <WritingTemplateForm mode="edit" initial={...} />
│   │   ├── actions.ts         updateAction + deleteAction
│   │   └── actions-core.ts
│   └── writing-template-form.tsx  client : partagé create + edit, mode prop
└── visual-styles/
    └── ... (même shape que writing-templates)
```

Le composant `<WritingTemplateForm>` est partagé entre create et edit via une prop `mode`. Idem `<VisualStyleForm>`. Évite la duplication d'un form de 5 champs.

Le delete vit sur la page d'édition (pas sur la liste), via un second `<form action={deleteAction}>` séparé du form de save. Confirmation par `<dialog>` natif HTML (ou shadcn AlertDialog si déjà installé). Après delete : redirect vers la liste + toast.

**Sidebar update** (`src/components/settings/settings-sidebar.tsx`) :
- Items `Voix`, `Templates d'écriture`, `Visual briefing`, `Visual styles` reçoivent leur `href` (`/settings/voice`, `/settings/writing-templates`, `/settings/visual-briefing`, `/settings/visual-styles`).
- `Clés API` reste désactivé.

### Validation Zod par entité

**voice** :
```ts
z.object({ content: z.string().min(1).max(10000) })
```

**visual_briefing** :
```ts
z.object({ content: z.string().min(1).max(10000) })
```

**writing_templates** :
```ts
z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/),
  platform: z.enum(['linkedin']),
  structure: z.string().min(1).max(5000),
  writing_rules: z.string().max(5000).nullable().or(z.literal('')).transform(v => v || null),
})
```

**visual_styles** :
```ts
z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/),
  prompt: z.string().min(1).max(2000),
})
```

Erreurs renvoyées au form sous forme `{ status: 'error', message: 'validation', fieldErrors: { brand_name: '...', ... } }` (même shape que `BrandActionState` Spec 2).

**Gestion collision slug** : si la Server Action create reçoit un slug déjà pris pour ce user, le repo retourne undefined → l'action retourne `{ status: 'error', message: 'duplicate-slug', fieldErrors: { slug: 'Slug déjà utilisé.' } }`. Le form affiche le message sous le champ.

## Data flow

```
Signup (Better-Auth magic link)
  → Better-Auth crée user
  → databaseHooks.user.create.after → seedUserDefaults(user.id)
    → upsertSettings + upsertVoice + upsertVisualBriefing + createWritingTemplate
  → redirect dashboard

Edit voice
  → GET /settings/voice → page.tsx → getVoice(userId) → <VoiceForm initial={content} />
  → User édite + clique Enregistrer
  → form action → updateVoiceAction(prev, formData)
    → session check → updateVoiceCore(userId, formData)
    → Zod validate → updateVoice(userId, { content })
    → revalidatePath('/settings/voice')
    → return { status: 'success' }
  → useActionState reçoit success → useEffect → toast.success
```

Idem pour visual_briefing.

```
Create writing_template
  → GET /settings/writing-templates/new
  → User remplit + submit
  → createWritingTemplateAction → core → Zod → createWritingTemplate(userId, data)
  → ON CONFLICT : repo retourne undefined → action retourne error
    → form affiche fieldErrors.slug
  → ON SUCCESS : revalidatePath('/settings/writing-templates') + redirect
  → liste rafraîchie avec le nouveau template
```

```
Edit writing_template
  → GET /settings/writing-templates/[id]
  → page.tsx → getWritingTemplate(userId, id) → si null → notFound()
  → <WritingTemplateForm mode="edit" initial={...} />
  → Edit champs → submit save
  → updateAction → core → Zod → updateWritingTemplate(userId, id, patch)
  → revalidate + toast
```

```
Delete writing_template
  → Form séparé sur la page d'édition
  → User clique "Supprimer" → <dialog> confirm → submit
  → deleteAction → session check → deleteWritingTemplate(userId, id)
  → redirect('/settings/writing-templates') + revalidate
```

## Error handling

- **Session absente** sur un Server Action → retourne `{ status: 'error', message: 'unauthenticated' }`. Middleware/layout redirigent normalement avant que l'action soit appelée, c'est belt-and-suspenders.
- **Zod validation fail** → `{ status: 'error', message: 'validation', fieldErrors }`. Toast `'Champs invalides'`. Inline error sous chaque champ erroné.
- **Slug collision** sur create → `{ status: 'error', message: 'duplicate-slug', fieldErrors: { slug: 'Déjà utilisé.' } }`. Toast `'Slug déjà utilisé'`.
- **Get sur entité inexistante** (writing_template/visual_style avec ID inconnu OU appartenant à un autre user) → `notFound()` côté page (Next.js 404).
- **Update sur entité d'un autre user** → le repo retourne undefined (WHERE scopé). L'action interprète : 404. Improbable en pratique (l'URL n'est pas dévinable), mais le test cross-tenant le valide.
- **Seed hook qui throw** → propage, échec signup. Acceptable.

## Tests

### Unit
Aucun à ajouter (la validation Zod est couverte par les action-core tests integration).

### Integration

**Repositories** (TDD, fichiers `test/integration/*-repository.test.ts`) :
- `voice-repository.test.ts` : 3 tests (get absent → undefined ; upsert crée avec default ; update modifie content + updatedAt).
- `visual-briefing-repository.test.ts` : idem.
- `writing-templates-repository.test.ts` : 5 tests CRUD happy path.
- `visual-styles-repository.test.ts` : idem.

**Seed hook** (`test/integration/user-defaults-seed.test.ts`) :
- Test 1 : `seedUserDefaults('u1')` après `db.insert(user)` → `getSettings`, `getVoice`, `getVisualBriefing`, `listWritingTemplates` retournent les défauts (settings vide, voice/briefing contenant un marker du seed v1, 1 writing_template `linkedin-standard`).
- Test 2 : idempotence. `seedUserDefaults` appelé deux fois sur le même user, pas de duplication, pas d'erreur.

**Server Actions cores** (4 fichiers, pattern Spec 2 Brand) :
- `voice-action.test.ts` : success + validation error (content vide).
- `visual-briefing-action.test.ts` : idem.
- `writing-template-action.test.ts` : success ; slug invalide (regex) ; slug doublonné (UNIQUE constraint) ; update sur template d'un autre user → no-op silencieux.
- `visual-style-action.test.ts` : success ; slug invalide ; slug doublonné.

**Tenant isolation** (extension `test/integration/tenant-isolation.test.ts`) :
- 2 fixtures harness ajoutées : `writing_templates` et `visual_styles`. Génèrent 4 tests chacun via `runTenantIsolationSuite`.
- 2 bespoke describes ajoutés : `voice — tenant isolation` (2 tests : isolation des contents, update A ne touche pas B) et `visual_briefing — tenant isolation` (2 tests idem). Pattern identique à `settings — tenant isolation` Spec 2.

### Worker
Pas de nouveau test worker (cette spec ne touche pas BullMQ).

### E2E (Playwright, `test/e2e/settings-editorial.spec.ts`)

Un seul fichier, 5-6 tests :
1. **Voice flow** : signup → /settings/voice → voir un marker du content seed v1 → modifier → save → toast → reload → persiste.
2. **Visual briefing flow** : signup → /settings/visual-briefing → idem.
3. **Writing templates edit flow** : signup → /settings/writing-templates → voir `Post LinkedIn standard` (le seed) → cliquer → éditer name → save → revenir liste → name modifié visible.
4. **Writing templates create flow** : signup → /settings/writing-templates/new → remplir → submit → revenir liste → 2 templates visibles.
5. **Writing templates delete flow** : signup → /settings/writing-templates → ouvrir le seed → supprimer → confirm dialog → retour liste vide.
6. **Visual styles create flow** : signup → /settings/visual-styles → liste vide → créer → liste 1 row.

Test E2E settings-brand existant continue de passer sans modification (la sidebar gagne des liens cliquables au lieu de placeholders, mais l'assertion `expect(page.getByText("Voix")).toBeVisible()` tient).

### Test setup integration

`test/setup-integration.ts` étendu pour truncate les 4 nouvelles tables, en respectant l'ordre topologique des FK (toutes dépendent de `user`) :

```ts
// dans le beforeEach, AVANT settings (cohérent : on supprime les tables référençantes en premier)
await db.delete(visualStyles);
await db.delete(writingTemplates);
await db.delete(visualBriefing);
await db.delete(voice);
// puis settings, account, session, verification, user (ordre actuel)
```

## Migration & déploiement

**Migration `drizzle/0002_*.sql`** générée par drizzle-kit :
- 4 `CREATE TABLE` (voice, visual_briefing, writing_templates, visual_styles).
- 4 FK ON DELETE CASCADE vers `user.id`.
- 2 contraintes `UNIQUE(user_id, slug)` (writing_templates, visual_styles).
- 2 indexes (`writing_templates_user_id_idx`, `visual_styles_user_id_idx`).

Purement additive : aucun `ALTER`/`DROP` sur tables existantes. Rollback = revert du commit + `DROP TABLE` des 4 tables manuellement.

**CI** : aucun changement à `.github/workflows/ci.yml`. Les 5 jobs couvrent automatiquement les nouveaux fichiers.

**Pas de modification du schema posts** dans cette spec.

## Conventions

- IDs en cuid2 pour writing_templates et visual_styles.
- French comments dans le code OK. Pas d'em-dash `—`, pas d'emojis dans le code.
- 2-space indent, declared functions, TS strict.
- Server Action split wrapper/core comme Spec 2 Brand (testabilité integration sans mocker la session).
- `useActionState` + `useFormStatus` + sonner toasts pour tous les forms.
- `<dialog>` natif HTML pour les confirms (ou shadcn AlertDialog si déjà dispo dans le repo Spec 3).
- Validation Zod côté core, jamais côté repo.
- Slug regex `/^[a-z0-9-]+$/` côté Zod ; UNIQUE constraint côté DB ; ON CONFLICT DO NOTHING côté repo pour idempotence.

## Critères de réussite

- Un user qui signe peut naviguer sur les 5 sections `/settings/...` (brand + 4 nouvelles) sans erreur.
- Voice et visual_briefing contiennent les contenus seed v1 dès le signup.
- Writing_templates contient `Post LinkedIn standard` (seed) dès le signup.
- Visual_styles est vide au signup ; l'user peut en créer ; les rows persistent.
- ~40 nouveaux tests integration (4 repos : 3+3+5+5 ; hook seed : 2 ; actions cores : 2+2+4+3 ; harness writing_templates+visual_styles : 4+4 ; bespoke voice+briefing : 2+2). 5-6 E2E.
- Tenant isolation prouvée par le harness sur les 2 listes + bespoke sur les 2 singletons.
- `npm run lint && npm test && npm run build && npm run test:e2e` tous verts.
- CI 5/5 jobs verts sur main après push.

## Décisions ouvertes (à trancher en plan)

- **Slug auto-généré ou manuel ?** Décidé manuel pour simplicité. Si friction utilisateur observée plus tard, ajouter un suggestion basée sur `name` côté client (pas dans cette spec).
- **AlertDialog shadcn vs <dialog> natif** : utiliser ce qui est disponible (la spec ne tranche pas). Le plan inspectera l'état de `src/components/ui/` et préférera AlertDialog si déjà présent.
- **Nom du dossier route writing_templates** : `writing-templates` (avec tiret). Cohérent avec `visual-briefing` et `visual-styles`.

## Hors de cette spec mais à garder en tête

- Spec 4 (pipeline posts) consommera ces 4 entités : la Server Action `generate-post` lira voice + visual_briefing + writing_template choisi pour construire le system prompt Anthropic. Le schema posts a déjà la colonne `writing_template_id` (Spec 2) qui sera contraintée FK dans Spec 4.
- Spec 5 (médias) consommera `visual_styles` dans la pipeline Gemini.
- Spec 8 (polish) ajoutera potentiellement un script `reseed-user.ts` pour les users pré-Spec3 (irrélevant tant qu'on n'a pas de prod).
