import { describe, expect, test } from 'vitest';
import { getAuthorizeUrl } from '@/lib/linkedin/oauth';

describe('getAuthorizeUrl', () => {
  test('contient client_id, redirect_uri, scopes, state', () => {
    const url = new URL(getAuthorizeUrl('xyz-state'));
    expect(url.origin + url.pathname).toBe('https://www.linkedin.com/oauth/v2/authorization');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('redirect_uri')).toMatch(/\/api\/linkedin\/callback$/);
    expect(url.searchParams.get('scope')).toContain('w_member_social');
    expect(url.searchParams.get('state')).toBe('xyz-state');
  });
});
