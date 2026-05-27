---
name: start
description: Routeur de secours de l'atelier (dans claude) — demande à Manu ce qu'il veut faire et l'oriente. À utiliser quand on ouvre claude brut dans le checkout principal ; l'entrée normale est le launcher `lab`.
---

# /start — routeur de secours dans claude

Routeur **de secours** : utilisé quand tu ouvres `claude` brut dans le checkout principal de
l'atelier (l'entrée normale est le launcher `lab` / `Atelier.command`). Les sessions déjà
focalisées sur un projet ne passent pas par ici.

Demande à Manu ce qu'il veut faire (via `AskUserQuestion`), puis oriente :

1. **Bosser sur un projet existant** → `/lab-list`, demande lequel, puis `/lab-work <projet>` (ou rappelle que `lab new <projet> <libellé>` ouvre une session isolée).
2. **Créer un projet** → `/lab-new`.
3. **Plomberie de l'atelier** (CLAUDE.md, skills, hooks) → rappelle d'isoler le travail (`lab meta <libellé>`).
4. **Lister les projets** → `/lab-list`.
5. **Infra / plateforme** → gérée **hors de l'atelier** ; les secrets applicatifs, eux, via `/lab-secret`.
6. **Autre** → demande en prose.

**Règle transverse :** jamais de commit sur `main`. Branche → push = preview ; PR mergée = prod.
