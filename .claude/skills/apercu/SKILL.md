---
name: apercu
description: L'œil de l'agent sur le front. À charger dès que tu implémentes ou modifies une UI (page, composant, layout, style) — pour RENDRE la page, la screenshoter, la VOIR et critiquer ton propre rendu (espacement, hiérarchie, responsive, cohérence) avant de pousser. Chromium headless local au conteneur cloud, aucune dépendance à la prod.
---

# /apercu — voir et critiquer son front avant de pousser

Tu codes le front **à l'aveugle** par défaut : `npm run dev` fait tourner la page, mais rien ne
la regarde. `apercu` te donne un œil — un Chromium headless **dans le conteneur** (Playwright,
zéro dépendance à la prod ni au browserless du lab) qui screenshote la page que tu rends. Tu
**Read** le PNG → tu *vois* → tu critiques → tu corriges → tu re-screenshotes. *Puis* tu pousses.

C'est un **réflexe**, pas une option : toute modif qui change un rendu visuel se termine par un
coup d'œil. Voir son travail ne coûte presque rien et change tout sur la qualité livrée.

## La boucle

1. **Lance le serveur de dev en arrière-plan** (à la racine) et attends qu'il réponde :
   ```bash
   npm run dev   # via Bash run_in_background:true
   ```
   Attends `http://localhost:3000` (poll : `curl -sf -o /dev/null http://localhost:3000`).
   Si la base manque, `scripts/dev-db.sh up` d'abord.
2. **Capture** la (les) page(s) touchée(s), mobile **et** desktop :
   ```bash
   bin/apercu --route /            # page d'accueil
   bin/apercu --route /reglages    # une page précise ; répète --route pour plusieurs
   ```
   Sortie : un PNG par page × viewport (chemins imprimés, préfixe 📸).
3. **Read chaque PNG** — l'outil Read montre l'image à Claude, donc tu la *vois* vraiment.
4. **Critique avec la grille ci-dessous**, corrige le code, re-capture (le `next dev` a
   hot-reload — pas besoin de relancer le serveur). Répète jusqu'à ce que ce soit propre.
5. **Arrête le serveur de dev** (kill le process arrière-plan) une fois satisfait.

## Grille de critique

Regarde le PNG comme un designer exigeant, pas comme « est-ce que ça s'affiche » :

- **Hiérarchie & lisibilité** — le regard sait où aller ? titres/corps bien différenciés ?
- **Espacement, alignement, rythme** — marges régulières, rien qui colle ou flotte, grille tenue.
- **Responsive** — mobile *et* desktop OK ? rien qui déborde, casse ou se chevauche ?
- **États** — vide, chargement, erreur, focus/hover : pas seulement le cas nominal idéal.
- **Contraste & accessibilité de base** — texte lisible sur son fond, cibles tactiles correctes.
- **Cohérence avec le projet** — *si le projet a un design system ou des conventions établies
  (ex. `@contentos/ui` et son thème, composants `src/components/ui/`), aligne-toi dessus et
  réutilise l'existant plutôt que de réinventer ; sinon, respecte l'identité propre du projet.*
  On ne plaque pas un look de suite sur un projet qui a la sienne (`docs`, `www`) — on **match
  the codebase**. (Liste des composants partagés : `bin/ui-sync --list`.)

## Options utiles

`bin/apercu [url] [--route <path>] [--viewport mobile|desktop|LxH] [--out <dir>]
[--no-full] [--wait <selector>] [--wait-ms <n>] [--dry-run]`

- viewports par défaut : `mobile` (390×844) + `desktop` (1440×900) ; surcharge avec `--viewport`.
- `--wait <selector>` pour attendre un élément (contenu chargé en async) avant de capturer.
- url positionnelle si le serveur n'est pas sur `localhost:3000`.

## Notes

- **Première utilisation** : `bin/apercu` installe Playwright puis télécharge Chromium une fois
  (quelques dizaines de secondes). Ensuite, immédiat.
- **Parcours interactifs complexes** (remplir un formulaire, naviguer un flow) : la lib Playwright
  est installée — tu peux écrire un script jetable sous `tools/apercu/` pour le cas particulier.
- Ce n'est **pas** un outil de déploiement : aucun flag `lab.json`, rien à provisionner.
