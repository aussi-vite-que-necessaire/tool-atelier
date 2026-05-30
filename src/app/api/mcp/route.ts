import { auth } from '@/lib/auth';
import { isPreview } from '@/lib/auth/preview';
import { bearerMatches, resolveMcpUserId } from '@/lib/mcp/endpoint-auth';
import { callToolByName, listToolsResponse } from '@/lib/mcp/internal';

export const dynamic = 'force-dynamic';

// Endpoint MCP unique de la suite, in-app. Sert TOUS les outils enregistrés
// (cast + media + ressources) depuis le registre commun. Authentifié par la
// session de la suite (cookie) ou un bearer de confiance (MCP_INTERNAL_KEY /
// preview) — pas d'OAuth (suivi : sous-domaine mcp.contentos.ch + OAuth).

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const bearerKey = (): string => process.env.MCP_INTERNAL_KEY ?? '';

async function sessionUserId(headers: Headers): Promise<{ user: { id: string } } | null> {
  const s = await auth.api.getSession({ headers });
  return s?.user?.id ? { user: { id: s.user.id } } : null;
}

// GET /api/mcp → catalogue (name + description + inputSchema). Le listing n'a
// pas besoin d'un userId réel ; seul l'accès est gardé : session OU bearer de
// confiance OU preview.
export async function GET(request: Request): Promise<Response> {
  const allowed =
    isPreview ||
    bearerMatches(request, bearerKey()) ||
    (await sessionUserId(request.headers)) !== null;
  if (!allowed) return json({ error: 'Unauthorized' }, 401);
  return json(listToolsResponse());
}

// POST /api/mcp → exécute un outil. Corps : { name, args, userId? }.
// userId du corps n'est honoré que sur le canal de confiance (bearer/preview) ;
// avec une session, l'identité vient du cookie.
export async function POST(request: Request): Promise<Response> {
  let body: { name?: unknown; args?: unknown; userId?: unknown };
  try {
    body = (await request.json()) ?? {};
  } catch {
    return json({ error: 'Corps JSON invalide' }, 400);
  }

  const name = body.name;
  if (typeof name !== 'string' || name.length === 0) {
    return json({ error: 'name manquant' }, 400);
  }

  const userId = await resolveMcpUserId({
    request,
    bodyUserId: typeof body.userId === 'string' ? body.userId : undefined,
    getSession: sessionUserId,
    bearerKey: bearerKey(),
    preview: isPreview,
  });
  if (!userId) return json({ error: 'Unauthorized' }, 401);

  try {
    const result = await callToolByName(name, userId, body.args ?? {});
    return json({ result });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const status = /inconnu/i.test(message) ? 404 : 400;
    return json({ error: message }, status);
  }
}
