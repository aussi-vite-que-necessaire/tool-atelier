import { describe, expect, it } from 'vitest';
import { planPages } from '@/lib/ressources/plan';

describe('planPages', () => {
  it('crée une racine + des enfants imbriqués avec parents corrects', () => {
    const planned = planPages(
      'Racine',
      [],
      [
        { slug: 'a', title: 'A', children: [{ slug: 'a1', title: 'A1' }] },
        { slug: 'b', title: 'B' },
      ],
    );
    expect(planned[0]).toMatchObject({ parentTempId: null, slug: '', title: 'Racine' });
    const a = planned.find((p) => p.slug === 'a')!;
    const a1 = planned.find((p) => p.slug === 'a1')!;
    expect(a.parentTempId).toBe(planned[0]!.tempId);
    expect(a1.parentTempId).toBe(a.tempId);
    expect(planned.find((p) => p.slug === 'b')!.position).toBe(1);
  });
});
