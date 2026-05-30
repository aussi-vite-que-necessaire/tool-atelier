// Résolution d'identité pour l'endpoint MCP in-app (/api/mcp).
//
// Deux modes, sans OAuth :
//  1. Session de la suite (cookie BetterAuth) → userId résolu côté serveur.
//     Prioritaire : un client navigateur même-origine porte ce cookie.
//  2. Bearer de confiance (clé interne partagée, ou preview ouverte) → le userId
//     est pris dans le corps de la requête. Réservé aux appels programmatiques.
//
// La logique est pure (la résolution de session est injectée) pour rester
// testable sans base ni env.

// Comparaison à temps constant (résiste au timing).
function constantTimeEqual(a: string, b: string): boolean {
  if (b.length === 0 || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Le header Authorization porte-t-il un bearer égal à la clé ? (clé vide → false)
export function bearerMatches(req: Request, key: string): boolean {
  if (!key) return false;
  const header = req.headers.get('authorization') ?? '';
  if (!header.startsWith('Bearer ')) return false;
  return constantTimeEqual(header.slice('Bearer '.length), key);
}

type SessionLookup = (headers: Headers) => Promise<{ user: { id: string } } | null>;

export async function resolveMcpUserId(opts: {
  request: Request;
  bodyUserId: string | undefined;
  getSession: SessionLookup;
  bearerKey: string;
  preview: boolean;
}): Promise<string | null> {
  // 1. Session de la suite (cookie) — prioritaire, identité de confiance.
  const session = await opts.getSession(opts.request.headers);
  if (session?.user?.id) return session.user.id;

  // 2. Canal de confiance (bearer interne ou preview ouverte) → userId du corps.
  const trusted = opts.preview || bearerMatches(opts.request, opts.bearerKey);
  if (trusted && typeof opts.bodyUserId === 'string' && opts.bodyUserId.length > 0) {
    return opts.bodyUserId;
  }

  return null;
}
