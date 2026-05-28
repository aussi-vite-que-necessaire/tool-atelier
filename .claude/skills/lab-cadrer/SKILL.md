---
name: lab-cadrer
description: Phase de cadrage du pipe /lab-ship — explore le contexte projet, pose les clarifying questions à l'humain, présente le design et demande une validation explicite, puis écrit la spec et chaîne sur lab-planifier. Seule skill du pipe qui parle à l'humain.
---

# /lab-cadrer — cadrage + spec

Phase 1 du pipe `/lab-ship`. **Seul gate humain de tout le pipe** : la validation
explicite du design en fin de cadrage.

> Phase 2 (plan) : `/lab-planifier`. Phase 3 (impl) : `/lab-implémenter`.

## Contrat

- **Une seule interaction humaine côté contenu** : les clarifying questions, puis
  la présentation du design avec demande de validation explicite (« OK avec ce
  design ? »).
- **Sur "go"** : écrire la spec, commit, **enchaîner directement** sur
  `/lab-planifier` via le tool `Skill`. Pas de relecture de spec, pas de
  question additionnelle.
- **Sur refus / changements demandés** : ajuster le design, re-présenter, re-demander.
- Aucune autre skill du pipe (`/lab-planifier`, `/lab-implémenter`) ne parlera à
  l'humain. Toute ambiguïté résiduelle après cadrage est tranchée par le choix le
  plus simple, à noter dans le message de fin de `/lab-ship`.

## Déroulé

1. **Explorer le contexte (silencieux).** Lire les fichiers pertinents, le
   `CLAUDE.md` du projet, les commits récents, la structure. Aucun message à
   l'humain à cette étape sauf pour signaler un blocage.
2. **Clarifying questions, une à la fois.** Utiliser `AskUserQuestion` (multiple
   choice préféré, ouvert si nécessaire). Comprendre : but, contraintes, succès,
   trade-offs.
3. **Présenter le design en un bloc.** Sections : architecture, composants, flux
   de données, gestion d'erreur, tests. Échelle à la taille du sujet (quelques
   phrases pour un petit changement, jusqu'à 200-300 mots par section pour un gros).
   Avant le design, lister 2-3 approches alternatives avec trade-offs et la
   recommandation.
4. **Demander la validation explicite.** « OK avec ce design ? Si oui, j'écris la
   spec et j'enchaîne. »
5. **Sur validation** : écrire la spec dans
   `docs/superpowers/specs/AAAA-MM-JJ-<sujet>-design.md`, échelle adaptée. Commit.
6. **Self-review inline de la spec** : scan placeholders, cohérence interne,
   scope, ambiguïté. Corriger inline. Pas de re-validation humaine.
7. **Chaîner sur `/lab-planifier`** via le tool `Skill`. Annoncer brièvement :
   « Spec écrite. J'enchaîne sur le plan. »

## Principes

- YAGNI ruthlessly : retirer les features non demandées.
- Décomposer en unités à responsabilité claire si la tâche est non triviale.
- Suivre les patterns existants du codebase ; ne pas refactorer ce qui ne sert
  pas l'objectif.
- Spec scalable : quelques phrases pour un changement trivial, plus pour un gros
  morceau.
