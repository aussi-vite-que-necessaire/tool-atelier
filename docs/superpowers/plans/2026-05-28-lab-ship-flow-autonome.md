# `/lab-ship` — flow autonome de feature-work — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Créer la skill `/lab-ship` (flow autonome de feature-work) et la brancher dans `/start` + `CLAUDE.md`, pour réduire le feature-work superpowers à un seul gate humain (les questions de cadrage).

**Architecture:** Trois fichiers de doc/skill. Aucun code, pas de framework de test : la « vérification » de chaque tâche est une commande shell dont on contrôle la sortie. La skill encadre superpowers par instruction (les instructions priment sur les skills) ; superpowers n'est pas modifié.

**Tech Stack:** Markdown (skills, CLAUDE.md), git.

Spec de référence : `docs/superpowers/specs/2026-05-28-lab-ship-flow-autonome-design.md`.

---

## File Structure

| Fichier | Responsabilité | Action |
|---|---|---|
| `.claude/skills/lab-ship/SKILL.md` | Protocole autonome de feature-work | Créer |
| `.claude/skills/start/SKILL.md` | Entrée de session : route vers `/lab-ship` | Modifier (liste d'orientations) |
| `CLAUDE.md` | Doctrine : `/lab-ship` = flow par défaut | Modifier (section « Au démarrage ») |

---

## Task 1 : Créer la skill `/lab-ship`

**Files:**
- Create: `.claude/skills/lab-ship/SKILL.md`

- [ ] **Step 1 : Créer le fichier avec ce contenu exact**

```markdown
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
```

- [ ] **Step 2 : Vérifier le frontmatter et les invariants du corps**

```bash
head -4 .claude/skills/lab-ship/SKILL.md
grep -c "Seule interaction humaine" .claude/skills/lab-ship/SKILL.md
grep -c "Ne merge pas" .claude/skills/lab-ship/SKILL.md
grep -c "PushNotification" .claude/skills/lab-ship/SKILL.md
```

Expected : le frontmatter montre `name: lab-ship` + la `description` ; chacun des trois `grep -c` renvoie `1`.

- [ ] **Step 3 : Commit**

```bash
git add .claude/skills/lab-ship/SKILL.md
git commit -m "🚢 skill /lab-ship : flow autonome de feature-work

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2 : Brancher `/lab-ship` dans `/start`

**Files:**
- Modify: `.claude/skills/start/SKILL.md`

- [ ] **Step 1 : Remplacer la liste d'orientations (les 6 puces numérotées)**

Remplacer ce bloc exact :

```markdown
1. **Bosser sur un projet existant** → `/lab-list`, demande lequel, puis `/lab-work <projet>`.
2. **Créer un projet** → `/lab-new`.
3. **Plomberie de l'atelier** (CLAUDE.md, skills, hooks, scripts, `Atelier.command`) → tu es
   déjà dans une session worktree isolée, travaille directement ici.
4. **Lister les projets** → `/lab-list`.
5. **Infra / plateforme** → gérée **hors de l'atelier** ; les secrets applicatifs, eux, via `/lab-secret`.
6. **Autre** → demande en prose.
```

par :

```markdown
1. **Lancer une tâche (feature-work)** — nouveau projet, évolution d'un projet, ou plomberie de l'atelier → **`/lab-ship`**. Décris l'idée ; il pose la vague de questions de cadrage, puis enchaîne spec → plan → implémentation (sub-agents) → PR prévisualisable **en autonomie**, sans autre validation. `/lab-ship` met en place l'isolation et appelle `/lab-new` (nouveau) ou `/lab-work` (existant) selon le cas.
2. **Lister les projets** → `/lab-list`.
3. **Infra / plateforme** → gérée **hors de l'atelier** ; les secrets applicatifs via `/lab-secret`.
4. **Autre** → demande en prose.
```

- [ ] **Step 2 : Vérifier**

```bash
grep -n "Lancer une tâche (feature-work)" .claude/skills/start/SKILL.md
grep -c "Bosser sur un projet existant" .claude/skills/start/SKILL.md
```

Expected : le premier `grep` renvoie la ligne de la nouvelle option 1 ; le second renvoie `0` (l'ancienne formulation a disparu).

- [ ] **Step 3 : Commit**

```bash
git add .claude/skills/start/SKILL.md
git commit -m "🧭 start: le feature-work route vers /lab-ship

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3 : Pointeur `/lab-ship` dans `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md` (section « Au démarrage »)

- [ ] **Step 1 : Ajouter `/lab-ship` à la liste des skills**

Remplacer ce bloc exact :

```markdown
- **`/start`** — entrée de session : demande quoi faire et oriente.
- **`/lab-list`** — liste les projets + leur état (régénère `PROJECTS.md`).
```

par :

```markdown
- **`/start`** — entrée de session : demande quoi faire et oriente.
- **`/lab-ship`** — flow autonome de feature-work : questions de cadrage, puis spec → plan → implémentation (sub-agents) → PR prévisualisable, sans validation intermédiaire. Orchestre `/lab-new` ou `/lab-work` selon le cas.
- **`/lab-list`** — liste les projets + leur état (régénère `PROJECTS.md`).
```

- [ ] **Step 2 : Ajouter la phrase de cadrage après la liste**

Remplacer ce bloc exact :

```markdown
- **`/lab-deploy`** — déploie le projet courant (preview/prod).

`PROJECTS.md` = carte vivante (projets, stack, état, URL). **Artefact généré (gitignoré), jamais édité à la main** : régénéré au démarrage de chaque session et par `/lab-list`.
```

par :

```markdown
- **`/lab-deploy`** — déploie le projet courant (preview/prod).

Le feature-work passe par **`/lab-ship`** (autonome de bout en bout) ; son seul point d'arrêt humain est la vague de questions de cadrage.

`PROJECTS.md` = carte vivante (projets, stack, état, URL). **Artefact généré (gitignoré), jamais édité à la main** : régénéré au démarrage de chaque session et par `/lab-list`.
```

- [ ] **Step 3 : Vérifier**

```bash
grep -n "lab-ship" CLAUDE.md
```

Expected : deux lignes — l'entrée de liste et la phrase de cadrage.

- [ ] **Step 4 : Commit**

```bash
git add CLAUDE.md
git commit -m "📜 CLAUDE.md: /lab-ship = flow par défaut du feature-work

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage :**
- Composant 1 (skill `/lab-ship`) → Task 1 (contenu intégral du spec). ✓
- Composant 2 (`/start` branché) → Task 2. ✓
- Composant 3 (pointeur `CLAUDE.md`) → Task 3. ✓
- Vérifications du spec (frontmatter, invariants, routage, cohérence doc) → couvertes par les Step de vérif. ✓

**Placeholder scan :** aucun TBD/TODO ; chaque édition montre le texte exact ; chaque vérif a une commande + sortie attendue. (Les `\<…\>` dans le gabarit de message de fin sont du contenu littéral de la skill, pas des placeholders du plan.)

**Type consistency :** nom de skill `lab-ship` constant partout ; chemins de fichiers identiques entre spec, plan et tasks.

**Ordre :** Task 1 (créer la skill) avant 2-3 (qui la référencent), pour que les renvois pointent vers une skill existante.
