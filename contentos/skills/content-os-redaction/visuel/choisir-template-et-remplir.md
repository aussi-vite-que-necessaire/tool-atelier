# choisir-template-et-remplir

Pour les habillages qui utilisent un template de marque (carte texte, ou template + image), choisir le template et préparer ses variables. Brique sautée pour l'image nue.

## Choisir le template

`list_visual_templates` → choisir celui dont le `label` colle à l'intention validée. En cas de doute entre deux, montrer les options à Manu.

`get_visual_template(id)` → lire les **specs de variables** : pour chaque variable, son `name`, `label`, `type` (`string` ou `image`), ses bornes `min`/`max`, sa `description` et `optional`. Le `sampleVars` renvoyé donne un exemple calibré du registre attendu.

## Remplir les variables

Remplir chaque variable depuis le contenu du post :

- respecter le `type` : texte court pour `string`, `mediaId` pour `image` ;
- respecter les bornes `min`/`max` (un texte trop long est tronqué au rendu) ;
- suivre la `description` de la variable — elle dit ce que le format attend (« court et frappant : un chiffre + son unité ») ;
- les variables `optional` se remplissent si elles renforcent, se laissent vides sinon.

Les variables `image` reçoivent un `mediaId`, obtenu à l'étape `produire-et-attacher.md` (génération ou galerie). Ne pas inventer de `mediaId`.

## Créer un template depuis le style guide

Quand aucun template ne convient à l'intention validée :

1. `list_style_guides` → repérer le style guide qui porte la langue visuelle voulue ; `get_style_guide(id)` pour lire ses recommandations (palette, typos avec leurs URLs/`@font-face`, conventions) et la liste de ses templates rattachés.
2. Lire un ou deux templates rattachés via `get_visual_template(id)` : ce sont des exemples concrets de la langue visuelle appliquée en HTML/CSS.
3. Écrire le nouveau template en reprenant couleurs et polices du style guide directement dans le CSS, puis le créer avec `create_visual_template` en renseignant `styleGuideId` pour le rattacher au guide.

## Règle de frontière

Si la `description` d'une variable contredit une intuition de forme, la `description` du template l'emporte : elle connaît le format. Le skill ne réécrit pas les contraintes du template.

## Sortie

Le `templateId` choisi + le dictionnaire de variables `string` prêtes. Les variables `image` restent à compléter avec le `mediaId` produit à l'étape suivante.
