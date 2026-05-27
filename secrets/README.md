# secrets/ — store chiffré de l'atelier

Les secrets de l'atelier vivent ici, **chiffrés avec [age](https://age-encryption.org/)**
(armure ASCII) et versionnés dans le repo. Une seule clé privée age,
`LAB_SECRETS_KEY`, chiffre et déchiffre tout.

```
secrets/
  recipients.txt        # clé publique age (en clair, non sensible) — destinataire du chiffrement
  global.env.age        # secrets partagés par TOUS les projets
  sysadmin.env.age      # secrets opérateur — JAMAIS injectés dans un projet
  projects/
    <projet>.env.age    # secrets d'un projet
```

## Règles

- **Ne jamais éditer un `*.env.age` à la main.** Ce sont des fichiers chiffrés.
  On les gère uniquement via la CLI `lab-secret` (voir la skill `/lab-secret`).
- Les `*.env.age` **sont** committés (ils sont chiffrés) ; leurs valeurs n'apparaissent
  jamais en clair dans git. L'historique montre *qu'*un secret a changé, pas sa valeur.
- `recipients.txt` (clé publique) est committé ; il n'est pas sensible.
- La clé privée `LAB_SECRETS_KEY` n'est **jamais** committée. Elle vit dans le `.env`
  gitignoré du repo, dans l'environnement Claude cloud, et sur `lab` (`/opt/lab/secrets-key`).

## Ajouter / lire un secret

```bash
# ajouter (valeur lue sur stdin, jamais en argument)
printf '%s' 'la-valeur' | bin/lab-secret set <scope> NOM_DU_SECRET
# lister les noms (jamais les valeurs)
bin/lab-secret list <scope>
# lire une valeur
bin/lab-secret get <scope> NOM_DU_SECRET
```

`scope` ∈ `global` | `sysadmin` | `<projet>`.
