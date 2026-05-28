# Nativiser le pipe `/lab-ship` — design

## But

Remplacer les skills `superpowers:*` vendorées par des skills natives en français,
supprimer `/lab-work` (doublon), et simplifier la logique de validation humaine pour
ne garder **qu'un seul gate** : la validation explicite du design en fin de cadrage.

## Motivation

Le pipe `/lab-ship` orchestre aujourd'hui trois skills vendorées en anglais
(`brainstorming`, `writing-plans`, `subagent-driven-development`) issues d'un fork
patché d'`obra/superpowers`. C'est lisible mais hétérogène : noms anglais au milieu
d'un projet français, méta-explications de patch dans chaque SKILL, dépendance à un
upstream qu'on n'incrémente jamais. Et le contrat d'autonomie reste implicite —
l'humain "valide" en répondant aux clarifying questions, sans qu'un design ne lui
soit présenté formellement.

Cible : un pipe natif, francophone, élagué, avec un point de bascule humain unique
et explicite.

## Périmètre

### Skills natives à créer

| Skill | Remplace | Lignes cible | Rôle |
|---|---|---|---|
| `lab-cadrer` | `superpowers/brainstorming` | ~60 | Explorer le contexte, poser les clarifying questions, présenter le design, **demander une validation explicite**, écrire la spec, chaîner sur `lab-planifier`. |
| `lab-planifier` | `superpowers/writing-plans` | ~70 | Écrire le plan d'impl. Aucune interaction humaine. Chaîne sur `lab-implémenter`. |
| `lab-implémenter` | `superpowers/subagent-driven-development` | ~130 | Orchestrer sub-agents avec double revue (spec + code-quality). Aucune interaction humaine. Rend la main à `/lab-ship` étape 6. |

Chaque skill vit dans `.claude/skills/<nom>/SKILL.md`. Les **prompts compagnons**
(reviewers, implementer) restent en anglais et sont copiés tels quels depuis le
fork :

- `lab-planifier/plan-document-reviewer-prompt.md` (49 l)
- `lab-implémenter/implementer-prompt.md` (113 l)
- `lab-implémenter/spec-reviewer-prompt.md` (61 l)
- `lab-implémenter/code-quality-reviewer-prompt.md` (25 l)

### Suppressions

- `.claude/skills/superpowers/` — tout le dossier vendoré + son `README.md` + `LICENSE.upstream`.
- `.claude/skills/lab-work/` — doublon de l'étape 1 de `/lab-ship`. Inliné dans
  `lab-ship` en préservant : vérifier `projects/<projet>/`, créer la branche
  dédiée (`git switch -c work/<projet>-<libellé>`), annoncer la focalisation,
  travailler exclusivement dans `projects/<projet>/`, lire son `CLAUDE.md`.

### Mises à jour

- `.claude/skills/lab-ship/SKILL.md` : remplacer les 3 invocations `superpowers:*` par
  `/lab-cadrer`, `/lab-planifier`, `/lab-implémenter` ; inliner les étapes de
  `/lab-work` ; supprimer la section "Skills superpowers — vendorées et patchées" ;
  reformuler le contrat d'autonomie pour refléter le gate unique (validation
  explicite du design, pas l'implicite "tu réponds = tu valides").
- `CLAUDE.md` racine (ligne 29) : retirer la mention `/lab-work` de la liste des
  utilitaires.

### Hors périmètre

- Autres skills `superpowers:*` non vendorées (`test-driven-development`,
  `systematic-debugging`, etc.) : restent disponibles via le plugin global de Manu.
- `superpowers:using-superpowers` : pas de version native — la skill plugin globale
  suffit.

## Contrat de validation humaine — version cible

**Un seul gate humain dans tout le pipe `/lab-ship` : la fin du cadrage.**

1. **`/lab-cadrer` (interactif)**
   - Explore le contexte projet (silencieux).
   - Pose les clarifying questions, **une à la fois**, idéalement en multiple choice.
   - Présente le design final en un bloc (architecture, composants, flux, tests).
   - **Demande une validation explicite** : « OK avec ce design ? »
   - Sur "go" : écrit la spec dans `docs/superpowers/specs/AAAA-MM-JJ-<sujet>-design.md`,
     commit, et **chaîne directement sur `/lab-planifier`** — pas de relecture de spec,
     pas de menu, pas de "ready?".

2. **`/lab-planifier` (silencieux)**
   - Lit la spec.
   - Produit le plan dans `docs/superpowers/plans/AAAA-MM-JJ-<sujet>.md`, commit.
   - Chaîne directement sur `/lab-implémenter`.

3. **`/lab-implémenter` (silencieux)**
   - Dispatche les sub-agents tâche par tâche.
   - Lance les reviewers (spec puis code-quality) ; boucle interne jusqu'à approbation.
   - Toute ambiguïté résiduelle → tranche par le choix le plus simple, le note
     dans le rapport de fin pour la rubrique "Décidé sans demander".
   - À l'approbation du dernier code reviewer → rend la main à `/lab-ship` étape 6.

4. **`/lab-ship` étape 6 (silencieux)**
   - `git push -u`, attend la CI, vérifie l'URL preview, ouvre la PR.
   - `PushNotification` + message de fin formaté.

Ne s'arrête sur blocage réel que si quelque chose est durablement impossible — auquel
cas remonte à Manu avec un état clair.

## Nouvelle arborescence (cible)

```
.claude/skills/
├── lab-cadrer/SKILL.md
├── lab-planifier/
│   ├── SKILL.md
│   └── plan-document-reviewer-prompt.md
├── lab-implémenter/
│   ├── SKILL.md
│   ├── implementer-prompt.md
│   ├── spec-reviewer-prompt.md
│   └── code-quality-reviewer-prompt.md
├── lab-ship/SKILL.md          (mis à jour)
├── lab-deploy/SKILL.md
├── lab-meta/SKILL.md
├── lab-new/SKILL.md
├── lab-secret/SKILL.md
├── lab-ssh/SKILL.md
└── start/SKILL.md             (RAS)
```

`superpowers/` et `lab-work/` supprimés.

## Principes d'élagage agressif

Pour passer de ~1600 lignes à ~260 (SKILL.md natifs uniquement), couper :

- **Méta-instructions sur la skill elle-même** ("HARD-GATE blocks", "anti-patterns",
  redites sur "what is a skill"). On suppose le lecteur sait.
- **Visual companion** (interactif, hors contrat autonome).
- **Cas hors `/lab-ship`** (réutilisations hypothétiques, fallbacks). Les skills
  vivent dans `/lab-ship`, point.
- **Bandeaux de fork** ("patched from upstream X"). C'est natif maintenant.
- **Redites entre skills** (le contrat d'autonomie est mentionné dans `/lab-ship`,
  les skills filles s'y réfèrent en une ligne).

Garder :

- Le **flow** (diagramme + checklist).
- Les **prompts de sub-agents** intacts (en anglais).
- La **mécanique de double-revue** dans `lab-implémenter` (spec reviewer + code
  quality reviewer). C'est la méthodologie que Manu veut préserver.
- Les chemins de fichiers (specs/plans).

## Risques et limites

- **Perte du cherry-pick upstream.** Assumé : la méthodologie est stable, on n'a
  jamais incrémenté depuis l'adoption initiale.
- **Drift entre les prompts de sub-agents (anglais) et les SKILL.md (français).**
  Les prompts ne contiennent pas de logique de gate humain — risque faible.
- **Renaming en cascade.** Une recherche `superpowers:*` doit revenir vide après
  migration ; un grep `lab-work` aussi.

## Critères d'acceptation

- `.claude/skills/lab-cadrer/`, `lab-planifier/`, `lab-implémenter/` existent avec
  leurs SKILL.md en français et leurs prompts compagnons en anglais.
- `.claude/skills/superpowers/` et `.claude/skills/lab-work/` n'existent plus.
- `lab-ship/SKILL.md` n'invoque plus aucun `superpowers:*` ni `/lab-work` ; il
  invoque `/lab-cadrer` puis chaîne à travers `/lab-planifier` → `/lab-implémenter`.
- `CLAUDE.md` racine ne mentionne plus `/lab-work`.
- `grep -r 'superpowers:' .claude/skills/ CLAUDE.md` ne ramène plus rien.
- `grep -r 'lab-work' .claude/skills/ CLAUDE.md` ne ramène plus rien.
- `lab-cadrer/SKILL.md` contient une étape explicite « demande validation du design ».
- `lab-planifier/SKILL.md` et `lab-implémenter/SKILL.md` mentionnent explicitement
  « aucune interaction humaine ».
- Le chaînage est inscrit dans chaque SKILL.md sortant : `lab-cadrer` invoque
  `/lab-planifier` via le tool `Skill` après commit de la spec ; `lab-planifier`
  invoque `/lab-implémenter` via le tool `Skill` après commit du plan ;
  `lab-implémenter` rend la main à `/lab-ship` (étape 6) après approbation finale.
