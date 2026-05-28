---
name: lab-planifier
description: Phase de planification du pipe /lab-ship — lit la spec produite par lab-cadrer, écrit un plan d'implémentation détaillé (tâches bite-sized, TDD, commits fréquents), commit, et chaîne sur lab-implémenter. Aucune interaction humaine.
---

# /lab-planifier — plan d'implémentation

Phase 2 du pipe `/lab-ship`. **Aucune interaction humaine.** Lit la spec écrite
par `/lab-cadrer`, produit le plan, commit, chaîne sur `/lab-implémenter`.

## Contrat

- Pas de questions à l'humain. Toute ambiguïté résiduelle → tranche par le choix
  le plus simple, note-la dans un commentaire en tête du plan.
- Pas de menu d'exécution à la fin : l'exécution est toujours `subagent-driven`
  via `/lab-implémenter`.
- Stop sur blocage durable uniquement (impossible d'avancer). Sinon, continuer.

## Déroulé

1. **Lire la spec.** Dernier fichier dans `docs/superpowers/specs/` (ou path
   fourni par `/lab-cadrer`).
2. **Cartographier les fichiers** : créer/modifier/supprimer, avec leur
   responsabilité. Boundaries claires, petits fichiers focalisés. Suivre les
   patterns existants.
3. **Décomposer en tâches bite-sized** (2-5 min chacune). Une tâche = un
   composant cohérent. Chaque tâche enchaîne des steps : écrire le test → vérifier
   qu'il échoue → implémenter → vérifier qu'il passe → commit.
4. **Écrire chaque step en plein** : code complet, commandes exactes, sortie
   attendue. **Aucun placeholder** ("TODO", "implement later", "similar to Task N").
   Si une tâche change du code, le code apparaît dans le step.
5. **Écrire le plan** dans `docs/superpowers/plans/AAAA-MM-JJ-<sujet>.md` avec
   l'en-tête standard :

   ```
   # <Feature> — Plan d'implémentation

   > **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

   **Goal:** ...
   **Architecture:** ...
   **Tech Stack:** ...

   Spec de référence : `docs/superpowers/specs/<spec>.md`.
   ```

6. **Self-review du plan** (inline) : couverture de la spec, scan placeholders,
   cohérence des types/signatures entre tâches. Fixer inline.
7. **Dispatcher le reviewer** (sub-agent, prompt anglais inchangé) :
   `Agent` avec `subagent_type: general-purpose`, prompt =
   contenu de `plan-document-reviewer-prompt.md` + le plan en input. Appliquer
   les changements demandés.
8. **Commit** le plan.
9. **Chaîner sur `/lab-implémenter`** via le tool `Skill`.

## Principes

- DRY, YAGNI, TDD, commits fréquents.
- Chaque step est une action courte (2-5 min).
- Les chemins de fichiers sont exacts.
- Le code des steps est complet, pas allusif.
