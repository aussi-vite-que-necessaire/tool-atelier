import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// La session est lue localement via auth.api.getSession (auth in-app), plus
// aucun fetch HTTP vers un provider distant.
const getSession = vi.fn();
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }));
vi.mock('@/lib/auth/preview', () => ({
  isPreview: false,
  DEFAULT_PREVIEW_USER: '1',
  loginRedirect: () => '/signin',
}));
vi.mock('@/lib/db/seeds/user-defaults', () => ({
  seedUserDefaults: vi.fn().mockResolvedValue(undefined),
}));

const mockHeaders = (cookie?: string) => {
  const h = new Headers();
  if (cookie) h.set('cookie', cookie);
  return h;
};

describe('fetchSession', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renvoie l'user quand getSession retourne une session", async () => {
    getSession.mockResolvedValue({ user: { id: 'abc123', email: 'manu@avqn.ch' } });
    const { fetchSession } = await import('@/lib/auth/session');
    const s = await fetchSession(mockHeaders('better-auth.session_token=xyz'));
    expect(s).toEqual({ user: { id: 'abc123' } });
    expect(getSession).toHaveBeenCalledOnce();
  });

  it('renvoie null quand getSession retourne null', async () => {
    getSession.mockResolvedValue(null);
    const { fetchSession } = await import('@/lib/auth/session');
    expect(await fetchSession(mockHeaders())).toBeNull();
  });

  it('renvoie null quand la session est sans user', async () => {
    getSession.mockResolvedValue({ session: { id: 's1' } });
    const { fetchSession } = await import('@/lib/auth/session');
    expect(await fetchSession(mockHeaders('better-auth.session_token=xyz'))).toBeNull();
  });
});
