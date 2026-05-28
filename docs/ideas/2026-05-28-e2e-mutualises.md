# Mutualiser les tests e2e — idée en backlog

Réflexion née de la PR #43 (optim Docker contentos). Capturée pour ne pas perdre le fil
quand on aura plus de consommateurs.

## Contexte (28/05/2026)

Playwright est en `devDependencies` de `contentos` uniquement (1 spec : smoke e2e du
flow d'auth, `test/e2e/auth.spec.ts`). Le poids approximatif :

- ~200 MB de package npm + binaires Chromium (cachés via `actions/cache@v4` sur
  `~/.cache/ms-playwright`)
- ~30-60s de `npm ci` ajoutés en CI à froid (en chaud, négligeable)

Aucun autre projet (`ressources`, `media`, `hello`, `counter`) n'a de tests e2e
aujourd'hui. Le split web/worker fait dans la PR #43 a déjà sorti Playwright du runtime
de toutes les images Docker — il n'existe plus que dans le `npm ci` du job `test` CI.

## L'idée — projet `e2e/` central

Quand 2-3 projets utiliseront Playwright, créer un projet dédié dans l'atelier :

- `e2e/` — un projet à part entière (cohérent avec le pattern « un service par
  capacité » de l'atelier, comme `media` qui extrait la génération de médias).
- `e2e/<projet>/*.spec.ts` — specs par projet ciblé.
- `e2e/fixtures/` — fixtures partagées (auth helpers, factories, etc.).
- `@playwright/test` installé **une seule fois** (dans `e2e/package.json`).
- Run **en post-deploy** contre les URLs de preview/dev (pas pré-deploy contre un
  build local).

Avantages structurels :

- Un seul `npm ci` Playwright en CI.
- Pas de devDep Playwright dans les projets « réels ».
- Tests cross-projet possibles (un scénario qui touche `contentos` + `media`, par ex.).
- Architecture lisible : ouvrir `e2e/` pour comprendre la couverture e2e globale.

Tradeoffs :

- DX dev local : les specs ne vivent plus à côté du code testé, on perd la proximité
  IDE. Mitigation possible : un script `lab e2e <projet>` qui ouvre le bon dossier.
- L'e2e devient **post-deploy** par construction (besoin d'une URL cible). Aujourd'hui
  contentos run son e2e contre un build local — on perd ce mode (ou on le garde via
  un `--target=local` qui lance l'app en service Docker dans le runner).

## Pipeline imaginé — preview / dev / prod

Aujourd'hui l'atelier a 2 environnements : `preview` (par branche, host
`<projet>-<branche>.lab.avqn.ch`) et `prod` (main, host `<projet>.lab.avqn.ch` ou
`domain` custom).

L'idée de Manu : **insérer un environnement `dev` entre les deux**, et y faire tourner
les e2e **lourds** sans bloquer le développement courant.

1. **`preview`** — par branche, déployée à chaque push. Pas d'e2e bloquant (au plus
   un smoke ultra-rapide). Boucle d'itération courte, le dev observe le rendu réel
   en quelques minutes.
2. **`dev`** — environnement intermédiaire alimenté par les PR mergées (ou un tag, un
   workflow manuel). Les e2e complets tournent ici, en async par rapport au merge,
   sans bloquer les PR suivantes. C'est le **« staging continu »**.
3. **`prod`** — passage validé seulement quand les e2e contre `dev` passent au vert
   sur le dernier état mergé.

Conséquences fonctionnelles :

- La boucle PR n'est plus allongée par les e2e — preview se déploie, le dev itère.
- Plusieurs PRs peuvent être en cours simultanément sans se bloquer mutuellement
  sur les e2e.
- Prod est gated par des e2e solides, sans pour autant en faire un goulot
  d'étranglement dans le flow quotidien.
- Les e2e peuvent être plus exhaustifs (et donc plus lents) sans pénaliser la DX.

## Questions ouvertes

- **Alimentation de `dev`** : auto-merge de chaque PR mergée vers `dev` ? Une branche
  `dev` dédiée qu'on push manuellement ? Un déploiement à chaque merge sur `main`
  qui se nomme `dev` au lieu de `prod` (et `prod` n'est plus un envoi auto-magique
  mais une promotion explicite après validation `dev`) ?
- **Données** : `dev` partage-t-il la DB de prod ? Une copie ? Un seed dédié ?
  Probable : DB séparée par environnement (cohérent avec la convention
  `<projet>_<env>` actuelle).
- **Que se passe-t-il si les e2e contre `dev` échouent** ? Bloque-t-on tous les
  merges suivants (boucle de réparation prioritaire) ou seulement la promotion vers
  prod (les nouveaux merges continuent d'alimenter `dev`, on répare en parallèle) ?
- **Coût infra** : un environnement de plus à maintenir par projet — chaque projet
  qui souhaite cette pipeline doit-il en hériter automatiquement ou opt-in via
  `lab.json` ?
- **Durée acceptable des e2e** — au-delà de quoi ça redevient gênant même en async ?

## Triggers pour revisiter

- **Quand on ajoute Playwright à un 2e projet** (probable sur un futur projet admin
  ou sur `ressources` quand son périmètre se précise). À ce moment, deux
  consommateurs concrets permettent de modeler l'API de `e2e/` sans abstraire à
  l'aveugle (règle des trois).
- **Quand une régression livrée en prod fait mal** — signal qu'il faut un gate plus
  solide entre merge et prod, et on accélère le pipeline dev→prod gated.

## Décision actuelle (28/05/2026)

Backlog. Playwright reste en `devDep` dans `contentos` pour son smoke e2e d'auth.
Pas d'over-engineering tant qu'on a un seul consommateur.
