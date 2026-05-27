# lab-secret — gestionnaire de secrets de l'atelier — design

**Statut :** validé — implémentation en cours.
**Portée :** un gestionnaire de secrets **maison, autonome**, propre à l'atelier. Sans frontend,
sans service à faire tourner. Une seule variable d'environnement déverrouille tout. Remplace le
mécanisme intérimaire de secrets et rend l'atelier **complètement autonome**.

---

## 1. Modèle crypto — `age` (une seule clé)

Une paire de clés `age` (X25519) générée une fois.
- **Clé privée** = la variable d'env unique **`LAB_SECRETS_KEY`** (format `AGE-SECRET-KEY-1…`),
  présente en **trois endroits de confiance** : le `.env` du repo (gitignoré), l'environnement
  Claude cloud, et le VPS `lab`. Avec elle on **chiffre et déchiffre** tout.
- **Clé publique** (`age1…`) committée dans `secrets/recipients.txt` (sert de destinataire au
  chiffrement ; non sensible).

Pas de crypto maison : `age` est moderne et éprouvé. Sécurité « lab » satisfaisante (chiffré au
repos, une clé maître, aucune surface réseau).

## 2. Stockage — fichiers chiffrés versionnés (dans le repo)

```
secrets/
  recipients.txt          # clé publique age (en clair, non sensible)
  global.env.age          # secrets partagés par TOUS les projets
  sysadmin.env.age        # secrets opérateur (toi/moi) — JAMAIS injectés dans un projet
  projects/
    <projet>.env.age      # secrets d'un projet
```
Chaque `*.env.age` chiffre un contenu format `.env` (`KEY=VALUE` par ligne). **Les valeurs ne
sont jamais en clair dans git** ; l'historique git montre *qu'*un secret a changé, pas sa valeur.

## 3. L'outil `lab-secret` (CLI Node portable + skill)

CLI Node utilisant une implémentation **age en pur JS** (`age-encryption`) → tourne partout où il
y a `node` (Claude cloud, local, lab) sans binaire système. Lit `LAB_SECRETS_KEY` dans l'env.

| Commande | Rôle |
|---|---|
| `lab-secret set <scope> <NAME>` | upsert un secret ; **valeur lue sur stdin** (jamais en argument/chat). Déchiffre → set → rechiffre → commit. |
| `lab-secret get <scope> <NAME>` | imprime la valeur (et rien d'autre). |
| `lab-secret list [scope]` | liste les **noms** (jamais les valeurs), par scope. |
| `lab-secret rm <scope> <NAME>` | supprime un secret. |

`scope` ∈ `global` | `sysadmin` | `<projet>`. Une **skill** `/lab-secret` documente l'usage.

## 4. Intégration `deploy.sh` (remplace `/opt/lab/secrets/<projet>.env`)

Au déploiement du projet `X` (sur `lab`) : déchiffre `secrets/global.env.age` **+**
`secrets/projects/X.env.age` (s'il existe) avec la clé `LAB_SECRETS_KEY` posée sur `lab`, et
**injecte** le résultat dans le `.env` du conteneur (web + worker + migrate). `sysadmin` n'est
**jamais** injecté. Déchiffrement via le **binaire `age`** auto-installé sur `lab` (comme `jq`).
La CI copie les `*.env.age` pertinents vers `lab` (déjà chiffrés) ; la clé ne quitte jamais `lab`
+ l'env de gestion.

## 5. Ajouter une clé (toi → moi, zéro clair dans le chat)

Dans ton terminal : `lab-secret set <scope> <NAME>` → invite silencieuse (stdin) → tu colles la
valeur → chiffrée + commitée. Une commande. La valeur ne transite jamais par le chat.

## 6. Bootstrap (une fois)

`age-keygen` → clé privée posée à 3 endroits (repo `.env` gitignoré, env Claude cloud, `lab`
`/opt/lab/secrets-key`), clé publique committée. Procédure : la valeur est écrite dans le `.env`
local ; tu la copies-colles dans l'env Claude cloud depuis ce fichier (jamais via le chat).

## 7. Découplage de cockpit

Une fois `lab-secret` en place, l'atelier ne dépend plus de rien d'externe pour ses secrets. On
**retire toute dépendance et toute mention de cockpit** du repo de l'atelier (CLAUDE.md, skills,
`deploy.sh`, docs des projets). L'atelier devient **autonome** : ses secrets, son déploiement
(clé SSH dédiée déjà dans les secrets GitHub), son outillage. Il ne parle de cockpit **nulle part**.

## 8. Garde-fous

- La clé `LAB_SECRETS_KEY` n'est **jamais** committée ni affichée dans le chat (ajout par stdin).
- `lab-secret get`/`list` : ne jamais logguer une valeur (`list` = noms seuls).
- `sysadmin` jamais injecté dans un projet.
- Pas de service exposé → pas de surface d'attaque réseau.
- Migration : les secrets intérimaires actuels (`/opt/lab/secrets/*.env` sur lab) sont importés
  dans le store chiffré pour continuité (contentos/ressources continuent de tourner).
