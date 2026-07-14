import { Pool } from 'pg';
import { describe, expect, it } from 'vitest';

describe('ephemeral PostgreSQL', () => {
  it('accepts a real connection and query', async () => {
    const connectionString = process.env.TEST_DATABASE_URL;

    if (!connectionString) {
      throw new Error('TEST_DATABASE_URL is required for integration tests');
    }

    const pool = new Pool({ connectionString, max: 1 });

    try {
      const result = await pool.query<{ value: number }>('select 1::int as value');
      expect(result.rows).toEqual([{ value: 1 }]);
    } finally {
      await pool.end();
    }
  });
});
