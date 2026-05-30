import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { moduleInputSchema, pageInputSchema } from '@/lib/ressources/module-input';
import * as service from '@/lib/ressources/service';
import { ensureOperatorSettings, type OpRef } from '@/lib/ressources/settings';
import { getResourceStats, getStatsOverview } from '@/lib/ressources/stats-queries';
import { handle } from '../register';

// Les tools ressources reçoivent le userId (transmis par la passerelle). On résout
// l'opérateur (userId + handle public) à la volée — l'utilisateur EST l'opérateur,
// la ligne de réglages est provisionnée idempotemment.
async function op(userId: string): Promise<OpRef> {
  return ensureOperatorSettings(userId);
}

export function registerRessourcesTools(server: McpServer): void {
  server.registerTool(
    'list_resources',
    {
      title: 'Lister les ressources',
      description: 'Liste tes ressources (slug, titre, visibilité, publication, mise en avant).',
      inputSchema: {},
    },
    (_i, extra) => handle(extra, (u) => service.listResources(u)),
  );

  server.registerTool(
    'get_resource',
    {
      title: 'Lire une ressource',
      description:
        "Renvoie l'arborescence complète d'une ressource (pages par chemin, modules par id, sections avec ancre + href). Le champ `url` est le lien public (/docs/<handle>/r/<slug>) ; pour le diffuser avec suivi de provenance, génère un lien via `tracking_link`.",
      inputSchema: { slug: z.string() },
    },
    (input, extra) =>
      handle(extra, async (u) =>
        service.getResource(await op(u), (input as { slug: string }).slug),
      ),
  );

  server.registerTool(
    'get_outline',
    {
      title: 'Carte des liens',
      description:
        "Carte des liens d'une ressource : toutes les pages et leurs sections (titre, ancre, href), SANS le contenu des modules. Utile pour lier des sous-sections.",
      inputSchema: { slug: z.string() },
    },
    (input, extra) =>
      handle(extra, async (u) => service.getOutline(await op(u), (input as { slug: string }).slug)),
  );

  const createSchema = {
    slug: z.string().optional(),
    title: z.string(),
    description: z.string().optional(),
    visibility: z.enum(['public', 'private']).optional(),
    featured: z.boolean().optional(),
    published: z.boolean().optional(),
    rootTitle: z.string().optional().describe('Titre de la page racine (défaut: title).'),
    rootModules: z
      .array(moduleInputSchema)
      .optional()
      .describe("Modules de la page racine, dans l'ordre."),
    pages: z
      .array(pageInputSchema)
      .optional()
      .describe('Arborescence des sous-pages : { slug, title, modules?, children? } (récursif).'),
  };
  server.registerTool(
    'create_resource',
    {
      title: 'Créer une ressource',
      description:
        "Crée une ressource (rattachée à toi). Petite/moyenne : passe toute l'arborescence (rootModules, pages[] imbriquées). Grosse : crée la coquille puis remplis via add_page/add_modules. Renvoie { id, slug, url }.",
      inputSchema: createSchema,
    },
    (input, extra) =>
      handle(extra, async (u) =>
        service.createResource(await op(u), input as Parameters<typeof service.createResource>[1]),
      ),
  );

  server.registerTool(
    'update_resource',
    {
      title: 'Mettre à jour une ressource',
      description:
        "Met à jour les métadonnées d'une ressource (titre, description, cover, visibilité, featured, published).",
      inputSchema: {
        slug: z.string(),
        patch: z.object({
          title: z.string().optional(),
          description: z.string().optional(),
          coverImageUrl: z.string().url().optional(),
          visibility: z.enum(['public', 'private']).optional(),
          featured: z.boolean().optional(),
          published: z.boolean().optional(),
        }),
      },
    },
    (input, extra) =>
      handle(extra, async (u) => {
        const { slug, patch } = input as {
          slug: string;
          patch: Parameters<typeof service.updateResource>[2];
        };
        return service.updateResource(await op(u), slug, patch);
      }),
  );

  server.registerTool(
    'delete_resource',
    {
      title: 'Supprimer une ressource',
      description: 'Supprime une ressource et tout son contenu.',
      inputSchema: { slug: z.string() },
    },
    (input, extra) =>
      handle(extra, (u) => service.deleteResource(u, (input as { slug: string }).slug)),
  );

  server.registerTool(
    'add_page',
    {
      title: 'Ajouter une page',
      description:
        'Ajoute une sous-page sous parentPath (vide = racine), AVEC ses modules en un seul appel. Grosse ressource : un appel add_page par page.',
      inputSchema: {
        resourceSlug: z.string(),
        parentPath: z.array(z.string()).optional(),
        slug: z.string(),
        title: z.string(),
        position: z.number().int().optional(),
        modules: z.array(moduleInputSchema).optional(),
      },
    },
    (input, extra) =>
      handle(extra, (u) => service.addPage(u, input as Parameters<typeof service.addPage>[1])),
  );

  server.registerTool(
    'add_modules',
    {
      title: 'Ajouter des modules',
      description:
        "Ajoute un lot de modules à la FIN d'une page existante, en un appel. Pour compléter la page racine ou découper une page chargée.",
      inputSchema: {
        resourceSlug: z.string(),
        path: z.array(z.string()),
        modules: z.array(moduleInputSchema),
      },
    },
    (input, extra) =>
      handle(extra, (u) =>
        service.addModules(u, input as Parameters<typeof service.addModules>[1]),
      ),
  );

  server.registerTool(
    'update_page',
    {
      title: 'Modifier une page',
      description: 'Modifie le titre et/ou le slug d’une page (le slug racine est immuable).',
      inputSchema: {
        resourceSlug: z.string(),
        path: z.array(z.string()),
        patch: z.object({ title: z.string().optional(), slug: z.string().optional() }),
      },
    },
    (input, extra) =>
      handle(extra, (u) =>
        service.updatePage(u, input as Parameters<typeof service.updatePage>[1]),
      ),
  );

  server.registerTool(
    'delete_page',
    {
      title: 'Supprimer une page',
      description: 'Supprime une page et son contenu (pas la racine).',
      inputSchema: { resourceSlug: z.string(), path: z.array(z.string()) },
    },
    (input, extra) =>
      handle(extra, (u) =>
        service.deletePage(u, input as Parameters<typeof service.deletePage>[1]),
      ),
  );

  server.registerTool(
    'move_page',
    {
      title: 'Déplacer une page',
      description: 'Déplace une page sous newParentPath (vide = racine) à une position donnée.',
      inputSchema: {
        resourceSlug: z.string(),
        path: z.array(z.string()),
        newParentPath: z.array(z.string()).optional(),
        position: z.number().int().optional(),
      },
    },
    (input, extra) =>
      handle(extra, (u) => service.movePage(u, input as Parameters<typeof service.movePage>[1])),
  );

  server.registerTool(
    'reorder_pages',
    {
      title: 'Réordonner les pages',
      description:
        "Réordonne les sous-pages d'un même parent : fournis tous leurs ids dans l'ordre voulu.",
      inputSchema: { orderedPageIds: z.array(z.string()) },
    },
    (input, extra) =>
      handle(extra, (u) =>
        service.reorderPages(u, (input as { orderedPageIds: string[] }).orderedPageIds),
      ),
  );

  server.registerTool(
    'add_module',
    {
      title: 'Ajouter un module',
      description: 'Ajoute un module à une page. Renvoie { id }.',
      inputSchema: {
        resourceSlug: z.string(),
        path: z.array(z.string()),
        module: moduleInputSchema,
        position: z.number().int().optional(),
      },
    },
    (input, extra) =>
      handle(extra, (u) => service.addModule(u, input as Parameters<typeof service.addModule>[1])),
  );

  server.registerTool(
    'update_module',
    {
      title: 'Modifier un module',
      description:
        'Met à jour le contenu et/ou la position d’un module (le contenu est validé selon le type existant).',
      inputSchema: {
        id: z.string(),
        content: z.unknown().optional(),
        position: z.number().int().optional(),
      },
    },
    (input, extra) =>
      handle(extra, (u) =>
        service.updateModule(u, input as Parameters<typeof service.updateModule>[1]),
      ),
  );

  server.registerTool(
    'delete_module',
    {
      title: 'Supprimer un module',
      description: 'Supprime un module.',
      inputSchema: { id: z.string() },
    },
    (input, extra) => handle(extra, (u) => service.deleteModule(u, input as { id: string })),
  );

  server.registerTool(
    'reorder_modules',
    {
      title: 'Réordonner les modules',
      description: 'Réordonne les modules : position = index dans la liste fournie.',
      inputSchema: { orderedModuleIds: z.array(z.string()) },
    },
    (input, extra) =>
      handle(extra, (u) => service.reorderModules(u, input as { orderedModuleIds: string[] })),
  );

  server.registerTool(
    'grant_access',
    {
      title: 'Autoriser un accès',
      description: 'Autorise un email à accéder à une ressource privée.',
      inputSchema: { resourceSlug: z.string(), email: z.string().email() },
    },
    (input, extra) =>
      handle(extra, (u) =>
        service.grantAccess(u, input as { resourceSlug: string; email: string }),
      ),
  );

  server.registerTool(
    'revoke_access',
    {
      title: 'Retirer un accès',
      description: 'Retire l’accès d’un email à une ressource privée.',
      inputSchema: { resourceSlug: z.string(), email: z.string().email() },
    },
    (input, extra) =>
      handle(extra, (u) =>
        service.revokeAccess(u, input as { resourceSlug: string; email: string }),
      ),
  );

  server.registerTool(
    'get_resource_stats',
    {
      title: 'Statistiques ressources',
      description:
        "Statistiques de vue et de provenance. Avec slug : détail d'une ressource. Sans slug : vue d'ensemble (par ressource + top sources).",
      inputSchema: {
        slug: z.string().optional(),
        sinceDays: z.number().int().positive().optional(),
      },
    },
    (input, extra) =>
      handle(extra, (u) => {
        const { slug, sinceDays } = input as { slug?: string; sinceDays?: number };
        return slug ? getResourceStats(u, slug, sinceDays) : getStatsOverview(u);
      }),
  );

  server.registerTool(
    'tracking_link',
    {
      title: 'Lien de partage tagué',
      description:
        'Construit un lien UTM vers une ressource. `source` = plateforme (linkedin, newsletter), `campaign` = contenu précis, `medium` = canal. `path` cible une sous-page. Renvoie { url }.',
      inputSchema: {
        slug: z.string(),
        source: z.string(),
        medium: z.string().optional(),
        campaign: z.string().optional(),
        path: z.array(z.string()).optional(),
      },
    },
    (input, extra) =>
      handle(extra, async (u) =>
        service.trackingLink(await op(u), input as Parameters<typeof service.trackingLink>[1]),
      ),
  );
}
