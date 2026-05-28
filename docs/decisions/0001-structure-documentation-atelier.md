# ADR-0001 : Structure de documentation de l'atelier

**Statut.** Accepted
**Date.** 2026-05-28

## Contexte

Le dossier `docs/` accumulait deux générations de fichiers : des specs/plans à la racine pour des features livrées (avant qu'on adopte la convention), et la même chose sous `docs/superpowers/{specs,plans,ideas}/`. Le préfixe `superpowers/` n'a plus de sens : on a vendoré le marketplace superpowers et les skills lab-* sont natives au projet. Aucune distinction durable n'existait entre artefacts éphémères (specs/plans d'impl) et artefacts persistants (idées, décisions transverses). Résultat : du bruit, de la dette de contexte, aucune trace claire du pourquoi des choix structurants.

## Décision

`docs/` se découpe en quatre sous-dossiers plats : `specs/`, `plans/`, `ideas/`, `decisions/`. Les specs et plans sont éphémères (utiles pendant l'impl, périmés après merge). Les ideas et decisions sont durables. Les decisions sont numérotées (`NNNN-<sujet>.md`, identité = numéro). Les autres sont préfixés par date. Les ideas et decisions ont chacun un `README.md` qui sert d'index. Capture par skills dédiées : `/lab-adr` pour les décisions, `/lab-idea` pour les idées.

## Conséquences

- Le pourquoi durable des choix structurants se grep dans `docs/decisions/`. L'index donne la vue d'ensemble.
- Les specs et plans déjà mergés peuvent être supprimés sans regret — le code, les commits et les PR portent l'état actuel et son historique.
- Toute décision transverse non capturée en ADR risque d'être perdue. L'invocation de `/lab-adr` reste manuelle : Manu doit y penser.
- Les skills `/lab-cadrer`, `/lab-planifier`, `/lab-implémenter` pointent maintenant sur `docs/specs/` et `docs/plans/` (sans le préfixe `superpowers/`).

## Alternatives écartées

- **Garder `docs/superpowers/` et juste nettoyer le legacy racine.** Le préfixe est trompeur (rien de superpowers dans le contenu) et impose un niveau d'imbrication inutile.
- **Grouper specs et plans par feature sous `docs/work/<sujet>/{design.md,plan.md}`.** Plus rangé visuellement mais ajoute de l'imbrication, et la valeur des specs/plans périmés est faible — pas la peine de les regrouper soigneusement.
- **Format ADR ultra-léger sans index ni statut.** Moins de friction à créer, mais perd la traçabilité des décisions remplacées et la vue d'ensemble.
