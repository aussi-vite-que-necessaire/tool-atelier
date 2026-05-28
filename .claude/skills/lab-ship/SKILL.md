---
name: lab-ship
description: Flow autonome de feature-work sur un projet existant — pose la vague de questions de cadrage, puis enchaîne spec → plan → implémentation (sub-agents) → preview/PR sans validation, et notifie à la fin. Argument requis : le nom du projet.
---

# /lab-ship <projet> — de l'idée à la PR prévisualisable, en autonomie

Flow de bout en bout pour une **feature sur un projet existant**. **Un seul point d'arrêt humain : la vague de questions de cadrage.** Ensuite, enchaînement complet sans validation jusqu'à une PR + preview, puis notification.

> Pour créer un nouveau projet : `/lab-new`.
> Pour la plomberie de l'atelier : `/lab-meta`.

## Skills superpowers — vendorées et patchées

Les skills `superpowers:*` invoquées ici sont **vendorées localement** dans
`.claude/skills/superpowers/` (fork de [obra/superpowers](https://github.com/obra/superpowers)
v5.1.0, patché pour retirer les gates humains intermédiaires — voir
`.claude/skills/superpowers/README.md`). Les noms sont inchangés : `superpowers:brainstorming`,
`superpowers:writing-plans`, `superpowers:subagent-driven-development`,
`superpowers:using-superpowers`. **`finishing-a-development-branch` n'est pas vendorée** : son
rôle (menu merge/PR/keep/discard) est remplacé par l'étape 6 ci-dessous (push direct + PR).

## Contrat d'autonomie

Les skills vendorées ont déjà été patchées pour s'aligner sur ce contrat. Il reste néanmoins
la référence si un sub-agent essaie d'introduire un gate non prévu :

- **Seule interaction humaine : les questions de cadrage** (la phase « clarifying questions » de brainstorming, telle quelle — Manu l'apprécie). Une fois les réponses obtenues : **aucune** validation de design, de spec, de plan, ni de menu de fin.
- **Jamais de question d'implémentation.** Toute ambiguïté résiduelle → trancher par le choix le plus simple et raisonnable, **et le noter** dans le message de fin (rubrique « Décidé sans demander »).
- **Implémentation toujours sous-traitée** à des sub-agents via `superpowers:subagent-driven-development`, sans check-in entre les tâches. Les questions inter-agents (sub-agent → controller) sont résolues par le controller sans remonter à Manu.
- **Ne s'arrêter que sur blocage réel** (tâche durablement impossible, ou ambiguïté qui empêche vraiment d'avancer) → alors seulement, remonter à Manu. Sinon, avancer.

## Déroulé

1. **Isolation + focalisation.** Si la session n'est pas déjà dans un worktree isolé, en créer un (`EnterWorktree`). Jamais sur `main`. Puis invoque `/lab-work <projet>` pour créer la branche dédiée et focaliser sur le dossier projet.
2. **Cadrage (seul gate).** Invoque `superpowers:brainstorming` pour explorer le contexte et poser la vague de questions de clarification. **Arrête-toi là côté humain** : dès les réponses obtenues, le contrat d'autonomie ci-dessus prend le relais — ne présente pas le design pour approbation, ne demande pas de relecture de spec.
3. **Spec (sans gate).** Écris le design (informé par les réponses) dans `docs/superpowers/specs/AAAA-MM-JJ-<sujet>-design.md`. Commit. Échelle la spec à la taille de la tâche (quelques phrases pour un petit changement).
4. **Plan (sans gate).** `superpowers:writing-plans` → `docs/superpowers/plans/AAAA-MM-JJ-<sujet>.md`. Commit.
5. **Implémentation.** `superpowers:subagent-driven-development` : un sub-agent par tâche, revues spec/qualité internes, sans pause humaine. À la fin (dernier code reviewer approuvé), le contrôle revient à `/lab-ship` pour l'étape 6 — **ne pas** invoquer `finishing-a-development-branch`.
6. **Preview + PR.** `git push -u origin <branche>` → preview `https://<projet>-<branche>.lab.avqn.ch`. Suis la CI (`gh run watch "$(gh run list -L1 --json databaseId -q '.[0].databaseId')" --exit-status`), puis `curl` l'URL preview pour vérifier qu'elle répond. Ouvre la PR (`gh pr create --fill` ou titre/desc soignés). **Ne merge pas** : la prod reste la décision de Manu après test.
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
