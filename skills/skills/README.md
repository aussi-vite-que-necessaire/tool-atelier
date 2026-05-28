# Skills

Source de vérité des skills agentiques de la suite AVQN. Chaque dossier contient un
`manifest.json` + `SKILL.md` (et éventuelles sous-arbo). Le hub
(`https://skills.lab.avqn.ch`) les liste et les sert en zip versionné.

## Skills publiés

| Skill | Tool | Rôle |
|---|---|---|
| [`suite-avqn`](./suite-avqn/) | — (méta) | Orchestrateur des workflows croisés sur la suite. |
| [`creer-une-ressource`](./creer-une-ressource/) | `ressources` | Concevoir et publier une ressource / lead magnet AVQN. |
| [`content-os-redaction`](./content-os-redaction/) | `contentos` | Cerveau éditorial — écrire et relire dans la voix de Manu, avec son visuel. |
| [`creer-un-visuel`](./creer-un-visuel/) | `media` | Mode d'emploi du service media — image, template, PDF. |

## Versionner

Bump `version` dans le `manifest.json` du skill modifié, mets à jour `latest_changes`, push.
Le zip prend automatiquement le nom `<skill>-v<version>.zip`.
