# docs/

Quatre dossiers, deux usages :

- **`specs/`** — design d'une feature avant impl, daté (`YYYY-MM-DD-<sujet>-design.md`). Écrit par `/lab-cadrer`. Éphémère : utile pendant l'impl, périmé une fois la PR mergée.
- **`plans/`** — découpage technique d'une spec, daté. Écrit par `/lab-planifier`. Éphémère idem.
- **`ideas/`** — backlog d'exploration (pistes écartées, hypothèses à tester plus tard). Durable. Capturé par `/lab-idea`. Index dans `ideas/README.md`.
- **`decisions/`** — ADR numérotées (`NNNN-<sujet>.md`). Décisions structurantes qui contraignent plusieurs features. Durable. Capturé par `/lab-adr`. Index dans `decisions/README.md`.

Le code, les commits et les PR documentent l'état présent et le pourquoi des changements. Specs et plans servent l'impl en cours ; ideas et decisions vivent dans le temps.
