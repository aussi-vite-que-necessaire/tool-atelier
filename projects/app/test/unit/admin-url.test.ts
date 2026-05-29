import { describe, expect, test } from 'vitest';
import { adminUrl, dbNameFromUrl } from '@/lib/db/admin-url';

describe('adminUrl', () => {
  test('remplace le nom de base par "postgres", conserve creds/host/port', () => {
    expect(adminUrl('postgres://app:app@localhost:5432/cast_test')).toBe(
      'postgres://app:app@localhost:5432/postgres',
    );
  });

  test('conserve creds/host/port arbitraires', () => {
    expect(adminUrl('postgres://u:p@h:1/foo')).toBe('postgres://u:p@h:1/postgres');
  });
});

describe('dbNameFromUrl', () => {
  test('extrait le nom de la base cible', () => {
    expect(dbNameFromUrl('postgres://app:app@localhost:5432/cast_test')).toBe(
      'cast_test',
    );
  });
});
