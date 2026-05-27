# Spec 20 — Skill de rédaction : la rédaction passe aux agents

Date : 2026-05-25
Direction : `2026-05-25-direction-os-pour-agents-design.md` (chantier 2 + amorce du chantier 3).

## Objectif

Construire le premier skill agent qui rédige des posts en lisant l'état de ContentOS via MCP et en y reposant le résultat. Ce skill est la preuve du modèle « OS pour agents » : le cerveau (rédaction) vit dans le skill, l'état (voix, format, idée, post) vit dans la plateforme.

Le skill part de la matière éditoriale existante (la voix de Manu, le format post-thèse, la méthode de hook/narration/relecture déjà travaillés), réorganisée selon la frontière de la direction.

## Frontière appliquée

| Élément | Vit dans |
|---|---|
| Voix de Manu (identité, marqueurs, anti-patterns, calibre, avant/après) | entité **`voice`** de ContentOS |
| Format post-thèse : architecture, mécaniques de hook valides, règle de chute, longueur, hashtags, exemple calibré AVQN + making-of | entité **`writing-template`** de ContentOS |
| Matière de fond (AVQN) | **`idea`** de ContentOS (idée + brief) |
| Méthode générique : creuser, choisir l'angle, choisir le hook, architecturer la narration, mettre en forme, relire | **bricks du skill** (agnostiques au client et au format) |
| Orchestration : identifier l'idée, aller chercher voix + template, dérouler la séquence, pousser le draft | **`SKILL.md`** |

Conséquence : les bricks du skill ne contiennent **aucune spécificité de format ni de client**. Toute spécificité post-thèse migre dans le `writing-template`.

## Périmètre

Deux dépôts :

- **`content-os`** (plateforme) : ajouter `create_post`, seeder voix + template + idée, retirer `generate_post` et la clé Anthropic.
- **`content-os-skills`** (nouveau dépôt) : le skill de rédaction réorganisé.

## A. Plateforme `content-os`

### A1. Tool `create_post`

Permet à l'agent de déposer un post qu'il a rédigé. La fonction repo `createPost(userId, { ideaId, content, writingTemplateId?, status? })` existe déjà ; il s'agit d'exposer un tool MCP par-dessus.

Contrat :
- Entrée : `ideaId` (requis — un post est toujours rattaché à une idée), `content` (requis), `writingTemplateId` (optionnel, trace le format utilisé), `status` (optionnel, défaut `draft`).
- Sortie : le post créé.
- Scopé par `userId` comme les autres tools.

TDD : test d'intégration du tool (création scoped, défaut `draft`, rattachement à l'idée, rejet si idée absente).

### A2. Seed de la matière dans ContentOS

Migrer le contenu de `tov.zip` vers des entités ContentOS, pour le compte de Manu :

- **`voice` « Manu »** ← `voix-manu.md` (contenu markdown riche dans le champ `content`).
- **`writing-template` « Post-thèse LinkedIn »** ← parties déclaratives de `post-these-linkedin.md` **et** les variantes post-thèse aujourd'hui en bas de `choisir-hook` et `architecturer-narration`. Réparti sur les champs existants :
  - `structure` : la séquence d'architecture (hook → constat → indice → ancrage → élément → application → chute) + l'exemple calibré AVQN annoté + les points de making-of.
  - `writingRules` : mécaniques de hook valides pour ce format, règle de chute (affirmation), longueur (9-12 paragraphes), hashtags, absence d'emoji dans le corps.
  - `platform` : `linkedin`.
- **`idea` « AVQN »** ← `matiere-avqn.md` (titre + brief).

Seed via un script idempotent dans `scripts/` (reproductible et testable). Pas de changement de schéma : les champs texte libres existants suffisent.

### A3. Retrait de la rédaction in-app

Une fois le skill validé de bout en bout (section C), retirer :
- le tool `generate_post` et `generatePostTool` ;
- le worker et la file `generate-post`, `enqueueGeneratePost` et son `awaitJobResult` ;
- `src/lib/ai/generate-post.ts` ;
- la clé Anthropic : usage, UI réglages, et entrée correspondante dans `api-credentials` (migration de retrait de colonne). La clé Gemini reste (son déplacement est le chantier 4).
- les tests liés à `generate_post`.

## B. Le skill `content-os-skills`

### B1. Dépôt et installation

Nouveau dépôt `content-os-skills`, frère de `content-os` et `media-engine`. Un skill = un dossier (`SKILL.md` + sous-dossiers), installable comme skill Claude. Le README documente l'installation et le prérequis : un connecteur MCP ContentOS configuré dans l'agent.

### B2. Structure

```
content-os-skills/
└── redaction/
    ├── SKILL.md                        → orchestration + intégration ContentOS
    ├── production/
    │   ├── creuser-sujet.md
    │   ├── choisir-angle.md
    │   ├── choisir-hook.md
    │   ├── architecturer-narration.md
    │   └── mettre-en-forme-linkedin.md
    └── relecture/
        ├── relire-voix.md
        ├── relire-tension-narrative.md
        └── relire-logique.md
```

Le skill est renommé (proposition : `content-os-redaction`) pour ne plus entrer en collision avec le nom de la plateforme. La description de déclenchement reste celle, riche, de la base.

### B3. `SKILL.md` — orchestration générique

Le flux, quel que soit le type de contenu :

1. **Identifier l'idée** à traiter (`list_ideas`, ou idée fournie par Manu). Brief requis pour produire.
2. **Charger la voix** (`list_voices` → voix de Manu) et le **writing-template** correspondant au type visé (`list_writing_templates` → « Post-thèse LinkedIn »). Le template porte toute la spécificité de format ; la voix reste en arrière-plan pendant toute la production.
3. **Dérouler la séquence**, paramétrée par le template : creuser → choisir l'angle → choisir le hook (avec les mécaniques que le template déclare valides) → architecturer la narration (selon l'architecture du template) → rédiger (selon la voix) → relire (voix, tension, logique) → mettre en forme. Validation avec Manu **dans le chat** à chaque étape charnière.
4. **Pousser le draft** : `create_post` (`ideaId`, `content`, `writingTemplateId`, statut `draft`). Manu valide / planifie / publie ensuite depuis l'UI ContentOS.

La règle de l'interlocuteur (tutoiement/registre) et la règle « ne jamais se citer soi-même » de la voix restent actives.

### B4. Bricks

- **Production** : `choisir-hook` et `architecturer-narration` repris de la base, **vidés de leurs variantes de format** (déplacées dans le writing-template) ; `creuser-sujet`, `choisir-angle`, `mettre-en-forme-linkedin` écrits, neutres.
- **Relecture** : `relire-voix` (anti-patterns absents, contraste prose nette + un marqueur familier, mots morts), `relire-tension-narrative` (fil de tension, résolution implicite et bien placée, contrat de lecture), `relire-logique` (affirmations factuelles, chiffres, attributions).

Chaque brique fait une seule chose, ne nomme ni Manu ni un format, et lit la voix + le template fournis par l'orchestration.

## C. Validation — la preuve

Sur la stack de dev locale, avec un agent porteur du skill connecté au MCP ContentOS (token via `npm run mcp:token`) :

1. Le skill lit l'idée AVQN + son brief, la voix de Manu et le template post-thèse, tous depuis ContentOS.
2. Il déroule la production et produit un post-thèse.
3. Le draft atterrit dans ContentOS via `create_post`, visible dans l'UI.

Critères d'acceptation :
- Le post respecte les critères de qualité post-thèse (hook typé, fil de tension tenu, résolution implicite, chute affirmative, voix : prose nette + un marqueur familier, aucun anti-pattern).
- Aucun appel LLM côté serveur n'a participé à la rédaction (le cerveau est dans l'agent).
- Le post est bien rattaché à l'idée AVQN, statut `draft`.

Le retrait de `generate_post` (A3) n'intervient qu'après cette validation.

## Ordre de réalisation

1. `content-os` : tool `create_post` (TDD).
2. `content-os` : script de seed (voix Manu, template post-thèse, idée AVQN).
3. `content-os-skills` : dépôt, `SKILL.md` réorienté, bricks repris + écrits.
4. Validation de bout en bout sur AVQN.
5. `content-os` : retrait de `generate_post` et de la clé Anthropic.

## Hors périmètre

- Déplacement de la génération d'images / clé Gemini vers media-engine (chantier 4).
- Connecteur MCP distant + OAuth (chantier 4).
- Déclinaisons GPT / Gemini du skill.
- Autres types de contenu (anecdote, tutoriel, célébration) : nouveaux writing-templates plus tard, sans toucher aux bricks.
