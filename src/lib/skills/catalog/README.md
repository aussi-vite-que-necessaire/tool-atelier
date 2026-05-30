# Skills

Source de vérité des skills agentiques de la suite Contentos. Le hub (`/skills`) les liste et
les sert en ZIP versionné. Chaque skill est un dossier conforme au **standard Agent Skills**
(Anthropic) : un `SKILL.md` à frontmatter YAML, plus des fichiers bundlés lus à la demande
(divulgation progressive).

## Skills publiés

| Skill | Type | Domaine | Rôle |
|---|---|---|---|
| [`contentos`](./contentos/) | workflow | suite | Rédiger un post de bout en bout — cadrer (format + voix) → plan → voix → mise en page → poser. |

## Convention

### Frontmatter (source unique)

Les métadonnées vivent **uniquement** dans le frontmatter de `SKILL.md` (pas de `manifest.json`).
`name` et `description` sont les champs **standard** ; les champs propres à l'atelier sont sous
`metadata:`.

```yaml
---
name: contentos                 # [a-z0-9-], ≤64, sans « claude »/« anthropic »
description: Ce que fait le skill ET quand l'utiliser (3e personne, déclencheurs). ≤1024.
metadata:
  kind: workflow                # workflow (orchestre des étapes) | atomic (une chose)
  domain: suite                 # suite | cast | media | ressources
  version: 2                    # entier ; bump à chaque évolution
  tagline: "Phrase courte affichée sur le hub."
  requires_mcp: [contentos]     # outils/serveurs MCP requis (tableau inline)
---
```

Parsé par `src/lib/skills/frontmatter.ts` (mini-parseur maison, zéro dépendance). Un test de
conformité (`test/unit/skills-conformance.test.ts`) vérifie chaque skill du catalogue.

### Arborescence

```
<skill>/
  SKILL.md            # frontmatter + vue d'ensemble + checklist ; corps < 500 lignes
  steps/              # un workflow : une étape par fichier (« sous-skills »), liées depuis SKILL.md
  agents/             # pas de tir sous-agents : critiques/spécialistes dispatchés par le workflow
  references/         # docs lues à la demande (ex. cheat-sheet des outils MCP)
```

Règles (cf. best-practices Anthropic) : références **un seul niveau** depuis `SKILL.md` ;
« concise is key » (ne pas écrire ce que le modèle sait déjà) ; chemins en avant-slash ;
divulgation progressive (charger un fichier seulement au moment utile).

### Skill vs sous-agent

Un **skill** = procédure/instructions chargées dans le contexte de l'agent. Un **sous-agent**
(dans `agents/`) = contexte isolé, prompt/outils propres, pour un raisonnement lourd en
isolation/parallèle. Règle de pouce : *si une étape doit « réfléchir » fort et séparément → un
sous-agent*, sinon → des instructions de skill.

## Versionner

Bumpe `version` dans le frontmatter du skill modifié, mets à jour `tagline`/`description` si
besoin, push. Le ZIP prend automatiquement le nom `<skill>-v<version>.zip`.
