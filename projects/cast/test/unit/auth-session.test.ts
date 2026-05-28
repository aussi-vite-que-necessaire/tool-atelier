import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock du module preview pour pouvoir flipper isPreview proprement.
vi.mock('@/lib/auth/preview', () => ({
  isPreview: false,
  PREVIEW_USER_ID: 'preview-user',
  PREVIEW_USER: 'preview@cast.local',
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
    const url = fetchMock.mock.calls[0][0] as string;
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

  it('court-circuite avec PREVIEW_USER_ID quand isPreview=true', async () => {
    vi.doMock('@/lib/auth/preview', () => ({
      isPreview: true,
      PREVIEW_USER_ID: 'preview-user',
      PREVIEW_USER: 'preview@cast.local',
      PREVIEW_OTP: '000000',
    }));
    const { fetchSession } = await import('@/lib/auth/session');
    const s = await fetchSession(mockHeaders());
    expect(s).toEqual({ user: { id: 'preview-user' } });
  });
});
