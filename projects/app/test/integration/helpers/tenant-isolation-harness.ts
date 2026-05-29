import { describe, expect, test } from 'vitest';
import { createTestUser } from './seed';

export interface TenantIsolationFixture<TRow> {
  seed: (userId: string) => Promise<TRow>;
  rowId: (row: TRow) => string;
  reload: (userId: string, id: string) => Promise<TRow | undefined>;
  updatePatch: Record<string, unknown>;
  // Champs du patch dont on doit vérifier qu'ils n'ont PAS été appliqués cross-tenant.
  // Format : un sous-set de updatePatch utilisé pour assertion.
  updateAssertions?: (rowAfterCrossTenantUpdate: TRow) => void;

  get?: (userId: string, id: string) => Promise<TRow | undefined>;
  list?: (userId: string) => Promise<TRow[]>;
  update?: (
    userId: string,
    id: string,
    patch: Record<string, unknown>,
  ) => Promise<TRow | undefined>;
  delete?: (userId: string, id: string) => Promise<void>;
}

export function runTenantIsolationSuite<T>(name: string, fixture: TenantIsolationFixture<T>): void {
  describe(`${name} — tenant isolation`, () => {
    test('list: A et B ne voient que leurs propres rows', async () => {
      if (!fixture.list) return;
      const a = await createTestUser('alice');
      const b = await createTestUser('bob');
      const rowA = await fixture.seed(a);
      const rowB = await fixture.seed(b);
      const listA = await fixture.list(a);
      const listB = await fixture.list(b);
      expect(listA.map(fixture.rowId)).toEqual([fixture.rowId(rowA)]);
      expect(listB.map(fixture.rowId)).toEqual([fixture.rowId(rowB)]);
    });

    test('get cross-tenant retourne undefined', async () => {
      if (!fixture.get) return;
      const a = await createTestUser('alice');
      const b = await createTestUser('bob');
      const rowA = await fixture.seed(a);
      const stolen = await fixture.get(b, fixture.rowId(rowA));
      expect(stolen).toBeUndefined();
    });

    test('update cross-tenant est no-op', async () => {
      if (!fixture.update) return;
      const a = await createTestUser('alice');
      const b = await createTestUser('bob');
      const rowA = await fixture.seed(a);
      const result = await fixture.update(b, fixture.rowId(rowA), fixture.updatePatch);
      expect(result).toBeUndefined();
      const reloaded = await fixture.reload(a, fixture.rowId(rowA));
      expect(reloaded).toBeDefined();
      if (fixture.updateAssertions && reloaded) {
        fixture.updateAssertions(reloaded);
      }
    });

    test('delete cross-tenant est no-op', async () => {
      if (!fixture.delete) return;
      const a = await createTestUser('alice');
      const b = await createTestUser('bob');
      const rowA = await fixture.seed(a);
      await fixture.delete(b, fixture.rowId(rowA));
      const reloaded = await fixture.reload(a, fixture.rowId(rowA));
      expect(reloaded).toBeDefined();
    });
  });
}
