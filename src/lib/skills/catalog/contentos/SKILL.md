---
name: contentos
description: Rédige un post (LinkedIn) de bout en bout à partir d'une matière fournie par l'humain, via les outils MCP de la suite Contentos. Use when the user asks to "rédige-moi un post", veut transformer une idée/matière en post publiable, ou veut un post cadré par un format et une voix. Orchestre le cadrage (format + voix), le plan, la rédaction dans la voix, la mise en page, puis pose le post dans l'outil.
metadata:
  kind: workflow
  domain: suite
  version: 2
  tagline: "Rédiger un post de bout en bout, piloté par l'agent."
  requires_mcp: [contentos]
---

# contentos — rédiger un post

Workflow agentique : transformer une **matière fournie par l'humain** en **post posé dans
l'outil**, prêt à relire/planifier/publier. Toute l'intelligence est ici (agent) ; les outils
MCP de la suite ne stockent et n'exposent que l'état (formats, voix, posts).

**Déclencheur :** l'humain demande un post (« rédige-moi un post ») **en donnant la matière**
(notes, idée, lien, brouillon). Si la matière manque, la demander avant de commencer.

## Outils

Le catalogue des outils MCP de la suite (par domaine) est dans
[references/outils-mcp.md](references/outils-mcp.md). Pour ce workflow, l'essentiel :
`list_publication_formats`, `list_voices`, `create_post`.

## Séquence

Copie cette checklist dans ta réponse et coche au fur et à mesure :

```
Rédaction du post :
- [ ] 1. Cadrer — proposer un format et une voix, l'humain choisit (steps/1-cadrer.md)
- [ ] 2. Plan — bâtir le plan depuis la matière + le format, le faire challenger (steps/2-plan.md)
- [ ] 3. Voix — rédiger selon le plan dans la voix, sans mise en page (steps/3-voix.md)
- [ ] 4. Mise en page — appliquer la cosmétique du format (steps/4-mise-en-page.md)
- [ ] 5. Poser — create_post puis montrer le post à l'humain (steps/5-poser.md)
```

Chaque étape a son fichier. Lis-le **au moment** d'y arriver (divulgation progressive) :

1. **Cadrer** → [steps/1-cadrer.md](steps/1-cadrer.md)
2. **Plan** → [steps/2-plan.md](steps/2-plan.md)
3. **Voix** → [steps/3-voix.md](steps/3-voix.md)
4. **Mise en page** → [steps/4-mise-en-page.md](steps/4-mise-en-page.md)
5. **Poser** → [steps/5-poser.md](steps/5-poser.md)

## Sous-agents

L'étape 2 peut faire **challenger le plan** par des sous-agents critiques (angle éditorial,
marketing…). Le pas de tir est dans [agents/](agents/) — voir
[agents/critique-editoriale.md](agents/critique-editoriale.md). Squelette pour l'instant :
à étoffer par itération.

## Principe

L'agent porte la méthode et le jugement. Les spécificités d'un post (sa **structure**, son
**intention visuelle**, ses **règles d'écriture**) viennent du **format** chargé, pas en dur
ici. Le ton vient de la **voix** chargée. On garde le squelette mince ; on l'enrichit à l'usage.
