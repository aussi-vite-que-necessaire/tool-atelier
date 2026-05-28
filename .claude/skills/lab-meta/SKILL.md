---
name: lab-meta
description: Travail méta sur l'atelier lui-même — modifier les skills, CLAUDE.md, scripts, hooks, lanceur. Flow libre (pas de rail spec→plan→impl forcé). À utiliser pour toute plomberie de l'atelier qui n'est ni du dev projet, ni la création d'un nouveau projet.
---

# /lab-meta — plomberie de l'atelier

Travail méta sur l'atelier lui-même : skills, `CLAUDE.md`, scripts, hooks, lanceur. **Pas le
dev d'un projet** (qui passe par `/lab-ship`) ni la création d'un nouveau projet (qui passe par
`/lab-new`).

## Cadre

- **Tu travailles dans le checkout courant** (principal ou worktree). Le hook `branch-guard`
  interdit le dev projet dans le checkout principal partagé mais autorise toute la plomberie
  (skills, CLAUDE.md, scripts, hooks) — c'est précisément le rôle du checkout principal.
- **Jamais sur main.** Vérifie la branche courante. Si tu es sur `main`, arrête : demande à
  Manu de lancer une session isolée (`Atelier.command` ou `claude --worktree`), car le hook
  empêche de basculer de branche dans le checkout principal.
- **Flow libre.** Pas de rail spec→plan→impl forcé : la plomberie est souvent petite et
  exploratoire. Discute, modifie, commit, push, PR — au rythme de la tâche.

## Déroulé

1. **Vérifie la branche.** `git branch --show-current`. Si `main` → stop, oriente vers une
   session isolée.
2. **Demande en prose** : « Qu'est-ce qu'on touche dans l'atelier ? »
3. **Avance librement.** Lis, modifie, commit avec des messages clairs (`git commit -m "..."`).
4. **Push + PR.** Quand c'est prêt : `git push -u origin <branche>` puis `gh pr create --fill`
   (ou titre/desc soignés). Pas de preview — la plomberie n'a pas de projet déployable.
