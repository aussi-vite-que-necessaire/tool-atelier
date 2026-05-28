import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getPublication, listPublications } from '@/lib/db/repositories/publications';
import { getSocialAccount } from '@/lib/db/repositories/social-accounts';
import { runwayDays } from '@/lib/linkedin/runway';
import {
  cancelPublication,
  publishNow,
  removePublication,
  schedulePublication,
} from '@/lib/publications/publish-core';
import { awaitJobResult } from '@/lib/queue/await-job';
import { enqueuePublishLinkedin, removePublishLinkedin } from '@/lib/queue/enqueue';
import { handle } from '../register';

type PublishDeps = {
  enqueue?: (publicationId: string, userId: string) => Promise<void>;
  awaitDone?: (publicationId: string) => Promise<void>;
};

export async function getLinkedinConnectionTool(userId: string) {
  const account = await getSocialAccount(userId, 'linkedin');
  if (!account) return { connected: false };
  return {
    connected: true,
    displayName: account.displayName,
    runwayDays: runwayDays(account.expiresAt),
  };
}

export async function publishNowTool(
  userId: string,
  input: { postId: string },
  deps: PublishDeps = {},
) {
  const enqueue =
    deps.enqueue ??
    ((id: string, uid: string) =>
      enqueuePublishLinkedin({ publicationId: id, userId: uid }).then(() => undefined));
  const pub = await publishNow(userId, input.postId, (id) => enqueue(id, userId));

  const awaitDone =
    deps.awaitDone ??
    ((id: string) => awaitJobResult('publish-linkedin', id).then(() => undefined));
  await awaitDone(pub.id);

  const final = await getPublication(userId, pub.id);
  if (!final) throw new Error('publication introuvable');
  return {
    publicationId: final.id,
    status: final.status,
    externalUrl: final.externalUrl,
    failureKind: final.failureKind,
    error: final.lastError,
  };
}

export async function schedulePostTool(
  userId: string,
  input: { postId: string; whenIso: string; tz?: string },
  enqueue?: (publicationId: string, delayMs?: number) => Promise<void>,
) {
  const run =
    enqueue ??
    ((id: string, delayMs?: number) =>
      enqueuePublishLinkedin({ publicationId: id, userId }, delayMs).then(() => undefined));
  return schedulePublication(
    userId,
    input.postId,
    new Date(input.whenIso),
    input.tz ?? 'UTC',
    (id, delayMs) => run(id, delayMs),
  );
}

export async function cancelScheduledTool(
  userId: string,
  input: { publicationId: string },
  dequeue: (publicationId: string) => Promise<void> = removePublishLinkedin,
) {
  await cancelPublication(userId, input.publicationId, dequeue);
  return { cancelled: input.publicationId };
}

export async function deletePublicationTool(
  userId: string,
  input: { publicationId: string },
  dequeue: (publicationId: string) => Promise<void> = removePublishLinkedin,
) {
  await removePublication(userId, input.publicationId, dequeue);
  return { deleted: input.publicationId };
}

export function registerPublishingTools(server: McpServer): void {
  server.registerTool(
    'get_linkedin_connection',
    {
      title: 'État de la connexion LinkedIn',
      description: 'Indique si un compte LinkedIn est connecté + jours avant expiration.',
      inputSchema: {},
    },
    (_i, extra) => handle(extra, (u) => getLinkedinConnectionTool(u)),
  );
  server.registerTool(
    'publish_post_now',
    {
      title: 'Publier maintenant',
      description: 'Publie un post sur LinkedIn immédiatement (attend le résultat).',
      inputSchema: { postId: z.string() },
    },
    (input, extra) => handle(extra, (u) => publishNowTool(u, input)),
  );
  server.registerTool(
    'schedule_post',
    {
      title: 'Planifier une publication',
      description: 'Planifie un post LinkedIn à une date ISO (snapshot figé au clic).',
      inputSchema: { postId: z.string(), whenIso: z.string(), tz: z.string().optional() },
    },
    (input, extra) => handle(extra, (u) => schedulePostTool(u, input)),
  );
  server.registerTool(
    'cancel_scheduled',
    {
      title: 'Annuler une planification',
      description: 'Annule une publication planifiée (tant qu’elle n’est pas en cours).',
      inputSchema: { publicationId: z.string() },
    },
    (input, extra) => handle(extra, (u) => cancelScheduledTool(u, input)),
  );
  server.registerTool(
    'delete_publication',
    {
      title: 'Supprimer une publication',
      description:
        'Supprime définitivement une publication (planifiée, publiée ou échouée) et retire son job en attente. Refuse si la publication est en cours.',
      inputSchema: { publicationId: z.string() },
    },
    (input, extra) => handle(extra, (u) => deletePublicationTool(u, input)),
  );
  server.registerTool(
    'list_publications',
    {
      title: 'Lister les publications',
      description: 'Publications planifiées et publiées (pour le calendrier).',
      inputSchema: {},
    },
    (_i, extra) => handle(extra, (u) => listPublications(u)),
  );
}
