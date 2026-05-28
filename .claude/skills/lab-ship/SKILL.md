---
name: lab-ship
description: Flow autonome de feature-work sur un projet existant — pose la vague de questions de cadrage, puis enchaîne spec → plan → implémentation (sub-agents) → preview/PR sans validation, et notifie à la fin. Argument requis : le nom du projet.
---

# /lab-ship <projet> — de l'idée à la PR prévisualisable, en autonomie

Flow de bout en bout pour une **feature sur un projet existant**. **Un seul point
d'arrêt humain : la validation explicite du design à la fin du cadrage.**
Ensuite, enchaînement complet sans validation jusqu'à une PR + preview, puis
notification.

> Pour créer un nouveau projet : `/lab-new`.
> Pour la plomberie de l'atelier : `/lab-meta`.

## Contrat d'autonomie

- **Seule interaction humaine du pipe** : les clarifying questions + la
  validation du design en fin de `/lab-cadrer`. Aucune autre validation
  intermédiaire (pas de relecture de spec, pas d'approbation de plan, pas de
  menu de fin).
- **Aucune question d'implémentation après le cadrage.** Toute ambiguïté
  résiduelle → trancher par le choix le plus simple et raisonnable, le noter
  dans le message de fin (rubrique « Décidé sans demander »).
- **Implémentation toujours par sub-agents** via `/lab-implémenter` (double
  revue interne, sans check-in entre tâches).
- **Ne s'arrêter que sur blocage réel** (impossible d'avancer) → remonter à
  Manu avec un état clair. Sinon, avancer.

## Déroulé

1. **Isolation + focalisation.** Vérifier qu'on est dans un worktree isolé,
   jamais sur `main`. Si besoin, créer le worktree (`EnterWorktree`). Vérifier
   que `projects/<projet>/` existe (dossier avec un `Dockerfile`). Créer la
   branche dédiée : `git switch -c work/<projet>-<libellé-court>`. Annoncer la
   focalisation. **Travailler exclusivement dans `projects/<projet>/`** et lire
   son `CLAUDE.md` pour le contexte projet.
2. **Cadrage (seul gate humain).** Invoquer `/lab-cadrer` via le tool `Skill`.
   Cette skill pose les clarifying questions, présente le design, demande la
   validation explicite, écrit la spec et chaîne sur `/lab-planifier`. À partir
   de là, plus d'interaction humaine côté contenu.
3. **Plan (sans gate).** `/lab-planifier` écrit le plan dans
   `docs/plans/AAAA-MM-JJ-<sujet>.md`, commit, et chaîne sur
   `/lab-implémenter`.
4. **Implémentation (sans gate).** `/lab-implémenter` orchestre les sub-agents
   (implementer + spec-reviewer par tâche, code-quality-reviewer final). À
   l'approbation finale, rend la main ici pour l'étape 5.
5. **Preview + PR.** `git push -u origin <branche>` → preview
   `https://<projet>-<branche>.preview.contentos.ch`. Suivre la CI
   (`gh run watch "$(gh run list -L1 --json databaseId -q '.[0].databaseId')" --exit-status`),
   puis `curl` l'URL preview pour vérifier qu'elle répond. Ouvrir la PR
   (`gh pr create --fill` ou titre/desc soignés). **Ne pas merger** : la prod
   reste la décision de Manu après test.
6. **Notifier.** `PushNotification` (titre « <sujet> : PR prête à prévisualiser »)
   **puis** le message de fin formaté ci-dessous.

## Message de fin — gabarit fixe

> **✅ \<titre en une ligne\>**
>
> **Preview** · \<url\>  ·  **PR** · #\<n\>
>
> **Fait**
> - \<puce\>
> - \<puce\>
>
> **Décidé sans demander** (si applicable)
> - \<puce\>
>
> **À toi** : tester la preview, puis merger la PR si ok.
