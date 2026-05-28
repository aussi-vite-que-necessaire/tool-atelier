# Hub central des skills agentiques — design

## Pourquoi

Manu construit une **suite de tools agentiques** (`contentos`, `ressources`, `media`) — chaque tool
porte une **API MCP** + un **skill Claude** qui sert de cerveau pilotant le tool. Aujourd'hui :

- `contentos/skills/content-os-redaction/` — skill complet (production + relecture + visuel).
- `ressources/skills/creer-une-ressource/` — skill complet (4 phases).
- `media/` — **pas de skill** encore.

Les skills sont éparpillés dans les repos de chaque tool. Pas de point central pour les
**découvrir**, les **télécharger**, ou les **versionner**. L'installation reste artisanale
(symlink local, lecture du repo).

**Objectif** : un projet `skills` qui centralise tout — une page publique liste les skills, un OTP
par email débloque les téléchargements, chaque skill est zippé à la volée avec version dans le nom
de fichier (`<skill>-v<n>.zip`). On en profite pour créer le skill manquant (`creer-un-visuel`,
pour media) et un méta-skill (`suite-avqn`) qui décrit les workflows croisés des trois outils.

## Forme

### Architecture

- **Source de vérité unique** : les skills vivent dans `skills/skills/<nom-skill>/`. Les copies
  dans `contentos/skills/` et `ressources/skills/` **sont supprimées** ; leurs CLAUDE.md
  pointent vers le hub.
- **Frontend Next.js** (déjà composé par `/lab-new`) : `skills.lab.avqn.ch` en prod,
  `skills-<branche>.lab.avqn.ch` en preview.
- **Auth** : BetterAuth + Resend, OTP par email (même pattern que les autres projets ; auto-login
  preview avec code `000000` déjà géré par la composition).
- **Pas de DB applicative** : les skills vivent sur le filesystem ; seules les tables d'auth
  BetterAuth utilisent Postgres.

### Manifest par skill

Chaque dossier `skills/skills/<nom>/` contient :

```
manifest.json     # méta-données + version
SKILL.md          # entrée du skill (frontmatter YAML standard Claude)
... (fichiers du skill)
```

`manifest.json` :

```json
{
  "name": "creer-une-ressource",
  "version": 3,
  "tagline": "De l'idée brute à la ressource publiée sur AVQN.",
  "description": "Court paragraphe (≤ 300 caractères) pour la page de liste.",
  "latest_changes": "Optionnel : 1-2 phrases sur ce qui change dans cette version."
}
```

**Versionnage manuel** : on bump `version` à la main quand on publie une amélioration. Le zip
téléchargé prend le nom `<name>-v<version>.zip`. Pas d'historique : la dernière version est la seule
servie.

### Routes Next.js

- `GET /` — landing publique : liste les skills (lecture des `manifest.json`), nom + tagline +
  version + description + bouton « Télécharger ». Le bouton est masqué/désactivé si l'utilisateur
  n'est pas connecté ; remplacé par « Se connecter pour télécharger ».
- `GET /sign-in` — déjà composé : email → OTP par mail → connexion.
- `GET /api/skills/[name]/download` — handler : vérifie la session, lit `skills/<name>/`, zippe à
  la volée, renvoie le `Content-Disposition: attachment; filename="<name>-v<n>.zip"`. Refuse 401
  sans session.
- `GET /healthz` — déjà composé.

Pas de page de détail dédiée pour la v1 (la liste suffit). Pas de recherche, pas de filtres.

### Skills à livrer

1. **`content-os-redaction`** (v1) — migré tel quel depuis `contentos/skills/`. Ajout d'un
   `manifest.json`.
2. **`creer-une-ressource`** (v1) — migré tel quel depuis `ressources/skills/`. Ajout d'un
   `manifest.json`.
3. **`creer-un-visuel`** (v1) — **nouveau** skill pour `media`. Mode d'emploi des tools MCP du
   service `media` (`generate_image`, `edit_image`, `render_html`, `render_template`, templates +
   styles, build de PDF). S'inspire du ton et de la structure de `creer-une-ressource` (4 phases,
   `AskUserQuestion`, prérequis MCP, etc.) mais reste plus léger (un skill « mode d'emploi », pas
   un cerveau métier comme `content-os-redaction`).
4. **`suite-avqn`** (v1) — **nouveau** méta-skill. Décrit les **workflows croisés** : créer une
   ressource puis en tirer 3 posts LinkedIn déclinés, accompagnés de visuels media ; partir d'un
   visuel pour un post ; etc. Aucun code ; ne suppose pas d'installer les 3 autres tout seul (il
   suggère de les installer en parallèle). Méthode d'orchestration uniquement.

### Documentation

- `skills/CLAUDE.md` — décrit le projet, où ajouter un skill, comment bumper une version.
- `skills/skills/README.md` — index humain des skills (généré ou maintenu à la main, court).
- `contentos/CLAUDE.md` + `ressources/CLAUDE.md` — pointer vers le hub (« le skill X vit
  maintenant dans le projet `skills` »).
- `media/CLAUDE.md` — mentionner le skill `creer-un-visuel` dans le hub.
- Racine `CLAUDE.md` de l'atelier — ajouter une ligne sur le projet `skills` dans la carte.

### Hors scope (v1)

- Pas d'historique des versions (on garde la dernière, point).
- Pas d'API de listing JSON publique (la page HTML suffit).
- Pas d'audit des téléchargements.
- Pas de notification de nouvelle version aux utilisateurs.
- Pas d'amélioration de la cohérence inter-skills (notée pour plus tard).

## Décisions cadrées avec Manu

- Source de vérité : **déménagement complet** dans le hub.
- Auth : **OTP email** via BetterAuth + Resend.
- Versionnage : **manuel** via manifest.
- Méta-skill : **orchestrateur de workflows croisés**, sans auto-install.
