# Skills

Source de vérité des skills agentiques de la suite AVQN. Chaque dossier contient un
`manifest.json` + `SKILL.md` (et éventuelles sous-arbo). Le hub
(`https://skills.contentos.ch`) les liste et les sert en zip versionné.

## Skills publiés

| Skill | Tool | Rôle |
|---|---|---|
| [`contentos`](./contentos/) | `contentos` | Workflow unique de rédaction piloté par l'agent — brainstorm → format/voix → fond → voix → cosmétique → post. |

> Les anciens skills (`suite-avqn`, `creer-une-ressource`, `content-os-redaction`,
> `creer-un-visuel`) ont été retirés au profit du skill unifié `contentos`. Leur contenu
> reste accessible dans l'historique git.

## Versionner

Bump `version` dans le `manifest.json` du skill modifié, mets à jour `latest_changes`, push.
Le zip prend automatiquement le nom `<skill>-v<version>.zip`.
