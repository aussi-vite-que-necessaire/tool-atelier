# ContentOS — Direction : un OS pour agents

Date : 2026-05-25
Statut : direction validée (north star). Chaque chantier qui en découle a son propre spec + plan.

## Vision

ContentOS est une **plateforme SaaS qui détient l'état et expose ses capacités comme des tools**, agnostique à l'écosystème d'agents. L'utilisateur gère toute sa communication réseaux sociaux de bout en bout depuis son interface de chat préférée — Claude, GPT, Gemini ou autre — via des skills qu'il installe dans son agent, plus une UI de contrôle dans ContentOS.

Le principe fondateur tient dans le mot « OS » : un système d'exploitation ne fait pas le travail, il gère les ressources et les expose par une API stable ; les applications travaillent par-dessus. Ici :

- **Le cerveau vit dehors** : la rédaction et l'idéation sont assurées par des agents/skills externes, interchangeables.
- **L'état et le contrôle vivent dans la plateforme** : idées, posts, médias, calendrier, marque, connexions sociales. L'humain garde le dernier mot via l'UI.
- **Les capacités sont exposées comme des tools** : MCP comme socle, déclinable en connecteurs OAuth et en emballages par écosystème.

Ce modèle laisse la porte ouverte à un futur mode « clé-en-main » intégré : il suffirait d'ajouter un agent tournant *à l'intérieur* de la plateforme et consommant les mêmes tools, sans rien réécrire.

## Architecture : trois couches

```
┌───────────────────────────────────────────────────────────────┐
│  AGENTS — le cerveau, dehors                                    │
│  Skill Claude · GPT · Gemini gem (interchangeables)             │
│  rédigent, idéent, orchestrent                                  │
└───────────────┬───────────────────────────────────────────────┘
                │  tools  (MCP / connecteur OAuth)
┌───────────────▼───────────────────────────────────────────────┐
│  CONTENT-OS — la plateforme : l'état + l'UI + les tools         │
│  idées · posts · galerie & templates de marque · calendrier ·   │
│  marque · voix & writing-templates · connexions · publication   │
│  L'humain garde le contrôle via l'UI. Multi-plateformes.        │
└───────────────┬───────────────────────────────────────────────┘
                │  contrat média  (generate / edit / render-html)
┌───────────────▼───────────────────────────────────────────────┐
│  MEDIA-ENGINE (ex-Media Manager) — calcul brut, sans état       │
│  Gemini · HTML→PNG (Cloudflare). Partagé, réutilisable.         │
└───────────────────────────────────────────────────────────────┘
```

### content-os — la plateforme

Dépôt SaaS (Next.js + Postgres + BullMQ + R2). Possède **l'état métier et les règles**, l'UI de contrôle humain, et la surface de tools. C'est le seul interlocuteur de l'agent.

Détient : idées, posts, médias (galerie + métadonnées + lien média↔post), templates visuels de marque (HTML/CSS + schéma de variables), styles visuels, voix éditoriales, writing-templates, marque, connexions sociales, publications et calendrier.

### media-engine — le moteur média

Micro-service Cloudflare Workers (issu de Media Manager). Ne possède **rien de métier et reste template-agnostique** : on lui envoie un prompt ou du HTML déjà fini, il rend des pixels et renvoie une URL permanente. Stateless, réutilisable hors ContentOS (Outline, slides). ContentOS l'appelle en interne ; la galerie et les templates de marque restent côté plateforme.

Il porte la clé Gemini (unique pour le moment) et s'authentifie auprès de ses appelants par une **API key de service unique**. La stack reste interne ; ce modèle d'auth s'enrichira si d'autres projets viennent consommer le moteur.

### content-os-skills — la couche agents

Dépôt de skills/connecteurs. Ne possède **aucun état** : ce sont des instructions + une config qui apprennent à un agent à se servir des tools de la plateforme. Livré et versionné côté produit, non forké par le client : la personnalisation du client passe par l'état dans ContentOS, pas par l'édition du skill.

## Contrats entre couches

- **content-os possède l'état et les règles.** Surface unique pour l'agent.
- **media-engine ne possède rien de métier et reste template-agnostique.** Contrat : `generate` (prompt → image), `edit` (image + prompt → variante), `render-html` (HTML déjà fini → image). ContentOS compile lui-même ses templates de marque en HTML et n'envoie au moteur que ce HTML ; le moteur ne connaît ni Handlebars ni variables. Entrée/sortie = données + URL.
- **content-os-skills ne possède aucun état.** Le skill lit l'état via les tools, applique sa procédure, et réécrit le résultat via les tools.

Règle de répartition, valable partout : **tout ce qui varie d'un client à l'autre vit dans l'OS ; tout ce qui est procédure identique pour tous vit dans le skill ; tout ce qui est calcul brut sans état vit dans le moteur média.**

## Frontière IA : ce qui vit où

L'« IA dehors » s'applique de façon asymétrique selon la nature de la capacité :

- **La rédaction est du cerveau → elle vit dans le skill.** Le skill lit idée + brief + voix + writing-template via les tools, rédige dans son propre contexte (assemblage du prompt, write → polish → lint, appel LLM), puis pousse le draft via `create_post` / `edit_post` / `set_post_status`. La plateforme ne fait aucun appel LLM de rédaction et n'a pas besoin de clé Anthropic ; le coût de rédaction passe sur l'abonnement chat de l'utilisateur.

- **La génération d'images est un périphérique → elle reste une capacité de la plateforme**, dont le calcul est délégué au media-engine. L'agent appelle un tool ContentOS (`generate_image`, `edit_image`, `render_visual`) ; ContentOS appelle le moteur en interne et possède la galerie. Pour un template de marque, ContentOS compile le HTML puis envoie ce HTML fini au moteur pour le rendu pixel. La clé Gemini vit dans le media-engine.

- **La config éditoriale est de la donnée client → elle vit dans la plateforme.** Voix et writing-templates restent des entités de ContentOS, éditables dans l'UI, lues par le skill via les tools et appliquées par lui. Elles sont ainsi réutilisables par n'importe quel écosystème d'agent — c'est ce qui rend les agents réellement interchangeables.

## Surface de tools & multi-écosystème

MCP est le socle universel. Le chemin de productisation :

1. MCP local par token (état actuel).
2. **MCP distant + OAuth = un connecteur installable** par l'utilisateur dans son agent.
3. Déclinaisons fines par écosystème (skill Claude, action GPT, gem Gemini) : de simples emballages d'instructions par-dessus le même MCP.

## Topologie de code

Ombrelle produit « ContentOS » sur **trois dépôts indépendants**, déployés séparément :

- `content-os` — la plateforme SaaS.
- `media-engine` — le moteur média (ex-Media Manager).
- `content-os-skills` — les skills/connecteurs agents.

Le coût assumé : quelques contrats/types à garder synchronisés à la main entre dépôts. Un passage en monorepo n'est justifié que si ces contrats grossissent ; ils restent petits pour l'instant.

## Feuille de route (séquencement)

Chaque item est un chantier avec son propre spec + plan.

1. **Figer cette direction** (ce document).
2. **Premier skill = la preuve du modèle** : un skill Claude qui rédige via les tools (lit idée/brief/voix/template, rédige, pousse le draft). Il valide « cerveau dehors » et précise ce qui peut être retiré de la plateforme.
3. **Retirer la rédaction in-app** une fois le skill prouvé : suppression de `generate_post` côté serveur, du worker `generate-post` et de la clé Anthropic. Voix et writing-templates restent.
4. **Brancher le contrat média** : les workers image de ContentOS appellent media-engine au lieu d'embarquer Puppeteer + Gemini.
5. **Productiser la surface** : MCP distant + OAuth (connecteur), puis déclinaisons GPT/Gemini.
6. **Multi-plateformes sociales** au-delà de LinkedIn.
