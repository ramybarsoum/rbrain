import { describe, expect, test } from 'bun:test';
import { operationsByName } from '../src/core/operations.ts';

describe('list_pages local vs remote limit policy', () => {
  test('trusted local list_pages is unlimited by default', async () => {
    let seenLimit: unknown = 'unset';
    const engine = {
      listPages: async (filters: Record<string, unknown>) => {
        seenLimit = filters.limit;
        return [];
      },
    };

    await operationsByName.list_pages.handler({ engine, remote: false, dryRun: false } as any, {});
    expect(seenLimit).toBeUndefined();
  });

  test('remote list_pages keeps the 100-row safety cap', async () => {
    let seenLimit: unknown = 'unset';
    const engine = {
      listPages: async (filters: Record<string, unknown>) => {
        seenLimit = filters.limit;
        return [];
      },
    };

    await operationsByName.list_pages.handler({ engine, remote: true, dryRun: false } as any, {});
    expect(seenLimit).toBe(50);

    await operationsByName.list_pages.handler({ engine, remote: true, dryRun: false } as any, { limit: 500 });
    expect(seenLimit).toBe(100);
  });
});