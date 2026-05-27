---
name: creer-une-ressource
description: >
  Crée une ressource (lead magnet / cours) sur la plateforme AVQN via le MCP avqn_res,
  en guidant de l'idée jusqu'à la publication : raffinage du thème, recherche si besoin,
  plan validé, création des pages et modules, image de cover, relecture. À utiliser dès
  qu'on veut concevoir un nouveau cours ou une ressource sur la plateforme. Nécessite le
  MCP avqn_res connecté.
---

# Créer une ressource AVQN

Tu guides la création d'une **ressource** (lead magnet / cours) sur la plateforme AVQN,
de l'idée brute jusqu'à la publication.

Modèle de contenu : une ressource = une arborescence de **pages** ; chaque page = une
suite de **modules** typés (texte, image, code, étapes, comparatif…). Elle est servie sur
`/r/<slug>`. Tu pilotes tout via le **MCP `avqn_res`** — tu ne touches jamais au code du
projet.

Le déroulé est en **4 phases**. Avance phase par phase et **ne crée rien dans le MCP avant
la phase 3**.

## Prérequis — vérifier le MCP

Avant tout, appelle `list_resources` pour vérifier que le MCP `avqn_res` répond.

- Il répond → continue.
- Absent ou en erreur → **arrête-toi** et demande à l'utilisateur de connecter le MCP
  `avqn_res`. Sans lui, ce skill ne peut rien faire.

> Les outils sont nommés ici par leur nom logique (`create_resource`, `add_page`…). Selon
> la connexion, ils peuvent être préfixés (ex. `avqn_res.create_resource`) — utilise le
> nom tel qu'il apparaît dans tes outils MCP.

## Phase 1 — Thème & raffinage

Pars de l'idée fournie. Si elle est floue ou trop large, c'est ton rôle de la cadrer.

**Questionne une chose à la fois** avec l'outil natif `AskUserQuestion` (questions à choix
multiples de préférence). Couvre, dans l'ordre, ce qui n'est pas déjà clair :

1. **Public visé** — à qui s'adresse la ressource, quel niveau.
2. **Promesse** — que sait faire le lecteur à la fin ? Quelle action espérée ensuite
   (c'est un lead magnet) ?
3. **Périmètre** — survol rapide vs guide complet ; ce qu'on inclut / exclut.
4. **Format** — cours **multi-pages** ou **article en page unique**.
5. **Ton** — registre, tutoiement/vouvoiement, niveau de technicité.

Règles :

- **Propose, ne te contente pas de demander.** Suggère des angles, un découpage, des
  exemples concrets que l'utilisateur peut valider ou corriger.
- **Recherche si besoin.** Si l'idée demande des faits, un état de l'art ou des références
  à jour, utilise `WebSearch` / `WebFetch` et appuie tes suggestions sur ce que tu trouves.
- Ne passe à la phase 2 que quand le thème, le public et le format sont clairs.

## Phase 2 — Plan high-level (dans le chat, sans rien créer)

Rédige un plan **dans la conversation**, sans appeler aucun outil de création. Format :

- **Titre** + **slug** proposé (court, en-tete-avec-tirets) + **description** (1–2 phrases).
- **Public** visé (rappel).
- **Arborescence des pages** — la hiérarchie, du plus général au détail.
- **Pour chaque page** : les modules envisagés (par type), dans l'ordre. Voir
  `references/modules.md` pour choisir les bons types.
- **Cover** : la piste visuelle (sujet / style de l'image).

Puis **demande validation explicite** du plan. Tant qu'il n'est pas validé, ajuste et
re-propose. Ne crée rien.

## Phase 3 — Création

Une fois le plan validé, dernières questions ciblées si nécessaire (`AskUserQuestion`),
puis crée la ressource via le MCP. Détails des outils dans `references/outils-mcp.md`,
shape exacte des modules dans `references/modules.md`.

**Choisis la stratégie selon la taille :**

- **Petite/moyenne ressource** (jusqu'à ~3 pages, modules raisonnables) → un seul
  `create_resource` portant tout l'arbre (`rootModules` + `pages[]` imbriquées).
- **Grosse ressource** → `create_resource` pour la **coquille** (titre + page racine
  légère), puis **une page à la fois** : un appel `add_page` (avec ses modules) par page.
  Évite les payloads géants.

**Réglages par défaut à la création :**

- `published: false` — on crée en **brouillon**. La publication se décide en phase 4.
- `visibility: "public"` sauf si l'utilisateur veut une ressource privée (accès par email
  via `grant_access`). L'accès reste de toute façon gaté par OTP.

**Image de cover :**

1. Si un MCP de génération d'image est disponible (ex. **AVQN Media Studio**, outil
   `generate_image`) : génère une image de cover (format paysage ~1200×630), récupère
   l'**URL publique** renvoyée, puis pose-la via
   `update_resource({ slug, patch: { coverImageUrl: <url> } })`.
2. Sinon : demande une URL d'image à l'utilisateur, ou propose de continuer sans cover.

## Phase 4 — Relecture & publication

1. **Relis** la ressource créée : `get_resource` (arbre + contenu) et/ou `get_outline`
   (structure + sommaire).
2. **Déroule la checklist** `references/verification.md` : cohérence avec le plan validé,
   pas de section vide, sommaire propre, slug propre, cover présente, modules valides.
   Corrige ce qui cloche (`update_module`, `add_modules`, `reorder_pages`…).
3. **Récapitule** : donne l'**URL** finale (`/r/<slug>`) et un résumé de la structure.
   Propose les ajustements éventuels. Propose aussi des **liens de tracking** pour la
   diffusion (un par canal : LinkedIn, newsletter…) via l'outil `tracking_link` — voir
   `references/liens-tracking.md`. La provenance remontera dans `get_stats`.
4. **Propose explicitement de publier.** Si l'utilisateur valide :
   `update_resource({ slug, patch: { published: true } })`. Ne publie **jamais**
   automatiquement sans accord.

## Références (à charger au moment voulu)

- `references/modules.md` — les 14 types de module et la shape exacte de leur `content`.
- `references/outils-mcp.md` — les outils du MCP `avqn_res` (params, retour, quand les utiliser).
- `references/liens-tracking.md` — diffuser avec suivi de provenance : paramètres UTM et outil `tracking_link`.
- `references/verification.md` — checklist de relecture finale (phase 4).
