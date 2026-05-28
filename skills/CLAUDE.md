# skills — hub central des skills agentiques

Point d'entrée unique pour découvrir et installer les **skills agentiques** de la suite de
tools de l'atelier (contentos, ressources, media). Chaque skill est un cerveau / mode d'emploi
embarqué dans un agent Claude pour piloter le tool correspondant via MCP.

**Prod** : `https://skills.lab.avqn.ch`.

## Structure

```
skills/
├── lab.json                       db + email (auth OTP only)
├── src/
│   ├── app/
│   │   ├── page.tsx               liste publique des skills (lecture des manifests)
│   │   ├── sign-in/page.tsx       OTP par email
│   │   └── api/
│   │       ├── auth/[...all]      BetterAuth
│   │       └── skills/[name]/download   zip à la volée (auth requis)
│   ├── lib/
│   │   ├── skills-fs.ts           lecture/listing des skills + manifestes
│   │   ├── auth.ts / auth-client.ts   BetterAuth (OTP)
│   │   └── email.ts               Resend (envoi du code)
│   └── db/                        tables BetterAuth
└── skills/                        ← source de vérité des skills
    ├── content-os-redaction/
    ├── creer-une-ressource/
    ├── creer-un-visuel/
    └── suite-avqn/
```

## Anatomie d'un skill

Chaque dossier `skills/<nom>/` contient :

```
manifest.json     # méta + version (cf. ci-dessous)
SKILL.md          # entrée du skill avec frontmatter YAML standard Claude
...               # fichiers du skill (production/, references/, etc.)
```

`manifest.json` :

```json
{
  "name": "content-os-redaction",
  "tool": "contentos",
  "version": 1,
  "tagline": "Cerveau éditorial — écrire et relire dans la voix de Manu.",
  "description": "Court paragraphe affiché sur la page de liste.",
  "requires_mcp": ["contentos", "media"],
  "latest_changes": "Optionnel — 1-2 phrases sur ce qui change dans cette version."
}
```

- `tool` : `contentos` | `ressources` | `media` | `suite` (meta-skill). Sert au tri.
- `version` : entier. Le zip téléchargé prend le nom `<name>-v<version>.zip`.

## Publier une nouvelle version d'un skill

1. Éditer les fichiers du skill (`SKILL.md`, sous-dossiers).
2. **Bump** `version` dans `manifest.json` (`1` → `2` → `3`…).
3. Mettre à jour `latest_changes` (court).
4. Commit + push sur une branche → merge de la PR → la nouvelle version est en ligne sur
   `skills.lab.avqn.ch`. Pas d'historique : seule la dernière version est servie.

## Ajouter un skill

1. Créer un dossier `skills/skills/<nom-skill>/` avec `manifest.json` + `SKILL.md` (et
   éventuelles sous-arbo).
2. La page d'accueil le découvre automatiquement (lecture des dossiers + manifestes).
3. Push + merge — c'est en ligne.

## Auth

OTP par email (BetterAuth + Resend), même pattern que `contentos` / `ressources` / `media`.
Code preview `000000` en preview. En prod : email réel via Resend (clé tirée du store via
`/lab-secret`, scope `skills`).

## Standalone runtime

Les fichiers `skills/` doivent être présents dans le conteneur runtime. `next.config.ts` ajoute
`outputFileTracingIncludes` pour `/` et `/api/skills/[name]/download`. Si on ajoute une route
qui touche au dossier, l'inclure aussi.

## Spec / plan

- Spec : `../docs/superpowers/specs/2026-05-28-skills-hub-design.md`.
- Plan : `../docs/superpowers/plans/2026-05-28-skills-hub.md`.

## Déployer

`git push` sur une branche → preview `https://skills-<branche>.lab.avqn.ch`. Merge de la PR
→ prod `https://skills.lab.avqn.ch`. Jamais de commit sur `main`.
