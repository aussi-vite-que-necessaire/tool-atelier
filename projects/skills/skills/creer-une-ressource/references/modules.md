# Modules — shape exacte du `content`

Un module est toujours `{ "type": <type>, "content": { … } }`. Voici les 14 types, la
shape exacte de leur `content` (champs **requis** vs *optionnels*), et quand l'utiliser.

Le texte des champs `md` accepte du **Markdown** (titres `##`/`###`, listes, liens, code
inline, tableaux, citations). Les titres `##` et `###` alimentent le sommaire de la page.

| Type | `content` | Notes / quand |
| --- | --- | --- |
| `markdown` | `{ md }` | Corps de texte. La brique de base d'une page. |
| `callout` | `{ variant, md }` | `variant` ∈ `info` \| `warn` \| `success`. Encadré pour attirer l'attention (astuce, avertissement, point clé). |
| `image` | `{ url, alt?, caption? }` | `url` = URL publique. Illustration ; `caption` sous l'image. |
| `video` | `{ url, caption? }` | Vidéo lue nativement (`<video controls>`). `url` = fichier vidéo. |
| `file` | `{ url, label, filename, size? }` | Bouton de téléchargement. `size` en octets (optionnel). Pour livrables (PDF, JSON…). |
| `embed` | `{ url }` | Iframe 16:9. Pour intégrer YouTube, etc. (`url` = URL d'embed). |
| `code` | `{ language, code, filename? }` | Bloc de code colorisé (Shiki) avec bouton copier. `language` ex. `typescript`, `bash`. |
| `prompt` | `{ prompt, title? }` | Bloc « prompt » copiable. Pour livrer un prompt prêt à coller. |
| `accordion` | `{ title, md, open? }` | Section repliable. `open` (booléen) = ouverte par défaut (sinon fermée). |
| `steps` | `{ steps: [{ title, md }, …] }` | Liste numérotée d'étapes (**≥ 1**). Pour un mode opératoire. |
| `comparison` | `{ columns: [{ title, md }, …] }` | Grille comparative de **2 à 3** colonnes. Avant/après, option A/B. |
| `quote` | `{ text, author?, source?, url? }` | Citation. `url` devient un lien si `source` est aussi fourni. |
| `cta` | `{ label, url, variant? }` | Bouton d'action. `variant` ∈ `primary` \| `secondary`. Appel à l'action final. |
| `gallery` | `{ images: [{ url, alt?, caption? }, …] }` | Galerie d'images (**≥ 1**). Grille 2–3 colonnes. |

## Contraintes à respecter

- `callout.variant` : uniquement `info`, `warn` ou `success`.
- `cta.variant` : uniquement `primary` ou `secondary`.
- `steps.steps` : au moins 1 étape ; chaque étape a `title` **et** `md`.
- `comparison.columns` : entre 2 et 3 colonnes ; chaque colonne a `title` **et** `md`.
- `gallery.images` : au moins 1 image ; chaque image requiert `url`.
- Tout champ `url` doit être une URL valide (`http(s)://…`).

## Exemples

```json
{ "type": "markdown", "content": { "md": "## Pourquoi ?\n\nUn paragraphe d'intro." } }

{ "type": "callout", "content": { "variant": "info", "md": "**Astuce** : commence petit." } }

{ "type": "steps", "content": { "steps": [
  { "title": "Installer", "md": "Lance `npm install`." },
  { "title": "Configurer", "md": "Crée `.env.local`." }
] } }

{ "type": "comparison", "content": { "columns": [
  { "title": "Avant", "md": "Manuel, lent." },
  { "title": "Après", "md": "Automatisé." }
] } }

{ "type": "code", "content": { "language": "bash", "filename": "deploy.sh",
  "code": "npm run build && npm run deploy" } }

{ "type": "prompt", "content": { "title": "Synthèse d'article",
  "prompt": "Tu es éditeur. Résume :\n\"\"\"\n{{texte}}\n\"\"\"" } }

{ "type": "cta", "content": { "label": "Réserver un appel",
  "url": "https://avqn.ch", "variant": "primary" } }
```
