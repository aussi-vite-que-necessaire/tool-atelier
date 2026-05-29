# Décisions structurantes — ADR

Décisions qui contraignent plusieurs features ou qui ne sont attachées à aucune feature précise. Numérotation séquentielle (`NNNN-<sujet>.md`), pas de préfixe-date (l'identité est le numéro).

Capturer une décision : `/lab-adr <sujet>`.

## Décisions

- [ADR-0001](0001-structure-documentation-atelier.md) — Accepted — Structure de documentation de l'atelier (`docs/{specs,plans,ideas,decisions}/`).
- [ADR-0002](0002-comptes-operateur-audience-tenancy.md) — Accepted — Comptes opérateur/audience (`accountType` central) + tenancy locale à chaque outil.
- [ADR-0003](0003-passerelle-mcp-centrale.md) — Accepted — Passerelle MCP centrale (`mcp.contentos.ch`) : un seul MCP public qui fédère les tools de tous les outils, OAuth à la passerelle, backends internes.
