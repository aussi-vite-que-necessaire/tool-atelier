---
name: travailler-infra
description: Travailler sur l'infrastructure de l'atelier lui-même — skills, CLAUDE.md, scripts, hooks, CI. Flow libre. À utiliser pour toute plomberie de l'atelier qui n'est pas du dev de l'app.
---

# /travailler-infra — infrastructure de l'atelier

Travail sur l'atelier lui-même : skills, `CLAUDE.md`, scripts, hooks, CI. **Pas le
dev de l'app** (qui passe par le workflow superpowers).

## Cadre

- **Tu travailles dans ta session isolée**, déjà sur sa propre branche (ton conteneur de
  session). La plomberie se modifie librement ici.
- **Jamais sur main.** Vérifie la branche courante. Si tu es sur `main`, bascule d'abord sur
  une branche dédiée (`git switch -c infra/<sujet>`) avant tout commit.
- **Flow libre.** Petite plomberie souvent exploratoire : discute, modifie, commit, push, PR —
  au rythme de la tâche. Pour un chantier d'infra conséquent, rien n'empêche de passer par le
  workflow superpowers (brainstorm → plan → impl).

## Déroulé

1. **Vérifie la branche.** `git branch --show-current`. Si `main` → bascule sur
   `infra/<sujet>`.
2. **Demande en prose** : « Qu'est-ce qu'on touche dans l'atelier ? »
3. **Avance librement.** Lis, modifie, commit avec des messages clairs.
4. **Push + PR.** Quand c'est prêt : `git push -u origin <branche>` puis ouvre une PR.
