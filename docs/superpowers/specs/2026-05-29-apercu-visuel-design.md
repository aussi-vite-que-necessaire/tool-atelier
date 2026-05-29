# aperçu visuel — l'œil de l'agent en dev cloud — design

**Date** : 2026-05-29
**Périmètre** : plomberie de l'atelier (skill + script + `CLAUDE.md` + hook). Aucun projet touché.

## Problème

L'agent code le front **à l'aveugle**. En session cloud, le conteneur monte Postgres/Redis
(`dev-db.sh`) et fait tourner `npm run dev` (Next.js sur `localhost:3000`) — l'app *tourne*,
mais **rien ne la regarde**. Le seul Chromium de l'atelier vit en prod (browserless partagé,
`BROWSER_URL`) et c'est un outil *applicatif* (rendu HTML→image de `media`), pas un outil de
dev. La seule preview visuelle arrive **après** push (`…preview.contentos.ch`) : boucle longue.
Résultat : la qualité front repose sur du code au jugé + des tests qui ne disent rien du visuel.

Superpowers n'a aucune skill front/visuelle ; ses skills sont du process. Le « Visual Companion »
du brainstorm sert l'humain (HTML servi à *ton* navigateur), pas l'agent.

## Principe directeur

**Donner un œil à l'agent, et un seul levier : voir → critiquer → corriger, avant de pousser.**
Boucle 100 % locale au conteneur cloud, zéro dépendance réseau sortant ni à la prod.

- **L'œil est universel** : screenshoter et critiquer son rendu vaut pour tout projet à UI.
- **Le standard est local au projet** : *contre quoi* l'agent juge est déjà inscrit dans le
  projet (dépendance/usage de `@contentos/ui`, thème, conventions du code, `CLAUDE.md` du
  projet). On n'impose **aucun** alignement global au design system — `docs`/`www` gardent leur
  identité ; `cast`/`media` réutilisent `@contentos/ui` comme ils le font déjà. C'est du « match
  the codebase you're in », pas une feature d'alignement à part.

## Mécanique

Chromium **headless** piloté par **Playwright**, installé paresseusement dans le conteneur
(pas le browserless du lab, pas de Docker). On retient un **script maison** plutôt que le MCP
Playwright : le MCP se charge au démarrage et pollue *toutes* les sessions (la plupart ne
touchent pas au front, et on lance beaucoup d'agents en parallèle) ; un script appelé à la
demande ne coûte rien quand on ne s'en sert pas, et l'atelier en garde la maîtrise.

### Composants

- **`tools/apercu/`** — outil isolé de la plomberie (jamais embarqué dans une image projet).
  - `package.json` épingle `playwright`.
  - `shot.mjs` — capture : pour chaque viewport, `goto(url+route)`, attente du chargement,
    screenshot pleine page → PNG. Args : URL positionnelle (défaut `http://localhost:3000`),
    `--route`, `--viewport` (presets `mobile` 390×844 / `desktop` 1440×900, répétable), `--out`,
    `--full`/`--no-full`, `--wait <selector>`, `--wait-ms`, `--dry-run` (résout et imprime le
    plan en JSON sans lancer le navigateur — testable sans Chromium). Erreur claire si le serveur
    de dev est injoignable.
- **`bin/apercu`** — wrapper bash (style atelier : header, `set -euo pipefail`, `ROOT=…`).
  Installe les deps de `tools/apercu` au premier appel, télécharge Chromium **une fois**
  (sentinelle `.browser-ready`, idempotent), puis délègue à `shot.mjs`. Imprime les chemins PNG.
- **`.claude/skills/apercu/SKILL.md`** — la skill : quand l'invoquer (réflexe sur toute modif
  front), le flux (lancer `npm run dev` en arrière-plan → `bin/apercu` → **Read** des PNG →
  auto-critique avec la grille → itérer → arrêter le serveur), et la grille de critique.

### La boucle (dans la skill)

1. lancer `npm run dev` en arrière-plan dans le projet, attendre `localhost:3000` ;
2. `bin/apercu --route <page>` → PNG mobile + desktop ;
3. **Read** chaque PNG (l'outil Read montre l'image à Claude → il *voit*) ;
4. critiquer avec la grille, corriger, re-screenshoter ; répéter jusqu'à ce que ce soit propre ;
5. arrêter le serveur de dev. *Puis* on pousse.

### Grille de critique (dans la skill)

Hiérarchie & lisibilité · espacement/alignement/rythme · responsive (mobile **et** desktop) ·
états (vide, chargement, erreur, focus) · contraste/accessibilité de base · **cohérence avec
le projet** : *« si le projet a un design system / des conventions (ex. `@contentos/ui`, son
thème), aligne-toi dessus ; sinon respecte son identité propre. »*

## Ancrage (réflexe)

- **`CLAUDE.md`** (racine) : section courte « l'œil de l'agent » — toute modif front passe par
  voir+critiquer avant push ; `/apercu` ajouté à la liste des skills atelier.
- **`.claude/hooks/session-start.sh`** : `/apercu` ajouté au message d'accueil (découvrabilité).

Conforme à la surcouche « un seul arrêt humain puis jusqu'à la PR » : l'œil est un **automatisme**
du trajet, pas une étape qui rend la main.

## Tests

- `test/apercu.test.sh` (style atelier, bash + grep) : `--help` documente l'usage ; `shot.mjs
  --dry-run` résout URL/route/viewports/chemins correctement (sans Chromium) ; smoke réel
  (screenshot d'un HTML servi localement) **si** `APERCU_E2E=1` et Chromium présent, sinon SKIP —
  même convention que `session-start.test.sh` (SKIP si `jq` absent).
- `test/session-start.test.sh` : assertion ajoutée que le message mentionne `apercu`.

## Hors périmètre

Preview humaine anticipée (l'humain a le temps, la preview de branche suffit). Parcours
interactifs complexes (l'agent peut au besoin écrire un script Playwright jetable — la lib est
déjà installée). Pas de nouveau flag `lab.json` : c'est un outil de **dev**, pas de déploiement.
