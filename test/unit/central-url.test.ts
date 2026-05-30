import { describe, expect, it } from 'vitest';
import { centralUrl } from '@/lib/central-url';

describe('centralUrl', () => {
  it('pointe sur la prod quand APP_ENV vaut prod', () => {
    expect(centralUrl('prod')).toBe('https://contentos.ch');
  });

  it('pointe sur la prod quand APP_ENV est absent', () => {
    expect(centralUrl(undefined)).toBe('https://contentos.ch');
  });

  it('pointe sur le www de la branche en preview', () => {
    expect(centralUrl('wonderful-tesla-Gpzf6')).toBe(
      'https://www-wonderful-tesla-Gpzf6.preview.contentos.ch',
    );
  });
});
