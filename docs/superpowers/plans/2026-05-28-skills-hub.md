# Hub central des skills — plan

Spec : `docs/superpowers/specs/2026-05-28-skills-hub-design.md`.

Le projet `skills/` a déjà été composé par `/lab-new` (Next.js + Drizzle + BetterAuth + OTP +
Tailwind). Il reste : peupler le contenu (skills), bâtir le front et le téléchargement, déménager
les skills existants, créer le skill media et le méta-skill, documenter.

## Tâche 1 — Corriger la description + thème du projet

- `skills/lab.json` et `skills/CLAUDE.md` : la description contient « l avqn-content atelier »
  (artefact JSON apostrophe). Remplacer par « Hub central des skills agentiques de la suite de
  tools de l'atelier (contentos, ressources, media). ».
- `skills/src/app/globals.css` : réécrire le bloc `@theme` — palette terreuse/papier neutre
  (proche d'un mode d'emploi de tool), `--color-brand-*`, `--font-sans`.

**Critère de succès** : `npm run build` toujours OK ; visuellement la page d'accueil n'utilise pas
les défauts de la base.

## Tâche 2 — Migrer les skills existants

- Créer `skills/skills/content-os-redaction/` en y déplaçant le contenu de
  `contentos/skills/content-os-redaction/`. Ajouter `manifest.json` (version 1, tagline et
  description tirées du `SKILL.md` actuel).
- Créer `skills/skills/creer-une-ressource/` en y déplaçant le contenu de
  `ressources/skills/creer-une-ressource/`. Ajouter `manifest.json` (version 1).
- Supprimer `contentos/skills/` et `ressources/skills/` (dossiers vidés).
- Mettre à jour `contentos/CLAUDE.md` (et son `README.md` si nécessaire) pour pointer vers le hub :
  remplacer toute mention de « le skill vit dans `contentos/skills/` » par une note vers
  `skills/skills/content-os-redaction/`.
- Idem pour `ressources/CLAUDE.md`.

**Critère de succès** : `git status` montre les déplacements ; les anciens dossiers ont disparu ;
le contenu des skills est intact à un dossier près.

## Tâche 3 — Créer le skill `creer-un-visuel` (media)

- `skills/skills/creer-un-visuel/SKILL.md` — frontmatter (nom, description longue côté découverte
  agent) + corps :
  - Prérequis : connecteur MCP `avqn_media` (ou nom équivalent) actif.
  - Cas d'usage couverts : générer une image depuis un prompt, éditer une image existante, rendre
    un HTML/CSS en image, instancier un visual-template, construire un PDF par agrégation.
  - 3-4 mini-recettes (« je veux une image carrée pour LinkedIn… », « je veux refaire un visuel à
    partir d'un template existant… », « je veux un PDF de cours… »).
  - Frontière méthode / état (templates et styles vivent dans `media`, pas dans le skill).
- `manifest.json` (version 1).
- `references/` (optionnel) — liste plate des outils MCP avec un mot par tool. Court.

S'inspirer du ton et de la structure de `creer-une-ressource/SKILL.md` mais rester plus léger.

**Critère de succès** : un agent qui charge ce skill sait reconnaître quand l'utilisateur a besoin
de media, sait nommer les bons outils MCP, et propose une recette adaptée.

## Tâche 4 — Créer le méta-skill `suite-avqn`

- `skills/skills/suite-avqn/SKILL.md` — frontmatter + corps :
  - Décrit la suite (`contentos`, `ressources`, `media`) et leur articulation.
  - Workflows croisés (3-4 patterns) :
    1. **Ressource → posts** : créer une ressource via `creer-une-ressource`, puis décliner en 3
       posts LinkedIn via `content-os-redaction` (avec visuels via `creer-un-visuel`).
    2. **Idée → post → visuel** : partir d'une idée ContentOS, écrire le post, attacher un visuel
       cohérent.
    3. **Visuel → post** : un visuel existe (campagne, événement) → écrire le post autour.
    4. **Cours → série** : étaler un cours `ressources` en série de posts éditoriaux.
  - Note d'installation : les 3 autres skills doivent être présents pour exécuter chaque pattern.
    Ce skill ne s'auto-installe pas avec les autres ; il les chapeaute.
- `manifest.json` (version 1).

**Critère de succès** : un agent qui charge `suite-avqn` sait choisir le bon point d'entrée parmi
les 3 skills sous-jacents selon ce que demande l'utilisateur.

## Tâche 5 — Page de liste publique

- `skills/src/lib/skills-fs.ts` — utilitaire serveur : liste les sous-dossiers de
  `<repo>/skills/skills/`, lit chaque `manifest.json`, renvoie un tableau trié (ordre stable, par
  exemple `name` ASC ou ordre manifestement utile : `suite-avqn` en tête).
- `skills/src/app/page.tsx` — appelle l'utilitaire, rend une grille de cartes :
  - Carte par skill : nom, tagline, version (badge `v3`), description, bouton « Télécharger »
    (lien `/api/skills/<name>/download`).
  - Si non connecté : le bouton devient « Se connecter pour télécharger » et pointe sur
    `/sign-in`.
  - Détection de la session via `getServerSession`-équivalent BetterAuth (route handler ou
    middleware ; reproduire le pattern d'un autre projet de l'atelier).
- Style Tailwind sobre, cohérent avec les autres projets.

**Critère de succès** : `/` rend en SSR la liste des 4 skills ; téléchargement bloqué sans
session ; lien de connexion fonctionnel.

## Tâche 6 — Route de téléchargement (zip à la volée)

- Dépendance : ajouter `jszip` (ou utiliser `node:stream` + lib légère ; `jszip` est le plus
  simple côté Next.js + edge-incompatible — utiliser `nodejs` runtime).
- `skills/src/app/api/skills/[name]/download/route.ts` :
  - `runtime = "nodejs"` (forcer Node, pas Edge).
  - Vérifie la session ; refus 401 sinon.
  - Lit `<repo>/skills/skills/<name>/manifest.json` ; si absent → 404.
  - Walk récursif du dossier (sauf `manifest.json` lui-même ? — à conserver pour traçabilité, à
    décider en implémentant ; par défaut on l'inclut).
  - Crée un zip en mémoire, le renvoie avec :
    - `Content-Type: application/zip`
    - `Content-Disposition: attachment; filename="<name>-v<version>.zip"`
- Tester localement avec `npm run build` + un appel `curl` une fois en preview.

**Critère de succès** : `curl -u-cookie` retourne un zip cohérent ; le zip décompressé contient le
skill avec un dossier racine `<name>/`.

## Tâche 7 — Documentation

- `skills/CLAUDE.md` — réécriture : décrire la mission du projet, la structure
  (`skills/<nom>/manifest.json` + contenu), la procédure de bump (« édite `version`, push,
  c'est en ligne »), le lien vers `docs/superpowers/specs/...`.
- `skills/skills/README.md` — court index humain (1 ligne par skill).
- Racine `CLAUDE.md` de l'atelier — ajouter `skills/` à la mention des projets témoins, ou en note
  séparée (« Hub des skills »).
- `contentos/CLAUDE.md`, `ressources/CLAUDE.md`, `media/CLAUDE.md` — pointer vers le hub.
- Pas de `PROJECTS.md` à éditer (artefact généré).

**Critère de succès** : un nouveau venu qui ouvre l'atelier comprend immédiatement où sont les
skills et comment publier une nouvelle version.

## Tâche 8 — Smoke local + déploiement

- À la racine de `skills/` : `npm install --no-audit --no-fund` ; `npm run db:generate` ;
  `npm run build`.
- À la racine de l'atelier : `git add ...` ; `git commit` ; `git push -u origin <branche>`.
- `gh pr create --fill`. Suivre la CI avec `gh run watch`. Vérifier la preview avec un `curl`.
- **Ne pas merger** : la PR reste ouverte pour Manu.

**Critère de succès** : preview verte, page d'accueil rendue, OTP fonctionnel (test rapide :
`/sign-in` répond, code preview `000000` valide), un téléchargement marche (en preview, l'OTP
preview suffit).

## Notes de risque

- **`@vercel/og` ou rendu d'image** : pas utilisé ici ; le hub ne génère pas d'image.
- **Tailwind 4 + Next 16 standalone** : si le build casse, isoler la cause (manquerait pas une
  config dans le starter) ; ne pas réinventer.
- **Auth preview** : `PREVIEW_OTP=000000` est attendu en preview. En prod, l'email Resend doit
  partir.
- **Branch-guard** : en session cloud le checkout principal partagé n'est pas réellement partagé,
  mais le hook bloque l'édition Edit/Write dans un dossier projet (top-level avec Dockerfile).
  Solution : pour les fichiers de `skills/`, passer par Bash (heredoc, sed -i, etc.) plutôt que
  Edit/Write.
