# ContentOS — Roadmap & état

Vue d'ensemble vivante du projet, point d'entrée pour un nouveau contexte.
Vision & architecture détaillées : `docs/superpowers/specs/2026-05-25-direction-os-pour-agents-design.md`.
Les specs/plans par chantier (trace historique, spec-1 → spec-21) vivent dans `docs/superpowers/{specs,plans}/`.

## En un mot

ContentOS = plateforme SaaS **« OS pour agents »** : détient l'**état** (idées, posts, médias, calendrier, marque, connexions sociales) + l'**UI de contrôle humain** + une **surface de tools** (MCP). Le **cerveau** (rédaction, idéation) vit dans des **skills externes** interchangeables. Trois dépôts :

- **`content-os-v2`** — la plateforme (état + UI + tools).
- **`media-manager`** (worker Cloudflare `image-studio`) — le moteur média : calcul (Gemini, HTML→PNG) + stockage, exposé en API `/v1` à clé de service.
- **`content-os-skills`** — les skills agents (`content-os-redaction`).

## ✅ Livré

- Pipeline **idée → post → publication LinkedIn** (+ calendrier, carrousels, vidéo).
- Visuels : **templates de marque** (Handlebars→PNG) + **génération IA** (Gemini) + galerie.
- **Skill de rédaction** `content-os-redaction` (spec-20) — preuve du modèle « OS pour agents », validée en réel.
- **Rédaction in-app retirée** (`generate_post` + clé Anthropic) ; création de post humaine via « Créer un post ».
- **Délégation média** au media-engine (spec-21) — ContentOS sans R2 ni clés IA ; moteur **déployé**, 4 chemins validés en réel (génération, édition, rendu HTML, upload/PDF).
- **Connecteur MCP distant + OAuth** (spec-22) — surface de tools installable dans n'importe quel agent (Claude desktop/mobile, GPT, Gemini) via OAuth (better-auth) ; découverte `.well-known`, DCR, login magic-link. **Déployé en prod** sur `contentos.avqn.ch`.
- **CI verte** (unit / integration / worker / e2e).

## 🔜 Prochain — planifié (ordre proposé)

1. **Déclinaisons GPT / Gemini du skill.** De simples emballages d'instructions par-dessus le même MCP (action GPT, gem Gemini), maintenant que le connecteur distant est en place.
2. **Multi-plateformes sociales.** Publication au-delà de LinkedIn (X, Instagram, Threads…) : OAuth + adaptateurs de publication par plateforme.

## 🌱 Backlog (à spécifier quand ça devient prioritaire)

- **Nouveaux writing-templates** (types : anecdote, tutoriel, célébration) — le skill est générique, il ne manque que les templates (entités ContentOS).
- **Analytics** (performance des posts publiés).
- **Polish média** : URLs signées (contenu privé), scoping par tenant dans le moteur, migration des binaires R2 historiques, parsing des dimensions à l'upload dans le stub filesystem.

## Notes d'exploitation

- **Déploiement / sysadmin** : géré côté assistant ; Manu teste.
- **Prod** : `contentos.avqn.ch` (Coolify, serveur Prod). Repo `aussi-vite-que-necessaire/product-content-os`, déploiement Docker Compose (web + worker + redis). Base `contentos` sur le Postgres centralisé. Secrets dans Bitwarden (`CONTENTOS_*`), poussés en variables Coolify. Migrations jouées dans le conteneur worker.
- **media-engine** : worker `image-studio` (Cloudflare). Secret `MEDIA_ENGINE_SERVICE_KEY` posé des deux côtés ; `MEDIA_ENGINE_URL` dans le `.env` ContentOS.
- **Stub média** (`CONTENT_OS_MEDIA_STUB`) : `0` = vrai moteur · `1` = in-memory (unit/integration) · `fs` = filesystem + route `/api/media-stub` (E2E navigateur).
