import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock du module preview. loginRedirect/DEFAULT_PREVIEW_USER sont requis par session.ts.
vi.mock('@/lib/auth/preview', () => ({
  isPreview: false,
  DEFAULT_PREVIEW_USER: 1,
  loginRedirect: () => 'https://auth.example.test/sign-in',
  PREVIEW_OTP: '000000',
}));
vi.mock('@/lib/env', () => ({
  env: { AUTH_URL: 'https://auth.example.test', APP_URL: 'https://cast.example.test' },
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

  it('renvoie l\'user quand fetch /api/auth/get-session répond avec un user', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ user: { id: 'abc123', email: 'manu@avqn.ch' } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const { fetchSession } = await import('@/lib/auth/session');
    const s = await fetchSession(mockHeaders('better-auth.session_token=xyz'));
    expect(s).toEqual({ user: { id: 'abc123' } });
    expect(fetchMock).toHaveBeenCalledOnce();
    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url).toContain('/api/auth/get-session');
  });

  it('renvoie null quand pas de cookie', async () => {
    const { fetchSession } = await import('@/lib/auth/session');
    expect(await fetchSession(mockHeaders())).toBeNull();
  });

  it('renvoie null quand auth répond non-OK', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
    const { fetchSession } = await import('@/lib/auth/session');
    expect(await fetchSession(mockHeaders('better-auth.session_token=xyz'))).toBeNull();
  });

  it('ne court-circuite plus en preview : fait la vraie get-session', async () => {
    vi.doMock('@/lib/auth/preview', () => ({
      isPreview: true,
      DEFAULT_PREVIEW_USER: 1,
      loginRedirect: () => 'https://auth.example.test/preview-login?user=1',
      PREVIEW_OTP: '000000',
    }));
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ user: { id: 'real-user' } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const { fetchSession } = await import('@/lib/auth/session');
    // Sans cookie → null (plus de court-circuit qui inventait un user).
    expect(await fetchSession(mockHeaders())).toBeNull();
    // Avec cookie → passe par le fetch réel.
    const s = await fetchSession(mockHeaders('better-auth.session_token=xyz'));
    expect(s).toEqual({ user: { id: 'real-user' } });
    expect(fetchMock).toHaveBeenCalled();
  });
});
