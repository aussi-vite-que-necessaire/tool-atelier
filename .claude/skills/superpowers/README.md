# superpowers (vendored fork)

Fork local sélectif de [obra/superpowers](https://github.com/obra/superpowers),
**v5.1.0** (commit `f2cbfbe`, mai 2026). Licence upstream MIT — voir `LICENSE.upstream`.

## Pourquoi un fork

`superpowers` est conçu pour un flow **avec validation humaine intermédiaire** (gates
d'approbation après design, après spec, menu de fin de branche). Le rail `/lab-ship` de
l'atelier vise un flow **autonome** : *un seul* point d'arrêt humain — la vague de questions
de cadrage — puis enchaînement spec → plan → implémentation → PR sans pause. Les patches
ci-dessous suppriment les gates incompatibles, sans toucher au reste (TDD, sub-agents,
deux revues, etc.).

## Skills vendorées

- `brainstorming/` — exploration + clarifying questions + spec
- `writing-plans/` — plan d'implémentation détaillé
- `subagent-driven-development/` — exécution par sub-agents avec deux revues
- `using-superpowers/` — pattern d'invocation (référencé par les autres, non patché)

Les noms (`name:` du front-matter) sont **inchangés**, donc les références internes
`superpowers:xxx` continuent de fonctionner sans modification.

## Patches appliqués

### `brainstorming`
- Bloc `<HARD-GATE>` supprimé.
- Checklist item 5 « get user approval after each section » → présenter le design d'un bloc.
- Checklist item 8 « User reviews written spec » et section *User Review Gate* supprimés.
- Diagramme *Process Flow* : diamonds `User approves design?` et `User reviews spec?` retirés.
- Section *Visual Companion* supprimée (interactif, non pertinent en autonomie).

### `writing-plans`
- Section *Execution Handoff* : menu « Which approach? » supprimé → enchaîne direct
  sur `subagent-driven-development`.

### `subagent-driven-development`
- Dernière étape du diagramme `Use superpowers:finishing-a-development-branch` →
  rend la main au contrôleur `/lab-ship` (étape 6 : push + PR).
- Section *Integration* : mention de `finishing-a-development-branch` retirée.

### `using-superpowers`
- Non patché.

## Mise à jour upstream

Pour remonter à une nouvelle version :

```sh
git clone --depth 1 https://github.com/obra/superpowers /tmp/superpowers
diff -ru /tmp/superpowers/skills/brainstorming .claude/skills/superpowers/brainstorming
# ... répéter par skill, ré-appliquer les patches au besoin.
```

Aucune tooling de subtree/submodule : c'est un vendoring à la main, assumé.
