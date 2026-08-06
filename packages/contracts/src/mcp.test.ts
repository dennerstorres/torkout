import { describe, expect, it } from 'vitest';

import {
  MCP_DEFAULT_LIMIT,
  MCP_MAX_LIMIT,
  MCP_MAX_RANGE_DAYS,
  MCP_SCOPE,
  MCP_TOOL_NAMES,
  mcpComparePeriodsInputSchema,
  mcpExerciseNameSchema,
  mcpLimitSchema,
  mcpRangeInputSchema,
} from './mcp.js';

describe('mcpRangeInputSchema', () => {
  it('accepts an empty range', () => {
    expect(mcpRangeInputSchema.safeParse({}).success).toBe(true);
  });

  it('accepts a day count', () => {
    expect(mcpRangeInputSchema.safeParse({ days: 14 }).success).toBe(true);
  });

  it('accepts an explicit interval', () => {
    const parsed = mcpRangeInputSchema.safeParse({ from: '2026-07-24', to: '2026-08-06' });
    expect(parsed.success).toBe(true);
  });

  it('rejects a negative or zero day count', () => {
    expect(mcpRangeInputSchema.safeParse({ days: 0 }).success).toBe(false);
    expect(mcpRangeInputSchema.safeParse({ days: -7 }).success).toBe(false);
  });

  it('rejects a fractional day count', () => {
    expect(mcpRangeInputSchema.safeParse({ days: 1.5 }).success).toBe(false);
  });

  it('rejects a range beyond the maximum window', () => {
    expect(mcpRangeInputSchema.safeParse({ days: MCP_MAX_RANGE_DAYS + 1 }).success).toBe(false);
  });

  it('rejects a malformed date', () => {
    expect(mcpRangeInputSchema.safeParse({ from: '06/08/2026', to: '2026-08-06' }).success).toBe(
      false,
    );
  });

  it('rejects a calendar date that does not exist', () => {
    expect(mcpRangeInputSchema.safeParse({ from: '2026-02-30', to: '2026-03-01' }).success).toBe(
      false,
    );
  });

  it('rejects an inverted interval', () => {
    const parsed = mcpRangeInputSchema.safeParse({ from: '2026-08-06', to: '2026-07-24' });
    expect(parsed.success).toBe(false);
  });

  it('rejects a half interval', () => {
    expect(mcpRangeInputSchema.safeParse({ from: '2026-07-24' }).success).toBe(false);
    expect(mcpRangeInputSchema.safeParse({ to: '2026-08-06' }).success).toBe(false);
  });

  it('rejects mixing a day count with an explicit interval instead of silently preferring one', () => {
    const parsed = mcpRangeInputSchema.safeParse({
      days: 14,
      from: '2026-07-24',
      to: '2026-08-06',
    });
    expect(parsed.success).toBe(false);
  });

  it('never accepts a user identifier as an argument', () => {
    const parsed = mcpRangeInputSchema.parse({ days: 7, userId: 'someone-else' } as never);
    expect(parsed).not.toHaveProperty('userId');
  });
});

describe('mcpLimitSchema', () => {
  it('accepts the documented bounds', () => {
    expect(mcpLimitSchema.safeParse(1).success).toBe(true);
    expect(mcpLimitSchema.safeParse(MCP_DEFAULT_LIMIT).success).toBe(true);
    expect(mcpLimitSchema.safeParse(MCP_MAX_LIMIT).success).toBe(true);
  });

  it('rejects a limit above the ceiling', () => {
    expect(mcpLimitSchema.safeParse(MCP_MAX_LIMIT + 1).success).toBe(false);
  });

  it('rejects zero and negative limits', () => {
    expect(mcpLimitSchema.safeParse(0).success).toBe(false);
    expect(mcpLimitSchema.safeParse(-1).success).toBe(false);
  });
});

describe('mcpExerciseNameSchema', () => {
  it('trims surrounding whitespace', () => {
    expect(mcpExerciseNameSchema.parse('  Flexão  ')).toBe('Flexão');
  });

  it('rejects an empty name', () => {
    expect(mcpExerciseNameSchema.safeParse('   ').success).toBe(false);
  });
});

describe('mcpComparePeriodsInputSchema', () => {
  it('accepts two well formed periods', () => {
    const parsed = mcpComparePeriodsInputSchema.safeParse({
      current_from: '2026-07-01',
      current_to: '2026-07-31',
      previous_from: '2026-06-01',
      previous_to: '2026-06-30',
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects an inverted current period', () => {
    const parsed = mcpComparePeriodsInputSchema.safeParse({
      current_from: '2026-07-31',
      current_to: '2026-07-01',
      previous_from: '2026-06-01',
      previous_to: '2026-06-30',
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects an inverted previous period', () => {
    const parsed = mcpComparePeriodsInputSchema.safeParse({
      current_from: '2026-07-01',
      current_to: '2026-07-31',
      previous_from: '2026-06-30',
      previous_to: '2026-06-01',
    });
    expect(parsed.success).toBe(false);
  });
});

describe('tool inventory', () => {
  it('declares only read oriented names', () => {
    const writing = MCP_TOOL_NAMES.filter((name) =>
      /^(create|update|delete|remove|set|add|edit|log|record|save|patch|put)_/.test(name),
    );
    expect(writing).toEqual([]);
  });

  it('exposes a read only scope', () => {
    expect(MCP_SCOPE).toBe('torkout:read');
  });
});
