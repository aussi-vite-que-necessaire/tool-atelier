# Skill de rédaction — Plan d'implémentation (spec 20)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Le premier skill agent rédige des posts en lisant l'état de ContentOS via MCP (idée, voix, template) et en y reposant le draft, prouvant le modèle « OS pour agents ».

**Architecture :** Deux dépôts. `content-os` (plateforme) gagne un tool `create_post` et un seed de la matière éditoriale, et perd `generate_post` une fois la preuve faite. `content-os-skills` (nouveau) porte le skill : orchestration générique + bricks de craft, sans aucune spécificité de client ni de format (celle-ci vit dans les entités ContentOS).

**Tech Stack :** TypeScript, MCP SDK (`@modelcontextprotocol/sdk`), Drizzle/Postgres, Vitest (projet `integration`, DB `contentos_test`). Le skill est du Markdown.

**Découpage en PR :** chaque phase est une frontière de commit/PR naturelle. Phases 1-2 et 5 dans `content-os` ; phase 3 dans `content-os-skills` ; phase 4 est une validation manuelle. La phase 5 ne démarre qu'après la phase 4.

---

## Phase 1 — `content-os` : tool `create_post`

Permet à l'agent de déposer un post qu'il a rédigé. La fonction repo `createPost` existe déjà ; on expose un tool MCP par-dessus, calqué sur les autres tools de `posts.ts`.

### Task 1 : tool `create_post`

**Files:**
- Modify: `src/lib/mcp/tools/posts.ts`
- Test: `test/integration/mcp-tools-content.test.ts`

- [ ] **Step 1 : écrire le test qui échoue**

Ajouter ce test dans le `describe('mcp tools — posts', …)` de `test/integration/mcp-tools-content.test.ts` :

```ts
test('create_post : crée un post draft rattaché à une idée', async () => {
  const userId = await createTestUser('mcpcreatepost');
  const idea = await createIdea(userId, { idea: 'i', brief: 'brief ok' });
  const created = await postImpl.create(userId, {
    ideaId: idea.id,
    content: 'texte rédigé par l’agent',
  });
  expect(created.content).toBe('texte rédigé par l’agent');
  expect(created.status).toBe('draft');
  expect(created.ideaId).toBe(idea.id);

  const fetched = await postImpl.get(userId, { id: created.id });
  expect(fetched?.id).toBe(created.id);
});

test('create_post : writingTemplateId et status sont propagés', async () => {
  const userId = await createTestUser('mcpcreatepost2');
  const idea = await createIdea(userId, { idea: 'i', brief: 'b' });
  const created = await postImpl.create(userId, {
    ideaId: idea.id,
    content: 'c',
    writingTemplateId: 'tpl-123',
    status: 'validated',
  });
  expect(created.status).toBe('validated');
  expect(created.writingTemplateId).toBe('tpl-123');
});
```

- [ ] **Step 2 : lancer le test, vérifier qu'il échoue**

Run : `npm run db:test:prepare && npm run test:integration -- mcp-tools-content`
Attendu : ÉCHEC — `postImpl.create is not a function`.

- [ ] **Step 3 : implémenter le tool**

Dans `src/lib/mcp/tools/posts.ts`, ajouter `createPost` à l'import du repo :

```ts
import { createPost, deletePost, getPost, listPosts, updatePost } from '@/lib/db/repositories/posts';
```

Ajouter `create` à `postImpl` (après `get`) :

```ts
create: (
  userId: string,
  input: {
    ideaId: string;
    content: string;
    writingTemplateId?: string;
    status?: 'draft' | 'validated';
  },
) => createPost(userId, input),
```

Enregistrer le tool dans `registerPostTools`, juste après `get_post` :

```ts
server.registerTool(
  'create_post',
  {
    title: 'Créer un post',
    description: 'Crée un post à partir d’un contenu rédigé, rattaché à une idée existante.',
    inputSchema: {
      ideaId: z.string(),
      content: z.string(),
      writingTemplateId: z.string().optional(),
      status: z.enum(['draft', 'validated']).optional(),
    },
  },
  (input, extra) => handle(extra, (userId) => postImpl.create(userId, input)),
);
```

- [ ] **Step 4 : lancer le test, vérifier qu'il passe**

Run : `npm run test:integration -- mcp-tools-content`
Attendu : PASS (tous les tests du fichier).

- [ ] **Step 5 : biome + commit**

```bash
npx biome format --write src/lib/mcp/tools/posts.ts test/integration/mcp-tools-content.test.ts
git add src/lib/mcp/tools/posts.ts test/integration/mcp-tools-content.test.ts
git commit -m "🤖 feat(mcp): tool create_post (l'agent dépose un post rédigé)"
```

---

## Phase 2 — `content-os` : seed de la matière éditoriale

Migre le contenu de `tov.zip` vers des entités ContentOS pour le compte de Manu : voix, template post-thèse, idée AVQN. Script idempotent, calqué sur `scripts/seed-dev.ts`.

### Task 2 : préparer les contenus sources

**Files:**
- Create: `scripts/seed-redaction/voix-manu.md`
- Create: `scripts/seed-redaction/post-these-structure.md`
- Create: `scripts/seed-redaction/post-these-rules.md`
- Create: `scripts/seed-redaction/idee-avqn.md`

- [ ] **Step 1 : extraire les sources**

```bash
mkdir -p scripts/seed-redaction
unzip -o ~/Downloads/tov.zip -d /tmp/tov
```

- [ ] **Step 2 : `voix-manu.md`** — copier intégralement `/tmp/tov/voix-manu.md` dans `scripts/seed-redaction/voix-manu.md`. C'est le contenu du champ `voice.content`.

- [ ] **Step 3 : `post-these-structure.md`** — assembler dans ce fichier (= futur champ `writing-template.structure`) : la section « Architecture à thèse » (séquence des 7 paragraphes) de `/tmp/tov/post-these-linkedin.md`, suivie de l'« Exemple calibré : le post AVQN » annoté et des « Points-clés du making-of ». Ce sont les parties **déclaratives de format**, pas la séquence de bricks.

- [ ] **Step 4 : `post-these-rules.md`** — assembler dans ce fichier (= futur champ `writing-template.writingRules`) : les « Mécaniques de hook validées » pour le post-thèse (depuis `post-these-linkedin.md` ET la section « Pour un post-thèse réflexive » de `/tmp/tov/choisir-hook.md`), la règle « Chute : affirmation, pas question », la section « Longueur et format » (9-12 paragraphes, hashtags 2-4, pas d'emoji dans le corps), et les « Critères de qualité du résultat ».

- [ ] **Step 5 : `idee-avqn.md`** — extraire de `/tmp/tov/matiere-avqn.md` un titre court (`idea`) et un brief (`brief`) : le brief = la matière de fond (sections 1 à 5 + formules à conserver). Format du fichier : première ligne `# <titre>`, le reste = brief.

- [ ] **Step 6 : commit**

```bash
git add scripts/seed-redaction
git commit -m "🤖 chore(seed): contenus sources rédaction (voix, format post-thèse, idée AVQN)"
```

### Task 3 : script de seed idempotent

**Files:**
- Create: `scripts/seed-redaction.ts`
- Test: `test/integration/seed-redaction.test.ts`

- [ ] **Step 1 : écrire le test qui échoue**

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { listVoices } from '@/lib/db/repositories/voice';
import { listWritingTemplates } from '@/lib/db/repositories/writing-templates';
import { listIdeas } from '@/lib/db/repositories/ideas';
import { seedRedaction } from '@/../scripts/seed-redaction';
import { createTestUser } from './helpers/seed';

describe('seed-redaction', () => {
  test('crée voix + template + idée, et est idempotent', async () => {
    const userId = await createTestUser('seedredac');
    await seedRedaction(userId);
    await seedRedaction(userId); // deuxième passage : pas de doublon

    const voices = await listVoices(userId);
    expect(voices.filter((v) => v.name === 'Manu')).toHaveLength(1);

    const templates = await listWritingTemplates(userId);
    expect(templates.filter((t) => t.name === 'Post-thèse LinkedIn')).toHaveLength(1);

    const ideas = await listIdeas(userId);
    expect(ideas.filter((i) => i.idea.startsWith('AVQN'))).toHaveLength(1);

    const voice = voices.find((v) => v.name === 'Manu');
    expect(voice?.content).toContain('contraste mesuré');
  });
});
```

- [ ] **Step 2 : lancer le test, vérifier qu'il échoue**

Run : `npm run test:integration -- seed-redaction`
Attendu : ÉCHEC — module `scripts/seed-redaction` introuvable.

- [ ] **Step 3 : implémenter le script**

Créer `scripts/seed-redaction.ts`. La fonction `seedRedaction(userId)` lit les fichiers de `scripts/seed-redaction/`, et pour chaque entité vérifie l'existence par `name` (voix, template) ou par préfixe d'`idea` avant de créer — d'où l'idempotence.

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createIdea, listIdeas } from '@/lib/db/repositories/ideas';
import { createVoice, listVoices } from '@/lib/db/repositories/voice';
import {
  createWritingTemplate,
  listWritingTemplates,
} from '@/lib/db/repositories/writing-templates';

const DIR = join(process.cwd(), 'scripts', 'seed-redaction');
const read = (f: string) => readFileSync(join(DIR, f), 'utf8');

export async function seedRedaction(userId: string): Promise<void> {
  const voices = await listVoices(userId);
  if (!voices.some((v) => v.name === 'Manu')) {
    await createVoice(userId, { name: 'Manu', content: read('voix-manu.md') });
  }

  const templates = await listWritingTemplates(userId);
  if (!templates.some((t) => t.name === 'Post-thèse LinkedIn')) {
    await createWritingTemplate(userId, {
      name: 'Post-thèse LinkedIn',
      platform: 'linkedin',
      structure: read('post-these-structure.md'),
      writingRules: read('post-these-rules.md'),
    });
  }

  const ideaFile = read('idee-avqn.md');
  const [titleLine, ...rest] = ideaFile.split('\n');
  const title = titleLine.replace(/^#\s*/, '').trim();
  const brief = rest.join('\n').trim();
  const ideas = await listIdeas(userId);
  if (!ideas.some((i) => i.idea.startsWith('AVQN'))) {
    await createIdea(userId, { idea: title, brief });
  }
}
```

- [ ] **Step 4 : lancer le test, vérifier qu'il passe**

Run : `npm run test:integration -- seed-redaction`
Attendu : PASS.

- [ ] **Step 5 : exposer une commande CLI**

Ajouter à la fin de `scripts/seed-redaction.ts` un runner CLI prenant l'email en argument (calqué sur `scripts/seed-dev.ts` pour résoudre le userId depuis l'email), et un script npm dans `package.json` :

```json
"seed:redaction": "tsx --env-file-if-exists=.env scripts/seed-redaction.ts"
```

- [ ] **Step 6 : biome + commit**

```bash
npx biome format --write scripts/seed-redaction.ts test/integration/seed-redaction.test.ts package.json
git add scripts/seed-redaction.ts test/integration/seed-redaction.test.ts package.json
git commit -m "🤖 feat(seed): seed-redaction (voix Manu, template post-thèse, idée AVQN)"
```

---

## Phase 3 — `content-os-skills` : le skill réorganisé

Travail dans un **nouveau dépôt frère** `/Users/ManuAVQN/Code/content-os-skills`. Le skill ne contient que la méthode générique et l'orchestration ; voix et format vivent désormais dans ContentOS.

### Task 4 : initialiser le dépôt et importer les bricks existants

**Files:**
- Create: `/Users/ManuAVQN/Code/content-os-skills/` (repo)
- Create: `content-os-redaction/production/choisir-hook.md`
- Create: `content-os-redaction/production/architecturer-narration.md`

- [ ] **Step 1 : créer le dépôt**

```bash
mkdir -p /Users/ManuAVQN/Code/content-os-skills/content-os-redaction/production
mkdir -p /Users/ManuAVQN/Code/content-os-skills/content-os-redaction/relecture
cd /Users/ManuAVQN/Code/content-os-skills && git init
```

- [ ] **Step 2 : importer les deux bricks existantes**

Copier `/tmp/tov/choisir-hook.md` et `/tmp/tov/architecturer-narration.md` dans `content-os-redaction/production/`.

- [ ] **Step 3 : retirer les variantes de format des bricks**

Dans `production/choisir-hook.md` : supprimer toute la section « Variantes par type de contenu » (les mécaniques post-thèse partent dans le `writing-template`). Garder le principe, les deux règles structurantes, la méthode des trois hooks et les anti-patterns. Remplacer la fin par une phrase neutre : « La typologie des mécaniques à explorer est fournie par le writing-template du format visé. »

Dans `production/architecturer-narration.md` : supprimer la section « Variantes d'architecture par type de contenu ». Garder les trois principes structurants, la méthode paragraphe par paragraphe, les vérifications et les anti-patterns. Remplacer la fin par : « L'architecture précise à appliquer est fournie par le writing-template du format visé. »

- [ ] **Step 4 : commit**

```bash
cd /Users/ManuAVQN/Code/content-os-skills
git add . && git commit -m "🤖 feat(redaction): bricks hook + narration (génériques, sans variante de format)"
```

### Task 5 : écrire `SKILL.md` (orchestration générique)

**Files:**
- Create: `content-os-redaction/SKILL.md`

- [ ] **Step 1 : écrire le fichier**

Contenu intégral :

```markdown
---
name: content-os-redaction
description: Rédige, réécrit ou relit du contenu éditorial signé Emmanuel "Manu" Bernard (AVQN) — posts LinkedIn, emails, pages, messages — en s'appuyant sur l'état stocké dans ContentOS. Déclencher quand l'utilisateur dit "écris ça comme moi", "dans mon ton", "réécris dans ma voix", "fais-moi un post sur X", colle un brouillon à mettre au propre, ou veut produire un contenu à partir d'une idée de ContentOS. Utiliser même si "ton" ou "voix" n'est pas prononcé, dès lors que le texte est censé sortir sous le nom de Manu.
---

# content-os-redaction

Produit du contenu éditorial signé Manu. Le skill porte la **méthode** (creuser, choisir l'angle et le hook, architecturer, relire, mettre en forme). L'**état** vit dans ContentOS : les idées, la voix et les templates d'écriture sont lus via MCP, et le résultat y est reposé.

## Prérequis : le connecteur ContentOS

Ce skill lit et écrit via les tools MCP de ContentOS : `list_ideas`, `list_voices`, `list_writing_templates`, `create_post` (et `get_post`, `edit_post`, `set_post_status` au besoin). Si le connecteur n'est pas disponible, le signaler à Manu avant de produire.

## Principe d'architecture

Briques modulaires, chacune fait une seule chose. La **spécificité de format** (architecture d'un post-thèse, mécaniques de hook valides, règle de chute, longueur) ne vit pas dans le skill : elle est portée par le `writing-template` correspondant dans ContentOS. Les briques restent neutres et sont paramétrées par le template chargé.

## Comment utiliser ce skill

### Étape 1 : l'idée et son brief

Identifier l'idée à traiter. Si elle vient de ContentOS, la charger via `list_ideas`. Le brief est requis pour produire : s'il manque, appliquer `production/creuser-sujet.md` ou demander la matière à Manu.

### Étape 2 : charger la voix et le template

- `list_voices` → la voix de Manu. Elle reste en arrière-plan pendant toute la production et toutes les relectures.
- `list_writing_templates` → le template du type de contenu visé (ex. « Post-thèse LinkedIn »). Le template porte l'architecture, les mécaniques de hook valides, la règle de chute, la longueur et un exemple calibré. Si le type n'est pas clair, le demander brièvement à Manu.

### Étape 3 : dérouler la séquence (paramétrée par le template)

1. `production/creuser-sujet.md` — si le brief est mince.
2. `production/choisir-angle.md` — proposer 3-5 angles, argumenter le plus fort.
3. `production/choisir-hook.md` — avec les mécaniques que le template déclare valides.
4. `production/architecturer-narration.md` — selon l'architecture du template.
5. Rédiger en s'appuyant sur la voix chargée.
6. `relecture/relire-tension-narrative.md`, puis `relecture/relire-voix.md`, puis `relecture/relire-logique.md`.
7. `production/mettre-en-forme-linkedin.md`.

Soumettre à Manu pour validation **dans le chat** à chaque étape charnière. Ne pas livrer un post entier d'un coup sans validation intermédiaire — c'est l'erreur qui produit du texte « bien écrit mais pas lui ».

### Étape 4 : pousser le draft

`create_post` avec `ideaId`, `content`, `writingTemplateId` (celui chargé) et statut `draft`. Manu valide, planifie ou publie ensuite depuis l'UI ContentOS.

## Règle de l'interlocuteur (prioritaire)

Le curseur tutoiement/vouvoiement et le niveau d'affect bougent selon **à qui** Manu parle, surtout en email et WhatsApp. Si le destinataire n'est pas identifiable depuis le contexte, demander avant d'écrire. Par défaut : vouvoiement, registre pro.

## Ne jamais se citer soi-même

Les noms de concepts du skill (« staccato creux », « fil de tension », « contrat de lecture ») servent au raisonnement, pas à la production. Les reformuler en mots vivants au moment d'écrire.

## En cas de doute

- **Quel template ?** Si le type n'est pas clair, demander brièvement.
- **Règle de brique vs règle de template ?** Le template l'emporte (il connaît le format).
- **Situation pas couverte ?** Appliquer la voix seule, vouvoiement par défaut, anti-hype, pas de jargon, et signaler à Manu que la situation mériterait un nouveau template ou une nouvelle brique.
```

- [ ] **Step 2 : commit**

```bash
cd /Users/ManuAVQN/Code/content-os-skills
git add content-os-redaction/SKILL.md
git commit -m "🤖 feat(redaction): SKILL.md — orchestration générique branchée sur ContentOS"
```

### Task 6 : écrire les bricks de production manquantes

**Files:**
- Create: `content-os-redaction/production/creuser-sujet.md`
- Create: `content-os-redaction/production/choisir-angle.md`
- Create: `content-os-redaction/production/mettre-en-forme-linkedin.md`

- [ ] **Step 1 : `creuser-sujet.md`**

Brique neutre. Objet : transformer une idée mince ou un brief partiel en matière exploitable. Sections à écrire :
- Principe : on ne rédige pas à partir d'un titre ; on creuse d'abord pour avoir de la matière concrète (vécu, exemples, chiffres, formules de Manu).
- Méthode : lire le brief de l'idée ; si insuffisant, demander à Manu un flux libre (oral/écrit) sur le sujet, puis restituer un **transcript structuré** qui conserve ses formulations (modèle : la matière AVQN — réflexion en flux restructurée sans lisser la voix).
- Sortie : une matière de fond avec les formules à conserver telles quelles et 3-5 angles latents.
- Vérification : assez de concret pour étayer une thèse sans inventer de faits.

- [ ] **Step 2 : `choisir-angle.md`**

Brique neutre. Objet : choisir l'angle d'un contenu parmi plusieurs possibles. Sections :
- Principe : un sujet contient plusieurs posts ; choisir **un** angle, pas tout dire.
- Méthode : proposer 3-5 angles, chacun avec sa **tension propre** (ce qu'il fait espérer au lecteur), puis argumenter le plus puissant pour le format visé. Exemple de palette d'angles sur un même sujet : origine du nom / retour d'expérience personnel / projection dans le futur / éloge à contrepoint / application concrète.
- Anti-pattern : l'angle « fourre-tout » qui veut tout couvrir et ne tient aucune tension.
- Sortie : un angle retenu, formulé en une phrase, avec sa tension.

- [ ] **Step 3 : `mettre-en-forme-linkedin.md`**

Brique neutre (mise en forme, pas écriture). Objet : la forme LinkedIn. Sections :
- Paragraphes courts et aérés (1 à 3 phrases), une idée principale par paragraphe, séparés par une ligne blanche, pour la lecture mobile.
- Le hook se mesure au **read-more** : les 2-3 premières lignes doivent porter la tension avant la troncature.
- Hashtags : 2 à 4, sobres, thématiques, en fin de post. Pas d'empilement.
- Emojis : pas dans le corps. Note : les contraintes chiffrées précises (longueur, nombre de hashtags) viennent du writing-template du format ; cette brique porte les principes de forme.

- [ ] **Step 4 : commit**

```bash
cd /Users/ManuAVQN/Code/content-os-skills
git add content-os-redaction/production
git commit -m "🤖 feat(redaction): bricks creuser-sujet, choisir-angle, mettre-en-forme"
```

### Task 7 : écrire les bricks de relecture

**Files:**
- Create: `content-os-redaction/relecture/relire-voix.md`
- Create: `content-os-redaction/relecture/relire-tension-narrative.md`
- Create: `content-os-redaction/relecture/relire-logique.md`

- [ ] **Step 1 : `relire-voix.md`**

Passe de relecture dédiée à la voix. Source : la voix chargée depuis ContentOS + cette checklist générique. À vérifier, un point à la fois :
- Prose nette et déclarative présente.
- **Au moins un** marqueur familier vivant (si le canal s'y prête), **pas plus d'un** dans un texte court.
- Aucun anti-pattern : vocabulaire hustle, jargon marketing, staccato creux (cascades sujet-verbe, triplets adjectivaux, conclusions vides, pivots à effet, parallélisme copywriting, « pas X mais Y » plaqué), mots morts, connecteurs LLM.
- Vivant **au service du sens**, pas pour l'effet.
- Pas de répétition de mot saillant entre corps et conclusion.
- Aucun tiret cadratin.
- Aucune formule-concept du skill remontée telle quelle.
Sortie : liste des écarts + correction proposée pour chacun.

- [ ] **Step 2 : `relire-tension-narrative.md`**

Passe dédiée à la tension. Reprend les « Vérifications avant de rendre » de `architecturer-narration.md`, en passe autonome :
- Contrat de lecture tenu (le hook promet ce que le texte livre).
- Fil de tension : la question implicite du hook reste ouverte jusqu'à la fin du parcours (repérer ce que le hook fait espérer, vérifier que ça n'apparaît pas dans le premier tiers).
- Résolution implicite, non étiquetée (pas de « c'est ça, X »).
- Chute appropriée au format (affirmation pour une thèse, question seulement si exploratoire ; jamais de question d'engagement plaquée après une affirmation forte).
Sortie : diagnostic + correction.

- [ ] **Step 3 : `relire-logique.md`**

Passe dédiée aux faits. À vérifier :
- Toute affirmation chiffrée, datée ou attribuée est exacte (« pendant vingt ans » qui ne tient pas, citation mal attribuée → corriger).
- Les exemples concrets sont vrais et cohérents avec le vécu de Manu.
- Pas d'affirmation invérifiable présentée comme un fait.
Sortie : liste des points douteux à confirmer avec Manu.

- [ ] **Step 4 : commit**

```bash
cd /Users/ManuAVQN/Code/content-os-skills
git add content-os-redaction/relecture
git commit -m "🤖 feat(redaction): bricks de relecture (voix, tension, logique)"
```

### Task 8 : README du dépôt

**Files:**
- Create: `/Users/ManuAVQN/Code/content-os-skills/README.md`

- [ ] **Step 1 : écrire le README**

Contenu : but du dépôt (les skills agents de ContentOS) ; le skill `content-os-redaction` (rôle, prérequis = connecteur MCP ContentOS configuré) ; comment l'installer comme skill Claude ; rappel de la frontière (le skill porte la méthode, ContentOS porte l'état) ; lien vers le spec 20 du dépôt `content-os`.

- [ ] **Step 2 : commit**

```bash
cd /Users/ManuAVQN/Code/content-os-skills
git add README.md && git commit -m "🤖 docs: README content-os-skills"
```

---

## Phase 4 — Validation de bout en bout (la preuve)

Pas de code : un run réel qui prouve le modèle. Pré-requis : stack de dev `content-os` lancée (Postgres + Redis + web), `npm run seed:redaction -- manu.avqn@gmail.com` exécuté, token MCP généré (`npm run mcp:token -- manu.avqn@gmail.com`), et le skill `content-os-redaction` installé dans un agent Claude connecté à ce MCP.

### Task 9 : run sur l'idée AVQN

- [ ] **Step 1** : depuis l'agent porteur du skill, demander un post-thèse LinkedIn sur l'idée AVQN. Vérifier que le skill appelle `list_ideas`, `list_voices`, `list_writing_templates` (et non une rédaction côté serveur).
- [ ] **Step 2** : dérouler la production avec validation à chaque étape (angle, hook, architecture).
- [ ] **Step 3** : vérifier que le draft est poussé via `create_post`, rattaché à l'idée AVQN, statut `draft`, visible dans l'UI ContentOS (`/posts`).
- [ ] **Step 4** : contrôler les critères d'acceptation du spec : hook typé, fil de tension tenu, résolution implicite, chute affirmative, voix (prose nette + un marqueur familier), aucun anti-pattern.
- [ ] **Step 5** : noter dans le spec 20 (ou un court compte-rendu) ce que le run a révélé sur la plateforme. **Gate :** ne passer à la phase 5 que si l'acceptation est validée par Manu.

---

## Phase 5 — `content-os` : retrait de `generate_post` et de la clé Anthropic

Ne démarre qu'après validation (phase 4). Le cerveau de rédaction est désormais dans le skill.

### Task 10 : retirer le tool et le worker `generate_post`

**Files:**
- Modify: `src/lib/mcp/tools/posts.ts`
- Modify: `test/integration/mcp-tools-content.test.ts`
- Delete: `src/lib/ai/generate-post.ts`
- Modify: `src/lib/queue/enqueue.ts`, le worker `generate-post` et son enregistrement de file

- [ ] **Step 1 : retirer les tests de `generate_post`**

Supprimer de `test/integration/mcp-tools-content.test.ts` les deux tests `generate_post` et les imports devenus inutiles (`generatePostTool`, `vi`, `createWritingTemplate`, `createVoice` s'ils ne servent plus ailleurs dans le fichier).

- [ ] **Step 2 : retirer le tool et la fonction**

Dans `src/lib/mcp/tools/posts.ts` : supprimer `generatePostTool`, l'enregistrement du tool `generate_post`, le type `GenRun`, `defaultGenRun`, et les imports devenus inutiles (`randomUUID`, `getIdea`, `getVoice`, `listVoices`, `getWritingTemplate`, `awaitJobResult`, `enqueueGeneratePost`).

- [ ] **Step 3 : retirer le worker et la file**

Supprimer `src/lib/ai/generate-post.ts`, le handler de file `generate-post` dans `src/worker/`, `enqueueGeneratePost` dans `src/lib/queue/enqueue.ts`, et toute référence à la file `generate-post`.

- [ ] **Step 4 : lancer les suites, vérifier le vert**

Run : `npm run test:integration && npm run test:unit && npm run test:worker`
Attendu : PASS. Corriger toute référence morte signalée par TypeScript (`npx tsc --noEmit`).

- [ ] **Step 5 : commit**

```bash
npx biome format --write .
git add -A
git commit -m "🤖 refactor(mcp): retire generate_post (la rédaction vit dans le skill agent)"
```

### Task 11 : retirer la clé Anthropic

**Files:**
- Modify: schéma/repo `api-credentials`, UI réglages API keys, et migration Drizzle
- Test: `test/integration/api-keys-action.test.ts`

- [ ] **Step 1 : adapter le test**

Dans `test/integration/api-keys-action.test.ts`, retirer les cas couvrant la clé Anthropic ; garder ceux de Gemini.

- [ ] **Step 2 : retirer l'usage Anthropic**

Retirer le champ Anthropic du formulaire de réglages API keys et toute lecture de la clé Anthropic dans le code (elle n'a plus de consommateur après Task 10). Conserver Gemini.

- [ ] **Step 3 : migration de retrait de colonne**

```bash
npm run db:generate   # génère la migration de drop de la colonne anthropic
```
Vérifier la migration générée, puis `npm run db:migrate`.

- [ ] **Step 4 : suites vertes**

Run : `npm run test:integration -- api-keys && npx tsc --noEmit`
Attendu : PASS.

- [ ] **Step 5 : commit**

```bash
npx biome format --write .
git add -A
git commit -m "🤖 refactor(settings): retire la clé Anthropic (rédaction déléguée à l'agent)"
```

---

## Notes d'exécution

- **Deux dépôts** : phases 1, 2, 5 dans `content-os` ; phase 3 dans `content-os-skills`. `cd` explicite au début de chaque tâche de phase 3.
- **Biome** : lancer `biome format --write` avant chaque commit (le cache local peut masquer des erreurs sinon).
- **DB de test** : `npm run db:test:prepare` avant la première passe d'intégration.
- **Gate phase 4 → 5** : aucun retrait avant validation de la preuve par Manu.
- **Hors périmètre** (chantier 4) : déplacement de la génération d'images / clé Gemini vers media-engine, connecteur MCP distant + OAuth, déclinaisons GPT/Gemini.
```
