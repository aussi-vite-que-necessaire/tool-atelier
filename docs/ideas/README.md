# Idées — backlog d'exploration

Pistes capturées pour ne pas les perdre, sans engagement d'implémentation. Chaque fichier suit le gabarit : contexte → l'idée → tradeoffs → quand y revenir.

Capturer une idée : `/lab-idea <sujet>`.

## Idées

- [Mutualiser les tests e2e](2026-05-28-e2e-mutualises.md) — À explorer — Sortir Playwright en projet `e2e/` central quand 2-3 projets l'utilisent.
- [Ressources : séparer admin et public](2026-05-28-ressources-admin-vs-public.md) — À explorer — Restreindre `ressources` à l'admin, extraire le front-end public dans un projet dédié quand on l'ouvre à des visiteurs externes.
- [Palier d'intégration `preview.contentos.ch`](2026-05-29-palier-integration-preview.md) — À explorer — 3ᵉ palier où toute la suite est buildée ensemble, pour tester la passerelle MCP / le SSO / les e2e au niveau suite. Recoupe l'idée e2e.
