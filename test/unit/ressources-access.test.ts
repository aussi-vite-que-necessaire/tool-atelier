import { describe, expect, it } from 'vitest';
import { canAccess, normalizeEmail } from '@/lib/ressources/access';

describe('normalizeEmail', () => {
  it('trim + minuscules', () => {
    expect(normalizeEmail('  Foo@BAR.com ')).toBe('foo@bar.com');
  });
});

describe('canAccess', () => {
  const pub = { published: true, visibility: 'public' };
  const priv = { published: true, visibility: 'private' };
  it('refuse si non publié', () => {
    expect(canAccess({ published: false, visibility: 'public' }, 'a@b.c', [])).toBe(false);
  });
  it('refuse sans email', () => {
    expect(canAccess(pub, null, [])).toBe(false);
  });
  it('autorise public avec email', () => {
    expect(canAccess(pub, 'a@b.c', [])).toBe(true);
  });
  it('privé : seulement les emails autorisés', () => {
    expect(canAccess(priv, 'a@b.c', ['A@B.C'])).toBe(true);
    expect(canAccess(priv, 'x@y.z', ['a@b.c'])).toBe(false);
  });
});
