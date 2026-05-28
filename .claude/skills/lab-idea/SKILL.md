---
name: lab-idea
description: Capturer une idée / piste d'amélioration en backlog d'exploration. À utiliser quand une discussion produit une piste qu'on n'a pas le temps ou la pertinence de traiter maintenant, mais qu'on veut conserver pour plus tard. Une idée a un déclencheur explicite (« quand 2 projets utilisent X »).
---

# /lab-idea — capturer une piste en backlog

Une idée est une **piste non priorisée** : on note pourquoi on n'y va pas
maintenant et le déclencheur qui ferait y revenir. Différent d'une ADR (décision
prise) et différent d'une spec (engagement d'impl).

## Contrat

- Format léger : préfixe-date `YYYY-MM-DD-<sujet-kebab>.md`.
- L'index `docs/ideas/README.md` est maintenu par cette skill.
- Statut évolue : `À explorer` → `En cours` → `Réalisée (PR #N)` ou `Abandonnée`.

## Déroulé

1. **Poser 4 questions** (une à la fois, `AskUserQuestion` quand possible) :
   - **Contexte.** Quel est l'état actuel, ce qui a fait surgir la pensée.
   - **L'idée.** En 2-4 phrases, qu'est-ce qu'on imagine.
   - **Tradeoffs.** Gains, coûts, inconnues, risques.
   - **Quand y revenir.** Déclencheur concret (« quand 2 projets utilisent X »,
     « quand on atteint Y », « jamais sauf si on rencontre Z »).

2. **Écrire le fichier** `docs/ideas/YYYY-MM-DD-<sujet-kebab>.md` avec ce
   gabarit :

   ```md
   # <Titre>

   **Date.** AAAA-MM-JJ
   **Statut.** À explorer

   ## Contexte
   <état actuel, déclencheur de la pensée>

   ## L'idée
   <2-4 phrases>

   ## Tradeoffs
   <bullets>

   ## Quand y revenir
   <déclencheur explicite>
   ```

3. **Mettre à jour l'index** `docs/ideas/README.md` : ajouter une ligne dans la
   section « Idées » :
   ```
   - [<titre>](AAAA-MM-JJ-<sujet>.md) — <statut> — <pitch en une ligne>.
   ```

4. **Commit** avec message `💡 idée : <titre>`.

## Quand une idée évolue

- **Priorisée pour impl.** L'idée garde sa place dans `ideas/` ; une spec est
  créée séparément dans `docs/specs/` via `/lab-cadrer`. Quand la PR est mergée,
  mettre à jour le statut de l'idée à `Réalisée (PR #N)` (à la main ou via une
  prochaine invocation manuelle de cette skill — pas d'automatisation).
- **Abandonnée.** Mettre à jour le statut à `Abandonnée` et noter pourquoi en
  fin de fichier.

## Principes

- Une idée ≠ une TODO. C'est une piste qu'on veut conserver, pas une tâche en
  attente.
- Le déclencheur « quand y revenir » est obligatoire. Sans déclencheur, l'idée
  pourrira dans le dossier.
- Concision : une idée tient sur un écran. Si c'est plus long, c'est qu'elle est
  prête pour une spec, pas pour une idée.
