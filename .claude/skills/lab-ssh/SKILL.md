---
name: lab-ssh
description: Exécuter une commande sur le serveur lab (voir les logs d'un projet, lister les conteneurs, diagnostiquer) en autonomie. Charge cette skill dès qu'une demande nécessite un accès SSH au serveur lab.
---

# lab-ssh — exécuter une commande sur le serveur lab

`lab-ssh` ouvre une connexion SSH vers le serveur `lab` et y exécute la commande passée en
argument. L'atelier est **autonome** : la clé SSH dédiée de l'agent est récupérée (chiffrée)
depuis le store de secrets (scope `sysadmin`, clé `LAB_SSH_KEY_B64`), déchiffrée en mémoire,
écrite dans un fichier temporaire le temps de la connexion, puis **effacée** (trap `EXIT`).

## Transport

Le SSH passe par un **tunnel WebSocket sur 443** (`wss://ops.contentos.ch`) quand le client
`wstunnel` et le secret `sysadmin/WSTUNNEL_PATH` sont présents — voie utilisable là où le
port 22 sortant est fermé (sessions cloud). Sinon, SSH direct sur le port 22. Le choix est
automatique ; l'usage et la clé sont identiques dans les deux cas. Le tunnel est verrouillé :
il ne route que vers le sshd de l'hôte et n'accepte que le bon path secret.

## Pré-requis

`LAB_SECRETS_KEY` doit être dans l'environnement (elle déverrouille le store de secrets dont la
clé SSH et le secret de tunnel sont tirés). En local : `set -a; . ./.env; set +a`. En Claude
cloud, elle y est déjà. Sans elle, `lab-ssh` échoue avec « LAB_SECRETS_KEY manquant ou clé absente ».

## Usage

```bash
bin/lab-ssh <commande à exécuter sur lab>
```

La commande est passée telle quelle au shell distant (passthrough pur des arguments).

## Exemples

```bash
# Logs d'un projet (env = prod ou <branche>)
bin/lab-ssh "docker logs --tail 50 <projet>-<env>-app-1"

# Conteneurs en cours
bin/lab-ssh "docker ps"

# Espace disque
bin/lab-ssh "df -h"
```

## Tier

Accès serveur ad hoc, en **lecture surtout** (diagnostic, logs, inspection). Toute action
destructive sur le serveur reste exceptionnelle et doit être explicite.
