# `/lab-ship` — flow autonome de feature-work — design

> Spec de design. Date : 2026-05-28.

## Problème

Le feature-work de l'atelier passe par superpowers (brainstorming → writing-plans →
subagent-driven-development → finishing). Très efficace, mais **multi-gates** : après la vague de
questions de cadrage, il demande encore d'approuver le design, de relire la spec, de valider le
plan, puis présente un menu de fin. Manu lance souvent plusieurs tâches en parallèle ; ces
validations répétées cassent le flow et il finit par dire à chaque fois « ne me demande pas de
validation ».

But cible : **un seul point d'arrêt humain — la vague de questions de cadrage** (qu'il apprécie
telle quelle). Ensuite, enchaînement complet en autonomie jusqu'à une PR prévisualisable, puis une
notification + un récap formaté pour retrouver le contexte d'un coup d'œil.

## Principe

superpowers n'est **pas modifié** (skills externes, versionnées dans le plugin cache). On
l'**encadre** par une skill atelier dont le corps est une instruction qui **prime** sur les gates
superpowers (les instructions priment sur les skills). Trois composants :

1. Une skill `/lab-ship` portant le protocole autonome.
2. `/start` qui route tout le feature-work vers `/lab-ship`.
3. Un pointeur dans `CLAUDE.md`.

Périmètre : **tout feature-work** (nouveau projet, évolution, plomberie).

## Composant 1 — skill `.claude/skills/lab-ship/SKILL.md`

Contenu cible :

````markdown
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
````

## Composant 2 — `.claude/skills/start/SKILL.md`

Les anciennes options « bosser / créer / plomberie » convergent vers `/lab-ship`. Liste cible des
orientations :

```markdown
1. **Lancer une tâche (feature-work)** — nouveau projet, évolution d'un projet, ou plomberie de l'atelier → **`/lab-ship`**. Décris l'idée ; il pose la vague de questions de cadrage, puis enchaîne spec → plan → implémentation (sub-agents) → PR prévisualisable **en autonomie**, sans autre validation. `/lab-ship` met en place l'isolation et appelle `/lab-new` (nouveau) ou `/lab-work` (existant) selon le cas.
2. **Lister les projets** → `/lab-list`.
3. **Infra / plateforme** → gérée **hors de l'atelier** ; les secrets applicatifs via `/lab-secret`.
4. **Autre** → demande en prose.
```

Le reste de `/start` (préambule, consigne `AskUserQuestion` / prose en cloud, règle transverse
« jamais de commit sur main ») est inchangé.

## Composant 3 — `CLAUDE.md`

Dans la section « Au démarrage », ajouter `/lab-ship` à la liste des skills (en tête, c'est
l'orchestrateur du feature-work) et une phrase de cadrage :

- Entrée de liste : **`/lab-ship`** — flow autonome de feature-work : questions de cadrage, puis
  spec → plan → implémentation (sub-agents) → PR prévisualisable, sans validation intermédiaire.
  Orchestre `/lab-new` ou `/lab-work` selon le cas.
- Phrase après la liste : « Le feature-work passe par **`/lab-ship`** (autonome de bout en bout) ;
  son seul point d'arrêt humain est la vague de questions de cadrage. »

## Fichiers touchés

| Fichier | Action |
|---|---|
| `.claude/skills/lab-ship/SKILL.md` | Créer (Composant 1) |
| `.claude/skills/start/SKILL.md` | Modifier la liste d'orientations (Composant 2) |
| `CLAUDE.md` | Ajouter `/lab-ship` à la liste + phrase de cadrage (Composant 3) |

## Vérification

1. La skill `/lab-ship` est listée par le système (frontmatter `name`/`description` valides) et
   son corps énonce sans ambiguïté : un seul gate (questions de cadrage), pas de question
   d'implémentation, sous-traitance sub-agents, arrêt à la PR (pas de merge), notif + récap.
2. `/start` route le feature-work vers `/lab-ship` ; les chemins `/lab-new`/`/lab-work` y sont
   mentionnés comme étapes d'isolation pilotées par `/lab-ship`.
3. `CLAUDE.md` mentionne `/lab-ship` comme flow par défaut du feature-work.
4. Cohérence doc (règle Manu) : aucun cadrage par contraste ; texte décrivant l'état cible.

## Hors scope (YAGNI)

- Pas de modification des skills superpowers (externes — on les encadre).
- Pas de merge/prod automatique : la chaîne s'arrête à la PR + preview ; merger reste manuel.
- Pas de mode « batch unique de questions » : on conserve la vague de questions de brainstorming
  telle quelle (Manu l'apprécie).
