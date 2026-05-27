# Skills ContentOS

Skills agents pour ContentOS. Chaque skill est un cerveau éditorial ou métier conçu pour fonctionner avec la plateforme via son connecteur MCP. Le code des skills est versionné ici ; à l'exécution, le skill est installé dans le chat de l'utilisateur et reste le cerveau qui pilote la plateforme par-dessus les tools.

## content-os-redaction

**Rôle.** Produit, réécrit et relit du contenu éditorial signé Manu — posts LinkedIn, emails, pages, messages — et accompagne le post LinkedIn de son visuel. Le skill porte la méthode ; l'état (idées, voix, writing-templates, templates et styles visuels) vit dans ContentOS et est lu via MCP.

**Prérequis.** Le connecteur MCP ContentOS doit être configuré et actif. Sans lui, le skill peut raisonner mais ne peut ni lire l'état, ni pousser de draft, ni produire de visuel.

**Voix, formats, marque visuelle.** La voix de Manu, les writing-templates (post-thèse LinkedIn…), les visual-templates et visual-styles vivent comme entités dans ContentOS. Ils sont seedés côté plateforme avant la première utilisation :
- `npm run seed:redaction -- <email>` — voix + writing-templates.
- `npm run seed:visual -- <email>` — templates de marque visuels.

**Installer comme skill Claude.** Pointer le répertoire `skills/content-os-redaction/` comme skill (point d'entrée `SKILL.md`) : symlink dans `~/.claude/skills/`, ou via la config Claude Code. Les tools MCP se chargent au démarrage de la session, pas à chaud.

## Frontière méthode / état

Le skill porte uniquement la méthode générique — applicable à tout auteur, tout format. Aucune information spécifique à Manu, à un format, ou à une marque visuelle. Ces spécificités vivent dans ContentOS sous forme d'entités (`voice`, `writing-template`, `visual-template`, `visual-style`) chargées dynamiquement via MCP. Cette frontière permet de faire évoluer voix, formats et marque sans toucher au skill, et de le réutiliser pour d'autres auteurs.
