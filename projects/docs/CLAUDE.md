# docs

**Espace public de lecture** de la suite **contentos** (`https://docs.contentos.ch`).
C'est la moitié « consommation » de la plateforme de ressources : elle sert au public les
espaces opérateur (`/o/<handle>`), le reader SSR brutaliste des ressources
(`/o/<handle>/r/<slug>`), et les pages du **lecteur** (bibliothèque, compte). L'autre moitié,
l'**administration** (édition des ressources, MCP, stats), vit dans le projet **`ressources`**.

> Découpage : `ressources` = outil d'admin (login **opérateur**, propriétaire du schéma +
> migrations + MCP) ; `docs` = public (login **lecteur/audience**). Les deux partagent **la même
> base** (cf. *Backend partagé* plus bas). Voir l'ADR-0002
> (`../../docs/decisions/0002-comptes-operateur-audience-tenancy.md`).

## Stack

**Next.js 16** (App Router, sortie `standalone`) + **Drizzle ORM** (driver `postgres`,
postgres-js, lecture) + **Tailwind 4** + **Geist**. Style **brutaliste éditorial** (papier/encre
+ accent, ombres portées) défini dans `app/globals.css`. Reader markdown via react-markdown
(GFM, sanitize, slug) + Shiki.

```
docs/
├── Dockerfile        multi-stage deps → build → runner (standalone, non-root, :8080) — pas de migrate/seed
├── compose.yml       service app sur le réseau lab (alias ${UPSTREAM}, image ${IMAGE})
├── lab.json          description + db:{shared:"ressources"} (backend partagé, ni migrate ni seed)
├── middleware.ts     cookie de tracking sur /o/* ; SSO gate sur /compte /bibliotheque
├── app/              landing /, espaces /o/<handle>, reader, /bibliotheque, /compte, /connexion, healthz
├── db/ lib/ components/  schéma (copie lecture seule), accès données, helpers auth, UI publique
```

## Backend partagé — RÈGLE

`docs` **ne possède pas** le schéma : pas de dossier `drizzle/`, pas de migrations, pas de seed.
La base est celle de `ressources` (`ressources_<env>`), injectée par la plateforme grâce à
`lab.json` :

```json
{ "db": { "shared": "ressources" } }
```

`deploy.sh`/`dev-db.sh` reconnaissent cette forme : ils pointent `DATABASE_URL` sur la base de
`ressources` **sans rien créer ni migrer**. `ressources` reste seul propriétaire du schéma.

### Contrat de données synchronisé (ne pas éditer à la main)

`db/schema/` et `db/index.ts` sont une **copie générée** depuis `ressources` — la source de
vérité. Les deux apps tapant la même base, leurs définitions de schéma doivent rester
identiques. La synchro est faite par **`../../scripts/sync-shared.sh`** et **vérifiée en CI**
(`git diff --exit-code`) : éditer la copie ici (ou oublier de resync après avoir touché le
schéma côté `ressources`) **casse le build**. Pour faire évoluer le schéma : on l'édite dans
`ressources`, on génère la migration là-bas, puis `scripts/sync-shared.sh`. Le **reste** de la
lib/des composants appartient à `docs` et peut diverger librement de `ressources`.

## Authentification — SSO contentos (lecteur)

Auth déléguée à `https://auth.contentos.ch` (cookie cross-subdomain `.contentos.ch`). Helpers
sous `lib/auth/` :

- `lib/auth/session.ts` : `getSession()`, `requireSession(target?)`, `getUserId()`,
  `requireUserId(target?)`, `signInUrl(target?)`, `signOutUrl()`. **Même chemin en preview
  qu'en prod** (connexion réelle). En preview, `loginRedirect` auto-connecte **user3**
  (`preview-aud-3`, persona **audience**, abonné aux espaces `/o/user1` + `/o/user2`).
- `lib/auth/operator.ts` : `operatorByHandle(handle)`, `getOperatorById(id)` — **lecture seule**
  ici (résoudre l'espace `/o/<handle>`). Pas d'`requireOperator` côté public (l'admin est dans
  `ressources`).
- `app/connexion/page.tsx` : redirige vers le SSO via `loginRedirect` (en preview : auto-login
  user3, ou chooser si le marqueur de logout est posé).

Un lecteur qui consulte un espace devient l'**audience** de l'opérateur (`audience_members`) et
peut s'abonner (`subscriptions`) — câblé dans le reader (`app/(public)/.../render.tsx`).

## Déployer

`git push` sur une branche → preview `https://docs-<branche>.preview.contentos.ch`. Merge de la
PR → prod `https://docs.contentos.ch`. Jamais de commit direct sur `main`. La CI build l'image
(`docker build`) → GHCR → pull sur `lab` ; le serveur ne build jamais. La preview lit
`ressources_<branche>` : pour voir des données, la branche doit aussi déployer `ressources`
(et celui-ci doit avoir seedé la base — cf. *Vérifier* / gap de seed preview).

## Données & secrets

`APP_URL` est auto-injecté (origine publique). `DATABASE_URL` pointe sur la base partagée de
`ressources` (cf. *Backend partagé*). Secrets du coffre `docs` (`/lab-secret`, scope `docs`),
déchiffrés + injectés par `deploy.sh` :

- `AUTH_URL` — facultatif, défaut `https://auth.contentos.ch`.

## Vérifier visuellement (dev)

```bash
scripts/dev-db.sh up ressources   # crée+migre ressources_dev (puis: seeder la démo, cf. ci-dessous)
scripts/dev-db.sh up docs         # pointe le .env de docs sur ressources_dev (ne crée rien)
(cd projects/docs && npm run dev)  # http://localhost:3000 — /, /o/demo, reader
```

`docs` lit la base de `ressources` : sans données seedées dans `ressources_dev`, `/o/user1`
renvoie 404. Seeder une fois (tsx présent en dev) :
`(cd projects/ressources && DATABASE_URL=postgres://app:app@127.0.0.1:5432/ressources_dev npx tsx db/seed.ts)`
→ crée les espaces `/o/user1` et `/o/user2` + l'abonnement de user3. En preview, la connexion
est réelle : auto-login user3 (audience), déconnexion → chooser user1/2/3 (code `000000`).
