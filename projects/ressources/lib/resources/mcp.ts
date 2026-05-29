import { z, type ZodRawShape } from "zod"
import { moduleInputSchema, pageInputSchema } from "./module-input"
import * as service from "./service"
import type { OpRef } from "./service"
import * as stats from "@/lib/stats/queries"

export type ToolExtra = { authInfo?: { extra?: Record<string, unknown> } }

export type ToolServer = {
  tool: (
    name: string,
    description: string,
    shape: ZodRawShape,
    cb: (args: never, extra: never) => unknown,
  ) => void
}

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
}

function errorResult(message: string) {
  return { content: [{ type: "text" as const, text: `Erreur: ${message}` }], isError: true }
}

// L'opérateur est résolu par le contrat interne (depuis le userId transmis par la
// passerelle) et déposé dans authInfo.extra. Chaque outil n'opère donc que sur les
// ressources de cet opérateur (ADR-0002).
function operatorFrom(extra: ToolExtra): OpRef {
  const e = extra.authInfo?.extra
  const id = e?.operatorId
  const handle = e?.operatorHandle
  if (typeof id !== "string" || typeof handle !== "string") {
    throw new Error("Opérateur manquant dans le token")
  }
  return { id, handle }
}

export function registerTools(server: ToolServer) {
  const add = <S extends z.ZodObject<ZodRawShape>>(
    name: string,
    description: string,
    schema: S,
    run: (op: OpRef, args: z.infer<S>) => Promise<unknown>,
  ) => {
    const handler = async (args: z.infer<S>, extra: ToolExtra) => {
      try {
        const op = operatorFrom(extra)
        return json(await run(op, args))
      } catch (e) {
        return errorResult((e as Error).message)
      }
    }
    server.tool(name, description, schema.shape, handler as (args: never, extra: never) => unknown)
  }

  add(
    "list_resources",
    "Liste tes ressources (slug, titre, visibilité, publication, mise en avant).",
    z.object({}),
    (op) => service.listResources(op.id),
  )

  add(
    "get_resource",
    "Renvoie l'arborescence complète d'une ressource (pages par chemin, modules par id, et sections avec ancre + href prêt à coller pour lier des sous-sections). Le champ `url` est le lien public (/o/<handle>/r/<slug>) ; pour le diffuser avec suivi de provenance, génère un lien tagué via `tracking_link`.",
    z.object({ slug: z.string() }),
    (op, { slug }) => service.getResource(op, slug),
  )

  add(
    "get_outline",
    "Carte des liens d'une ressource : toutes les pages et leurs sections (titre, ancre, href du type /o/<handle>/r/<slug>/chemin#ancre), SANS le contenu des modules. Utile pour créer des liens vers des sous-sections (ex. sommaire global).",
    z.object({ slug: z.string() }),
    (op, { slug }) => service.getOutline(op, slug),
  )

  add(
    "create_resource",
    "Crée une ressource (rattachée à toi). Petite/moyenne ressource : passe toute l'arborescence ici (rootModules, pages[] imbriquées avec leurs modules et children). GROSSE ressource (beaucoup de pages/modules) : crée seulement la coquille (titre + page racine légère), puis remplis page par page avec add_page(modules) / add_modules — un appel par page, pour éviter un payload géant. Renvoie { id, slug, url }. Pour diffuser ce `url` avec suivi de provenance (LinkedIn, newsletter…), génère un lien tagué via `tracking_link`.",
    z.object({
      slug: z.string().optional(),
      title: z.string(),
      description: z.string().optional(),
      visibility: z.enum(["public", "private"]).optional(),
      featured: z.boolean().optional(),
      published: z.boolean().optional(),
      rootTitle: z.string().optional().describe("Titre de la page racine (défaut: title)."),
      rootModules: z
        .array(moduleInputSchema)
        .optional()
        .describe("Modules de la page racine, dans l'ordre."),
      pages: z
        .array(pageInputSchema)
        .optional()
        .describe(
          "Arborescence complète des sous-pages. Chaque page = { slug, title, modules?, children? } ; children est récursif. Fournis tout l'arbre d'un coup.",
        ),
    }),
    (op, args) => service.createResource(op, args),
  )

  add(
    "update_resource",
    "Met à jour les métadonnées d'une ressource (titre, description, cover, visibilité, featured, published).",
    z.object({
      slug: z.string(),
      patch: z.object({
        title: z.string().optional(),
        description: z.string().optional(),
        coverImageUrl: z.string().url().optional(),
        visibility: z.enum(["public", "private"]).optional(),
        featured: z.boolean().optional(),
        published: z.boolean().optional(),
      }),
    }),
    (op, { slug, patch }) => service.updateResource(op, slug, patch),
  )

  add("delete_resource", "Supprime une ressource et tout son contenu.", z.object({ slug: z.string() }), (op, { slug }) =>
    service.deleteResource(op.id, slug),
  )

  add(
    "add_page",
    "Ajoute une sous-page sous parentPath (vide = racine), AVEC ses modules en un seul appel. Pour une grosse ressource : un appel add_page par page (1 appel = 1 page).",
    z.object({
      resourceSlug: z.string(),
      parentPath: z.array(z.string()).optional(),
      slug: z.string(),
      title: z.string(),
      position: z.number().int().optional(),
      modules: z
        .array(moduleInputSchema)
        .optional()
        .describe("Modules de la page, dans l'ordre — créés avec la page."),
    }),
    (op, args) => service.addPage(op.id, args),
  )

  add(
    "add_modules",
    "Ajoute un lot de modules à la FIN d'une page existante, en un appel. Pour compléter la page racine après create_resource, ou découper une page très chargée en plusieurs appels.",
    z.object({
      resourceSlug: z.string(),
      path: z.array(z.string()),
      modules: z.array(moduleInputSchema),
    }),
    (op, args) => service.addModules(op.id, args),
  )

  add(
    "update_page",
    "Modifie le titre et/ou le slug d'une page (le slug racine est immuable).",
    z.object({
      resourceSlug: z.string(),
      path: z.array(z.string()),
      patch: z.object({ title: z.string().optional(), slug: z.string().optional() }),
    }),
    (op, args) => service.updatePage(op.id, args),
  )

  add(
    "delete_page",
    "Supprime une page et son contenu (pas la racine).",
    z.object({ resourceSlug: z.string(), path: z.array(z.string()) }),
    (op, args) => service.deletePage(op.id, args),
  )

  add(
    "move_page",
    "Déplace une page sous newParentPath (vide = racine) à une position donnée.",
    z.object({
      resourceSlug: z.string(),
      path: z.array(z.string()),
      newParentPath: z.array(z.string()).optional(),
      position: z.number().int().optional(),
    }),
    (op, args) => service.movePage(op.id, args),
  )

  add(
    "reorder_pages",
    "Réordonne les sous-pages d'un même parent : fournis TOUS leurs ids (via get_resource) dans l'ordre voulu. Les positions sont réaffectées proprement (= index). Préférer à move_page pour un simple réordre.",
    z.object({
      orderedPageIds: z.array(z.string()).describe("Ids des pages d'un même parent, dans l'ordre voulu."),
    }),
    (op, args) => service.reorderPages(op.id, args.orderedPageIds),
  )

  add(
    "add_module",
    "Ajoute un module à une page. Renvoie { id }.",
    z.object({
      resourceSlug: z.string(),
      path: z.array(z.string()),
      module: moduleInputSchema,
      position: z.number().int().optional(),
    }),
    (op, args) => service.addModule(op.id, args),
  )

  add(
    "update_module",
    "Met à jour le contenu et/ou la position d'un module (le contenu est validé selon le type existant).",
    z.object({ id: z.string(), content: z.unknown().optional(), position: z.number().int().optional() }),
    (op, args) => service.updateModule(op.id, args),
  )

  add("delete_module", "Supprime un module.", z.object({ id: z.string() }), (op, args) =>
    service.deleteModule(op.id, args),
  )

  add(
    "reorder_modules",
    "Réordonne les modules : position = index dans la liste fournie.",
    z.object({ orderedModuleIds: z.array(z.string()) }),
    (op, args) => service.reorderModules(op.id, args),
  )

  add(
    "grant_access",
    "Autorise un email à accéder à une ressource privée.",
    z.object({ resourceSlug: z.string(), email: z.string().email() }),
    (op, args) => service.grantAccess(op.id, args),
  )

  add(
    "revoke_access",
    "Retire l'accès d'un email à une ressource privée.",
    z.object({ resourceSlug: z.string(), email: z.string().email() }),
    (op, args) => service.revokeAccess(op.id, args),
  )

  add(
    "get_stats",
    "Statistiques de vue et de provenance. Avec slug : détail d'une ressource (vues, visiteurs uniques, impressions gate, par page, utilisateurs débloqués, ventilation par source UTM). Sans slug : vue d'ensemble (par ressource + top sources d'acquisition).",
    z.object({ slug: z.string().optional(), sinceDays: z.number().int().positive().optional() }),
    (op, args) => (args.slug ? stats.getResourceStats(op.id, args.slug, args.sinceDays) : stats.getStatsOverview(op.id)),
  )

  add(
    "tracking_link",
    "Construit un lien de partage tagué UTM vers une ressource, pour savoir d'où viennent les visiteurs. Convention : `source` = la plateforme (linkedin, newsletter, twitter), `campaign` = le contenu précis (ex. post-automatisation, pour distinguer plusieurs posts pointant vers la même ressource), `medium` = le canal (social, email). `path` cible une sous-page (tableau de slugs, défaut = page racine). Les valeurs sont normalisées (minuscules, ≤ 64). Renvoie { url }. La provenance remonte ensuite dans get_stats (top sources, utilisateurs gagnés).",
    z.object({
      slug: z.string(),
      source: z.string().describe("Plateforme d'origine du clic (= utm_source) : linkedin, newsletter, twitter…"),
      medium: z.string().optional().describe("Canal (= utm_medium) : social, email…"),
      campaign: z.string().optional().describe("Contenu précis (= utm_campaign) : nom du post/de la campagne."),
      path: z
        .array(z.string())
        .optional()
        .describe("Chemin de sous-page (tableau de slugs depuis la racine) ; défaut = page racine."),
    }),
    (op, args) => service.trackingLink(op, args),
  )
}
