import { describe, expect, it } from 'vitest';

import { historyPageSchema, historyQuerySchema } from './history.js';

describe('history contracts', () => {
  it('accepts a bounded cursor page and rejects inverted dates', () => {
    expect(
      historyQuerySchema.parse({ from: '2026-07-01', limit: '14', through: '2026-07-31' }),
    ).toMatchObject({ from: '2026-07-01', limit: 14, through: '2026-07-31' });
    expect(() => historyQuerySchema.parse({ from: '2026-08-01', through: '2026-07-01' })).toThrow();
  });

  it('keeps state and activity as separate dimensions in each day', () => {
    const page = historyPageSchema.parse({
      days: [
        {
          habitEntries: [],
          localDate: '2026-07-13',
          measurements: [],
          painReports: [],
          sessions: [
            {
              id: 'a8100000-0000-4000-8000-000000000001',
              status: 'completed',
              type: 'walk',
              version: 1,
            },
            {
              id: 'a8100000-0000-4000-8000-000000000002',
              status: 'partial',
              type: 'strength',
              version: 1,
            },
          ],
        },
      ],
      habits: [],
      nextCursor: null,
    });
    expect(page.days[0]?.sessions.map(({ status, type }) => [type, status])).toEqual([
      ['walk', 'completed'],
      ['strength', 'partial'],
    ]);
  });
});
