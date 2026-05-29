import { describe, expect, it } from 'vitest';
import { bearerMatches, resolveMcpUserId } from '@/lib/mcp/endpoint-auth';

// L'endpoint MCP in-app résout le userId soit via la session de la suite
// (cookie → lookup serveur), soit via un bearer de confiance (clé interne /
// preview) en prenant le userId fourni dans le corps. Logique pure, testée
// sans toucher à la base : la résolution de session est injectée.

function reqWith(headers: Record<string, string> = {}): Request {
  return new Request('https://app.test/api/mcp', { headers });
}

describe('bearerMatches', () => {
  it('reconnaît un bearer égal à la clé', () => {
    const req = reqWith({ authorization: 'Bearer s3cret' });
    expect(bearerMatches(req, 's3cret')).toBe(true);
  });
  it('rejette une clé absente ou différente', () => {
    expect(bearerMatches(reqWith({ authorization: 'Bearer x' }), 's3cret')).toBe(false);
    expect(bearerMatches(reqWith(), 's3cret')).toBe(false);
    expect(bearerMatches(reqWith({ authorization: 'Bearer s3cret' }), '')).toBe(false);
  });
});

describe('resolveMcpUserId', () => {
  const sessionUser = async (h: Headers) =>
    h.get('cookie')?.includes('valid') ? { user: { id: 'user-42' } } : null;

  it('priorise la session : userId issu du cookie, body ignoré', async () => {
    const id = await resolveMcpUserId({
      request: reqWith({ cookie: 'better-auth.session_token=valid' }),
      bodyUserId: 'forged',
      getSession: sessionUser,
      bearerKey: 'k',
      preview: false,
    });
    expect(id).toBe('user-42');
  });

  it('sans session, accepte le bearer de confiance avec userId du body', async () => {
    const id = await resolveMcpUserId({
      request: reqWith({ authorization: 'Bearer k' }),
      bodyUserId: 'user-7',
      getSession: sessionUser,
      bearerKey: 'k',
      preview: false,
    });
    expect(id).toBe('user-7');
  });

  it('en preview, accepte le userId du body sans bearer ni session', async () => {
    const id = await resolveMcpUserId({
      request: reqWith(),
      bodyUserId: 'user-prev',
      getSession: sessionUser,
      bearerKey: '',
      preview: true,
    });
    expect(id).toBe('user-prev');
  });

  it('refuse (null) sans session, sans bearer valide, hors preview', async () => {
    const id = await resolveMcpUserId({
      request: reqWith(),
      bodyUserId: 'x',
      getSession: sessionUser,
      bearerKey: 'k',
      preview: false,
    });
    expect(id).toBeNull();
  });

  it('refuse le bearer de confiance si le body ne fournit pas de userId', async () => {
    const id = await resolveMcpUserId({
      request: reqWith({ authorization: 'Bearer k' }),
      bodyUserId: undefined,
      getSession: sessionUser,
      bearerKey: 'k',
      preview: false,
    });
    expect(id).toBeNull();
  });
});
