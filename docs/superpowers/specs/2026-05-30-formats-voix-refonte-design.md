# Refonte : voix partagées + formats de publication + skill Contentos

**Date :** 2026-05-30
**Branche :** `claude/post-format-voice-refactor-3nYOI`
**App concernée :** `projects/app` (suite Contentos unifiée)

## Contexte

Contentos est un **outil pour agents** : aucune intelligence (aucun agent) ne tourne
dans l'app. L'app stocke et expose, via un endpoint MCP unique (`/api/mcp`), l'état que
les agents lisent et écrivent dans leurs workflows de production. La présente refonte
prépare cette donnée pour le workflow de rédaction côté agent.

Deux briques existent déjà dans la refonte unifiée :

- **Voix** (`voice` : `userId`, `name`, `content`) — identité éditoriale de l'auteur.
  Aujourd'hui rangée dans `cast/settings/voice/*`, alors qu'elle est en réalité un
  concept **transverse à la suite** (cast aujourd'hui, ressources demain).
- **Formats de publication** (table `writing_templates` : `userId`, `name`,
  `platform`='linkedin', `structure`, `writingRules`) — décrivent la structure d'un type
  de post pour une plateforme. Rangés dans `cast/settings/writing-templates/*`.

Le terme « template d'écriture » est trompeur : ce ne sont pas des gabarits de texte mais
des **descriptions de format de publication** liées à une plateforme.

## Objectifs

1. **Déplacer les voix** hors de cast, dans l'espace **Compte** (`/account/voices`),
   car partagées entre solutions de la suite.
2. **Renommer** le concept « templates d'écriture » → **« formats de publication »**
   (table `publication_formats`, outils MCP, UI), pour refléter la réalité.
3. **Enrichir le modèle de format** à **trois champs** sémantiques :
   - `structure` — squelette du post (hook, paragraphes, listes, longueur…). *(existe)*
   - `visualIntent` — **nouveau**. Champ libre décrivant le *type / l'intention* de
     visuel qui accompagne ce format (ex. « carrousel 5-7 slides », « citation sur fond
     de marque », « pas de visuel »). Intention, pas direction artistique précise.
   - `writingRules` — cosmétique de finalisation : emojis, hashtags, puces, règles de
     mise en page (toujours/jamais commencer par un emoji…). *(existe, renommé en libellé)*
4. **Nettoyer les skills** : supprimer tout le catalogue legacy (`src/lib/skills/catalog/*`)
   — l'historique git le conserve — et créer **un** skill `contentos` minimal qui décrit
   la séquence de rédaction pilotée par agent. Squelette posé, pas d'itération fine ici.

Hors périmètre (explicitement remis à plus tard) : la production de visuel, le champ
`platform` multi-plateforme (X, Threads…), l'itération détaillée du skill.

## Modèle de données

### Table renommée + enrichie

`writing_templates` → **`publication_formats`** :

```
publication_formats
  id            text pk
  user_id       text not null   (index)
  name          text not null
  platform      text not null default 'linkedin'
  structure     text not null
  visual_intent text            (nullable, nouveau)
  writing_rules text            (nullable, existant)
  created_at    timestamptz not null default now()
  updated_at    timestamptz not null default now()
```

### Migration Drizzle

`npm run db:generate` produit du DROP/CREATE par défaut (perte de données). On
**hand-édite** le SQL généré pour préserver les données :

```sql
ALTER TABLE "writing_templates" RENAME TO "publication_formats";
ALTER INDEX "writing_templates_user_id_idx" RENAME TO "publication_formats_user_id_idx";
ALTER TABLE "publication_formats" ADD COLUMN "visual_intent" text;
```

L'intégration (`app_integration`, persistante) et les previews existantes appliquent
proprement le rename sans perdre les lignes.

## Découpage des unités

Chaque unité a une responsabilité unique et une interface claire ; on suit les patterns
existants (repo → server-action `*-core` testable → action `'use server'` → page/form ;
impl MCP exporté + `registerTool`).

### A. Schéma & repository

- `src/lib/db/schemas/writing-templates.ts` → **`publication-formats.ts`** : table
  `publicationFormats`, type `PublicationFormat`, colonne `visualIntent`.
- `src/lib/db/schema.ts` (barrel) : remplacer l'export.
- `src/lib/db/repositories/writing-templates.ts` → **`publication-formats.ts`** :
  `createPublicationFormat` / `get` / `list` / `update` / `delete`, inputs/patch
  incluant `visualIntent?: string | null`.

### B. Outils MCP

- `src/lib/mcp/tools/config.ts` : renommer les outils
  `list_writing_templates` → **`list_publication_formats`**,
  `create_writing_template` → **`create_publication_format`**,
  `update_writing_template` → **`update_publication_format`**,
  `delete_writing_template` → **`delete_publication_format`**.
  Ajouter `visualIntent` aux input schemas create/update. Titres/descriptions FR
  « format de publication ». `configImpl` renommé en conséquence.
- Les voix gardent leurs outils MCP tels quels (`list/create/update/delete_voice`) —
  inchangés, juste déplacés conceptuellement (l'UI bouge, pas l'API).

### C. UI — formats de publication (restent dans cast)

Les formats restent une **sous-section de cast** (`/cast/settings/...`) — ils sont liés à
la publication. On renomme le segment et les libellés :

- `cast/settings/writing-templates/*` → **`cast/settings/formats/*`**.
- Form : ajouter le champ **« Intention visuelle » (optionnel)** entre Structure et
  « Règles d'écriture » ; renommer le libellé de section en « Formats de publication ».
- Liste, pages new/[id], actions, actions-core : renommage des imports + ajout
  `visualIntent` dans la validation Zod (`.max(2000)`, optionnel) et le passage au repo.
- `cast-nav.tsx` : l'onglet Réglages pointe désormais vers `/cast/settings/formats`
  (la voix n'est plus dans cast).

### D. UI — voix (déménagent dans Compte)

- Déplacer `cast/settings/voice/*` → **`account/voices/*`** (liste, new, [id], form,
  actions, actions-core, danger-zone). Adapter chemins de redirect/revalidate
  (`/account/voices`) et imports relatifs.
- `account/account-nav.tsx` : ajouter l'onglet **« Voix »** (`/account/voices`).
- `account/page.tsx` : inchangé (redirige vers `/account/connections`).
- `cast/settings/page.tsx` : redirige désormais vers `/cast/settings/formats`
  (au lieu de `/cast/settings/voice`).

### E. Seeds & defaults

- `src/lib/db/seeds/user-defaults.ts` : `DEFAULT_WRITING_TEMPLATE` →
  `DEFAULT_PUBLICATION_FORMAT` (mêmes valeurs + `visualIntent: null`), repo renommé.
- `src/lib/db/seeds/dev-sample.ts` : imports renommés.
- `scripts/seed-preview.mjs` : `INSERT INTO publication_formats` (+ colonne si on en
  seed une valeur ; sinon laisser `visual_intent` NULL).
- `scripts/seed-redaction.ts` : repo renommé ; le format « Post-thèse LinkedIn » peut
  recevoir un `visualIntent` (optionnel, on laisse NULL pour rester minimal).

### F. Génération (helper inerte)

- `src/lib/ai/build-system-prompt.ts` : non utilisé en runtime. On met à jour le type
  `TemplateInput` (optionnellement `visualIntent`) **uniquement si** un test l'exige —
  sinon on le laisse tel quel pour rester minimal. Décision : **on le laisse tel quel**
  (YAGNI ; la donnée visuelle servira la partie production de visuel, plus tard).

### G. Skills — nettoyage + skill Contentos

- **Supprimer** `src/lib/skills/catalog/content-os-redaction/`,
  `creer-une-ressource/`, `creer-un-visuel/`, `suite-avqn/` (git garde l'historique).
- **Créer** `src/lib/skills/catalog/contentos/` :
  - `manifest.json` : `{ name: "contentos", tool: "suite", version: 1, tagline, description, requires_mcp: ["contentos"] }`.
  - `SKILL.md` : squelette minimal décrivant la **séquence de rédaction** (sans
    détailler chaque sous-étape — itération ultérieure) :
    1. Brainstorm de l'idée avec l'humain.
    2. Choix **plateforme** + **format de publication** (`list_publication_formats`)
       + **voix** (`list_voices`).
    3. Plan / déroulé du post validé avec l'humain.
    4. Rédaction du **fond** selon la `structure` du format.
    5. Réécriture **dans la voix**, en itérant jusqu'à satisfaction.
    6. Application de la **cosmétique** (`writingRules` : emojis, hashtags, puces…).
    7. `create_post` → post prêt à publier.
    8. (Plus tard) production du visuel à partir de `visualIntent`.
  - Mentionne les outils MCP réels et le fait que toute l'intelligence est côté agent.
- Mettre à jour `src/lib/skills/catalog/README.md` (table des skills publiés → `contentos`).
- Le loader `catalog.ts` et la page `/skills` n'ont **pas** besoin de changer (ils lisent
  le dossier à chaud). `TOOL_ORDER`/`TOOL_LABEL` contiennent déjà `suite`.

## Tests (TDD)

On suit les tests existants comme gabarits, renommés et étendus :

- **Repository** (`publication-formats-repository.test.ts`) : create/get/list/update/
  delete + **persistance de `visualIntent`** (create avec valeur → relue ; update la
  modifie ; absent → NULL).
- **Server-actions** create/edit : renommées ; un cas couvrant `visualIntent` (saisi →
  persisté ; vide → NULL).
- **MCP config** (`mcp-tools-config.test.ts`) : `configImpl.createPublicationFormat` +
  list ; un cas `visualIntent`.
- **Catalogue MCP** (`mcp-endpoint-catalog.test.ts`) : ajouter une assertion que
  `create_publication_format` est exposé (et que l'ancien nom ne l'est plus).
- **Seeds** (`user-defaults-seed.test.ts`, `seed-dev.test.ts`, `seed-redaction.test.ts`) :
  imports renommés, assertions sur le nom de format inchangées.
- **Tenant isolation** : suite `writing_templates` → `publication_formats`.
- **Voix** : les tests repo/action voix existants restent verts (l'API ne change pas) ;
  on adapte seulement les chemins d'import des server-actions déplacées.

## Vérification visuelle (réflexe œil de l'agent)

Modifs de rendu : form de format (nouveau champ), nav cast (libellé Réglages), nouvel
onglet « Voix » dans Compte, liste des voix sous `/account/voices`. Avant push : `/apercu`
sur `/cast/settings/formats/new` et `/account/voices` (mobile + desktop), Read des PNG,
critique, correction si besoin.

## Risques & points de vigilance

- **Migration de rename** : bien hand-éditer le SQL (pas de DROP). Vérifier le rename
  d'index. L'intégration est persistante → un DROP perdrait les formats réels.
- **Recherche exhaustive des références** : `writing`/`template` apparaissent dans ~30
  fichiers (src + tests + 2 scripts + skills supprimés). Grep de contrôle final pour
  qu'aucun `writing_templates` / `writingTemplate` ne subsiste hors historique.
- **`/skills` à chaud** : après suppression, vérifier que la page ne casse pas sur un
  dossier sans manifest (déjà géré : try/catch ignore).
- **Pas de pipeline runtime cassé** : `buildSystemPrompt` n'est appelé nulle part ; on ne
  le recâble pas.

## Critères de succès

- `npm test` vert (unit + integration), `biome check .` vert.
- Voix gérables sous `/account/voices` ; plus aucune entrée voix dans cast.
- Formats gérables sous `/cast/settings/formats` avec les 3 champs ; `visualIntent`
  persiste via UI et MCP.
- Endpoint MCP expose `*_publication_format` ; plus aucun `*_writing_template`.
- Catalogue de skills = un seul skill `contentos` ; anciens supprimés.
- Données de l'intégration préservées par la migration de rename.
