---
name: lab-secret
description: Gérer les secrets de l'atelier — secrets chiffrés age par scope (global / sysadmin / projet), une seule clé LAB_SECRETS_KEY, injectés au déploiement. Charge cette skill dès qu'une demande touche un secret, une clé API, une variable sensible d'un projet de l'atelier.
---

# lab-secret — gestionnaire de secrets de l'atelier

Les secrets de l'atelier vivent dans des fichiers `.env` **chiffrés avec age** (armure ASCII)
versionnés dans le repo (`secrets/`). Une seule clé privée age, **`LAB_SECRETS_KEY`**, chiffre
et déchiffre tout. Pas de service à faire tourner, pas de surface réseau. La CLI est en pur JS
(`age-encryption`) → tourne partout où il y a `node` (Claude cloud, local, `lab`).

## Pré-requis : la clé dans l'environnement

`LAB_SECRETS_KEY` (une identité age `AGE-SECRET-KEY-1…`) **doit être dans l'environnement**.
En session locale, elle est dans le `.env` gitignoré du repo :

```bash
set -a; . ./.env; set +a    # charge LAB_SECRETS_KEY depuis .env
```

En Claude cloud, elle est déjà dans l'environnement. Sans elle, toute commande échoue.
La clé n'est **jamais** committée ni affichée dans le chat.

## Scopes

`scope` détermine le fichier chiffré ciblé :

| scope | fichier | usage |
|---|---|---|
| `global` | `secrets/global.env.age` | secrets partagés par **tous** les projets |
| `sysadmin` | `secrets/sysadmin.env.age` | secrets opérateur — **jamais injectés** dans un projet |
| `<projet>` | `secrets/projects/<projet>.env.age` | secrets propres à un projet |

## Commandes

Invocation via le lanceur (installe les deps au besoin) :

```bash
bin/lab-secret <set|get|list|rm> [args…]
```

ou directement :

```bash
cd tools/lab-secret && (npm ci 2>/dev/null || npm install) >/dev/null && node lab-secret.mjs <cmd>
```

| Commande | Rôle |
|---|---|
| `set <scope> <NAME>` | upsert un secret — **valeur lue sur stdin** ; déchiffre → set → rechiffre → `git add` + `git commit` (message `🔐 secret: set <scope>/<NAME>`, jamais la valeur). Pas de push. |
| `get <scope> <NAME>` | imprime **uniquement la valeur** (pour capture). Sort en code 1 si absent. |
| `list [scope]` | liste les **NOMS** (jamais les valeurs). Sans scope : tous les scopes. |
| `rm <scope> <NAME>` | supprime le secret, rechiffre, commit. |

`NAME` doit être un identifiant d'env shell (`[A-Za-z_][A-Za-z0-9_]*`).

## Ajouter une clé sans qu'elle transite en clair (procédure stdin)

La valeur passe par **stdin**, jamais en argument (sinon elle apparaît dans l'historique
shell / le chat). Dans un terminal :

```bash
# saisie interactive : tape la valeur, Entrée, puis Ctrl-D
bin/lab-secret set <projet> MA_CLE_API

# ou, depuis une source non interactive (sans trace dans l'historique) :
printf '%s' 'la-valeur' | bin/lab-secret set <projet> MA_CLE_API
```

Le secret est chiffré et committé sur la **branche courante** (jamais de push automatique).

## Déployer le secret

Après un `set`, le secret est chiffré et committé localement. Pour qu'il soit injecté dans le
projet déployé sur `lab`, il faut **pousser / merger** la branche : la CI copie les `*.env.age`
pertinents sur `lab`, et `deploy.sh` déchiffre `global` + `<projet>` avec la clé posée sur `lab`
et les injecte dans le `.env` du conteneur. `sysadmin` n'est **jamais** injecté.

## Garde-fous

- La valeur d'un secret n'est imprimée **que** par `get`. `list` ne montre que des noms.
- Aucun clair n'est jamais écrit sur disque : le déchiffrement se fait en mémoire.
- `LAB_SECRETS_KEY` n'est jamais committée ni loggée.
