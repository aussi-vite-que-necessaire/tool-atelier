---
name: lab-ship
description: Flow autonome de l'idée à la PR prévisualisable — pose la vague de questions de cadrage, puis enchaîne spec → plan → implémentation (sub-agents) → preview/PR sans validation, et notifie à la fin. À utiliser pour tout feature-work de l'atelier (nouveau projet, évolution, plomberie).
---

# /lab-ship — de l'idée à la PR prévisualisable, en autonomie

Flow de bout en bout pour tout feature-work de l'atelier. **Un seul point d'arrêt humain : la vague de questions de cadrage.** Ensuite, enchaînement complet sans validation jusqu'à une PR (+ preview si un projet est déployable), puis notification.

## Contrat d'autonomie — PRIME sur les gates des skills invoquées

Ce contrat **l'emporte** sur les gates de `superpowers:brainstorming`, `writing-plans` et `finishing-a-development-branch` :

- **Seule interaction humaine : les questions de cadrage** (la phase « clarifying questions » de brainstorming, telle quelle — Manu l'apprécie). Une fois les réponses obtenues : **aucune** validation de design, de spec, de plan, ni de menu de fin.
- **Jamais de question d'implémentation.** Toute ambiguïté résiduelle → trancher par le choix le plus simple et raisonnable, **et le noter** dans le message de fin (rubrique « Décidé sans demander »).
- **Implémentation toujours sous-traitée** à des sub-agents via `superpowers:subagent-driven-development`, sans check-in entre les tâches.
- **Ne s'arrêter que sur blocage réel** (tâche durablement impossible, ou ambiguïté qui empêche vraiment d'avancer) → alors seulement, remonter à Manu. Sinon, avancer.

## Déroulé

1. **Isolation.** Si la session n'est pas déjà dans un worktree isolé, en créer un (`EnterWorktree`). Jamais sur `main`. Selon le besoin : nouveau projet → `/lab-new` ; évolution d'un projet existant → `/lab-work <projet>` ; plomberie de l'atelier → worktree seul.
2. **Cadrage (seul gate).** Invoque `superpowers:brainstorming` pour explorer le contexte et poser la vague de questions de clarification. **Arrête-toi là côté humain** : dès les réponses obtenues, le contrat d'autonomie ci-dessus prend le relais — ne présente pas le design pour approbation, ne demande pas de relecture de spec.
3. **Spec (sans gate).** Écris le design (informé par les réponses) dans `docs/superpowers/specs/AAAA-MM-JJ-<sujet>-design.md`. Commit. Échelle la spec à la taille de la tâche (quelques phrases pour un petit changement).
4. **Plan (sans gate).** `superpowers:writing-plans` → `docs/superpowers/plans/AAAA-MM-JJ-<sujet>.md`. Commit.
5. **Implémentation.** `superpowers:subagent-driven-development` : un sub-agent par tâche, revues spec/qualité internes, sans pause humaine.
6. **Preview + PR.** `git push -u origin <branche>` → preview `https://<projet>-<branche>.lab.avqn.ch`. Suis la CI (`gh run watch "$(gh run list -L1 --json databaseId -q '.[0].databaseId')" --exit-status`), puis `curl` l'URL preview pour vérifier qu'elle répond. Ouvre la PR (`gh pr create --fill` ou titre/desc soignés). **Ne merge pas** : la prod reste la décision de Manu après test.
   - **Plomberie sans projet déployable** (skills, CLAUDE.md, scripts) : pas de preview — l'étape s'arrête à la PR.
7. **Notifie.** `PushNotification` (titre « <sujet> : PR prête à prévisualiser ») **puis** le message de fin formaté ci-dessous.

## Message de fin — gabarit fixe

Termine toujours par ce récap minimal et formaté (pour retrouver le contexte d'un coup d'œil quand plusieurs tâches tournent en parallèle) :

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

Pour la plomberie : remplacer la ligne « Preview · … » par « _pas de preview — plomberie_ ».
