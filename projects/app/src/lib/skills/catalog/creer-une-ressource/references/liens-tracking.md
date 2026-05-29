# Liens de tracking (UTM)

Pour savoir **d'où viennent les visiteurs** d'une ressource — quelle plateforme, quel post —
on diffuse des liens tagués. La plateforme capte la provenance au premier clic et la fait
remonter dans les stats (`get_stats` : top sources, utilisateurs gagnés).

## Paramètres

On suit le standard UTM. Trois paramètres, deux optionnels :

| Paramètre | Sens | Exemples | Requis |
| --- | --- | --- | --- |
| `source` (`utm_source`) | la **plateforme** d'où vient le clic | `linkedin`, `newsletter`, `twitter` | oui |
| `campaign` (`utm_campaign`) | le **contenu précis** | `post-automatisation`, `carrousel-mai` | non |
| `medium` (`utm_medium`) | le **canal** | `social`, `email` | non |

Règle d'usage : `source` = la plateforme, `campaign` = le post précis. Le couple permet de
distinguer **plusieurs posts qui pointent vers la même ressource** (même `source`, `campaign`
différentes). Les valeurs sont normalisées (minuscules, espaces rognés, ≤ 64 caractères).

## Générer un lien — outil `tracking_link`

Ne construis pas l'URL à la main : appelle le MCP, qui garantit le bon domaine, les bons
noms de paramètres et la normalisation.

```
tracking_link({ slug: "guide-ia", source: "linkedin", medium: "social", campaign: "post-auto" })
→ { url: "https://ressources.avqn.ch/r/guide-ia?utm_source=linkedin&utm_medium=social&utm_campaign=post-auto" }
```

- `slug` : la ressource (celui renvoyé par `create_resource` / `get_resource`).
- `path` (optionnel) : tableau de slugs pour cibler une **sous-page** (défaut = page racine).
- Génère **un lien par canal de diffusion** : un pour LinkedIn, un pour la newsletter, etc.,
  avec des `campaign` distinctes si tu veux comparer des posts.

## Diffusion

Au moment de remettre l'URL finale à l'utilisateur (phase 4), propose une petite liste de
liens tagués prêts à coller, un par endroit où il compte partager la ressource. Il pourra
ensuite suivre dans `get_stats` ce qui ramène le plus de monde.
