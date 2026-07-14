import { describe, expect, it } from 'vitest';

import { syncOperationSchema, syncPushRequestSchema } from './sync.js';

const operation = {
  baseVersion: null,
  clientOccurredAt: '2026-07-14T15:00:00.000Z',
  deviceId: '30000000-0000-4000-8000-000000000001',
  entityId: '40000000-0000-4000-8000-000000000001',
  entityType: 'body_measurement',
  operation: 'create',
  operationId: '50000000-0000-4000-8000-000000000001',
  payload: {
    localDate: '2026-07-14',
    measuredAt: '2026-07-14T15:00:00.000Z',
    weightKg: 70,
  },
};

describe('sync contracts', () => {
  it('accepts a strictly validated create operation', () => {
    expect(syncOperationSchema.parse(operation)).toEqual(operation);
  });

  it('requires the correct optimistic version for each operation kind', () => {
    expect(
      syncOperationSchema.safeParse({ ...operation, baseVersion: 1, operation: 'create' }).success,
    ).toBe(false);
    expect(
      syncOperationSchema.safeParse({ ...operation, baseVersion: null, operation: 'update' })
        .success,
    ).toBe(false);
    expect(
      syncOperationSchema.safeParse({
        ...operation,
        baseVersion: 1,
        operation: 'delete',
        payload: { notes: 'não deve ser aceito' },
      }).success,
    ).toBe(false);
  });

  it('keeps malformed items inside the batch for per-item rejection', () => {
    const parsed = syncPushRequestSchema.parse({ operations: [operation, { broken: true }] });
    expect(parsed.operations).toHaveLength(2);
  });
});
