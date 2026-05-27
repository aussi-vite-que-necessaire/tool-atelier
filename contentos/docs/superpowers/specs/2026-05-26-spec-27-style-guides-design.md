# Spec 27 — Style guides

Date : 2026-05-26
Périmètre : app ContentOS (DB, MCP, back-office) + skill `content-os-redaction`.

## Objectif

Ajouter une entité **style guide** : un document markdown (palette, typographies, exemples, conventions de mise en page) que Manu crée et édite dans le back-office, et que Claude lit via le MCP au moment de **créer ou éditer un `visual_template`**, pour produire des templates visuellement cohérents.

Un style guide est une **référence d'auteur** : il est lu au moment d'écrire le HTML/CSS d'un template, jamais injecté au rendu. Le consommateur est un LLM qui lit de la prose, pas un moteur de substitution de variables.

## Frontière

La méthode et la consommation vivent dans le skill et les tools MCP ; l'état vit dans ContentOS. La spécificité visuelle reste portée par les `visual-template` (HTML/CSS) ; le style guide documente la **langue visuelle** que ces templates appliquent. Le rendu d'un template ne dépend d'aucun style guide : les couleurs et polices sont écrites en dur dans le CSS du template au moment de sa création.

## Modèle de données

### Nouvelle table `style_guides`

Sur le modèle de `visual_styles` :

```
style_guides {
  id        text primary key
  userId    text not null  -> user.id (on delete cascade)
  name      text not null
  content   text not null   // markdown
  createdAt timestamp not null default now()
  updatedAt timestamp not null default now()
}
index style_guides_user_id_idx (userId)
```

Aucun champ structuré (palette, fonts) : tout vit dans `content`. Convention d'écriture : pour qu'une police se charge réellement au rendu, l'auteur place dans le markdown une référence chargeable (URL Google Fonts, ou snippet `@font-face`) que Claude recopie dans le CSS du template.

### Lien template → guide

`visual_templates` gagne une colonne :

```
styleGuideId text  null  -> style_guides.id (on delete set null)
```

Nullable, rapport 1:1 (un template suit au plus un guide). Posée par Claude à la création/édition d'un template ; éditable dans l'admin. Supprimer un guide remet `styleGuideId` à `null` sur ses templates sans les casser.

### Retrait de la couleur de marque

La couleur de marque dynamique disparaît au profit des couleurs portées par les style guides. À supprimer :

- colonne `brandColor` de la table `settings` ;
- champ `color` du type `Brand`, de `EMPTY_BRAND` et de `buildBrandContext` (`src/lib/visual-templates/brand.ts`) ;
- la variable `{{brand.color}}` du contexte de rendu et de sa documentation dans `visual-template-form.tsx` ;
- le champ « Couleur principale » du formulaire de marque (`brand-form.tsx`, `brand/actions-core.ts`, `brand/page.tsx`).

La marque conserve `name`, `signature`, `logo`. Les variables de rendu restantes : `{{brand.name}}`, `{{brand.signature}}`, `{{brand.logo}}`.

## Surface MCP

Cinq tools, miroir de `visual_style` :

- `list_style_guides` → `StyleGuide[]`
- `get_style_guide` (`id`) → le guide **+ la liste de ses templates rattachés en référence légère** (`{ id, label, slug }`). Claude récupère le HTML/CSS d'un exemple via `get_visual_template` au cas par cas.
- `create_style_guide` (`name`, `content`) → `StyleGuide`
- `update_style_guide` (`id`, `name?`, `content?`) → `StyleGuide | undefined`
- `delete_style_guide` (`id`) → `{ deleted: id }`

`create_visual_template` et `update_visual_template` acceptent un `styleGuideId` optionnel.

Enregistrés via un `registerStyleGuideTools(server)` appelé dans `registerAllTools`.

## Back-office — `/settings/style-guides`

Même structure de pages que `visual-styles` :

- **Liste** (`page.tsx`) : cartes par nom, bouton « + Nouveau ».
- **Création** (`new/page.tsx`) : formulaire `name` + éditeur markdown ; aperçu = markdown rendu.
- **Édition** (`[id]/page.tsx`) : même formulaire ; sous le formulaire, la **grille des templates rattachés** (réutilise `template-card` des visual-templates) ; danger zone de suppression.

Couche d'accès : repository `src/lib/db/repositories/style-guides.ts` (`create/get/list/update/delete`) + server actions par page, sur le modèle de `visual-styles`.

## Consommation par Claude — câblage dans `content-os-redaction`

La section visuelle du skill intègre l'étape : **avant de créer ou d'adapter un `visual_template`, lire le style guide pertinent** (`get_style_guide` → règles markdown + ids des templates-exemples), appliquer la palette/typo/conventions dans le CSS, et renseigner `styleGuideId` à la création.

Points de câblage :

- `SKILL.md` : prérequis (ajouter `list_style_guides`/`get_style_guide` aux tools visuels) et phase 4, à l'endroit où un template peut être créé faute de template adapté.
- brique `visuel/choisir-template-et-remplir.md` : lire le style guide avant d'écrire ou de remplir un template, et rattacher le template au guide.

## Migration

- Migration Drizzle : `CREATE TABLE style_guides`, `ALTER TABLE visual_templates ADD COLUMN style_guide_id`, `ALTER TABLE settings DROP COLUMN brand_color`.
- Données : un éventuel template stocké qui référence `{{brand.color}}` doit être réécrit avec sa couleur en dur. Aucune occurrence dans les seeds ni le code ; à vérifier sur les templates créés en base.

## Hors périmètre

- `visual_style` (prompt de génération d'image) : inchangé ; sortira plus tard vers un media manager.
- Pas de champs structurés ni d'upload de fichiers de police : les polices passent par URL/`@font-face` dans le markdown.
- Carousel / vidéo.

## Acceptation

Sur la stack de test :

1. Le back-office permet de créer, lister, éditer, prévisualiser (markdown rendu) et supprimer un style guide.
2. La page d'un guide affiche les templates qui lui sont rattachés.
3. Le formulaire de marque n'expose plus de couleur ; les templates ne reçoivent plus `{{brand.color}}`.
4. Via le MCP, Claude peut `create`/`list`/`get`/`update`/`delete` un style guide ; `get_style_guide` renvoie le markdown + les références légères des templates rattachés.
5. `create_visual_template` accepte `styleGuideId` et le persiste.
6. Un agent porteur de `content-os-redaction`, quand il crée un template visuel, lit d'abord le style guide pertinent et rattache le template au guide.
