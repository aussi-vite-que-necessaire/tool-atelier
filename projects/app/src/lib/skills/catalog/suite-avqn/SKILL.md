---
name: suite-avqn
description: >
  Chapeau d'orchestration de la suite AVQN — articule les skills `creer-une-ressource`,
  `content-os-redaction` et `creer-un-visuel` quand une tâche traverse plusieurs outils
  (ex. "écris un cours et tire-en 3 posts LinkedIn", "transforme cette idée en post +
  visuel", "fais une série de posts à partir de la ressource X"). À déclencher dès qu'une
  demande dépasse un seul outil de la suite, ou pour décider par où commencer quand un
  travail éditorial implique ressource + post + visuel.
---

# Suite AVQN — orchestrateur

Trois outils, trois skills, une suite :

| Outil | Skill | Rôle |
|---|---|---|
| **ressources** (`avqn_res`) | `creer-une-ressource` | Concevoir et publier un cours / lead magnet. |
| **contentos** (`contentos`) | `content-os-redaction` | Écrire, réécrire, relire un contenu éditorial signé Manu. |
| **media** (`media`) | `creer-un-visuel` | Générer / éditer / rendre un visuel ; construire un PDF. |

Ce skill **ne remplace pas** les trois autres : il décide **dans quel ordre** les appeler et
**comment** passer les artefacts de l'un à l'autre. Il suppose les trois autres skills
installés en parallèle dans le chat. Si l'un manque, le signaler.

## Prérequis — vérifier la suite

Ouvre la conversation en confirmant en un coup d'œil :

1. Les 3 connecteurs MCP nécessaires sont actifs : `avqn_res`, `contentos`, `media` (un par
   tool de la suite). Tu peux les pinger via un appel léger (`list_resources`, `list_ideas`,
   `list_images`).
2. Les 3 skills sous-jacents sont chargés dans le chat (`creer-une-ressource`,
   `content-os-redaction`, `creer-un-visuel`).

Si l'un manque, dis-le, et propose à l'utilisateur soit de l'installer (récupération sur
`https://skills.contentos.ch`), soit de réduire le scope au workflow qui n'en a pas besoin.

## Workflows croisés

### 1) Ressource → série de posts LinkedIn

**Quand** : on veut transformer un cours / lead magnet en présence éditoriale (annonce,
extraits, témoignages, conclusion).

**Déroulé** :

1. **Vérifier** que la ressource existe (sinon, `creer-une-ressource` d'abord).
2. **Charger** la ressource via `list_resources` + `get_resource(id)` (ou `get_outline(id)`).
3. **Demander** à l'utilisateur l'angle de la série : promotion, extraits pédagogiques,
   making-of, 3 prises de position liées au sujet… (`AskUserQuestion`).
4. **Déléguer la rédaction** à `content-os-redaction` pour chaque post (1 idée par post,
   `tracking_link` pour pointer vers la ressource — `mcp__avqn_res__tracking_link`).
5. **Visuel** : pour chaque post, déléguer à `creer-un-visuel` un visuel cohérent (même
   style, variations sur le thème). Attacher via `attach_media_to_post`.
6. **Planifier** la série : ordonner, espacer (1-2 par semaine, à confirmer avec
   l'utilisateur).

### 2) Idée → post + visuel

**Quand** : une `idea` existe dans ContentOS (ou est fournie au fil de l'eau), on veut
sortir un post complet avec son image.

**Déroulé** :

1. `content-os-redaction` charge la voix + writing-template, produit le draft.
2. Une fois le draft validé, `creer-un-visuel` produit le visuel — souvent
   `render_template` avec un visual-template de marque, ou `generate_image` avec un
   `style_id` cohérent.
3. `content-os-redaction` rattache le visuel (`attach_media_to_post`).

### 3) Visuel existant → post

**Quand** : un visuel est là (campagne, capture d'écran, photo d'événement, image inspirante)
et on veut écrire le post autour.

**Déroulé** :

1. Identifier le visuel via `list_images` + `get_image(id)` (ou URL directe).
2. Décrire le visuel à l'utilisateur, en tirer 3-5 angles narratifs possibles.
3. `content-os-redaction` produit le post sur l'angle retenu.
4. `attach_media_to_post` rattache le visuel existant (par `media_url` ou `media_id`).

### 4) Cours → présentation longue (PDF)

**Quand** : on veut un export PDF d'une ressource (à diffuser hors-plateforme, en lead
magnet attaché).

**Déroulé** :

1. `creer-une-ressource` : lister les pages et leur ordre.
2. `creer-un-visuel` : pour chaque page, produire une image-slide via `render_template` ou
   `render_html`.
3. `creer-un-visuel` : `create_pdf` avec la liste ordonnée d'`id` d'images.

## Choisir le bon point d'entrée

| L'utilisateur dit… | Démarre par… |
|---|---|
| « j'ai une idée de cours », « je veux faire un lead magnet » | `creer-une-ressource` |
| « écris un post », « j'ai une idée à mettre en mots », « réécris ça comme moi » | `content-os-redaction` |
| « il me faut une image », « refais ce visuel », « une slide pour LinkedIn » | `creer-un-visuel` |
| « décline ma ressource X en série de posts » | ce skill — workflow 1 |
| « j'ai un visuel, écris le post autour » | ce skill — workflow 3 |
| « sors un PDF de la ressource X » | ce skill — workflow 4 |

## Frontière

Ce skill **n'a pas** d'outils MCP propres. Il **n'écrit pas** de contenu lui-même, **ne génère**
aucune image. Il dirige : il ouvre le bon skill, lui passe le contexte, récupère le résultat,
et passe au suivant. Si une étape n'est pas claire, demande à l'utilisateur **avant** de
plonger dans un skill.
