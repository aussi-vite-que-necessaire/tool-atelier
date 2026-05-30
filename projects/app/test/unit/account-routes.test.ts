import { describe, expect, it } from 'vitest';
import { ACCOUNT_CONNECTIONS_PATH } from '@/lib/account/routes';

describe('account routes', () => {
  it('expose le chemin canonique des connexions niveau suite', () => {
    expect(ACCOUNT_CONNECTIONS_PATH).toBe('/account/connections');
  });
});
