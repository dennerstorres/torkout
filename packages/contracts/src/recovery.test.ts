import { describe, expect, it } from 'vitest';

import { painReportCreateSchema, sessionRecoverySchema, workoutExecutionSchema } from './daily.js';
import { progressPhotoUploadSchema, MAX_PROGRESS_PHOTO_BYTES } from './photos.js';

describe('pain and recovery contract', () => {
  const base = {
    bodyRegion: 'ankle' as const,
    localDate: '2026-07-24',
    moment: 'during' as const,
  };

  it('accepts the three kinds of discomfort', () => {
    for (const type of ['muscular', 'joint', 'other'] as const) {
      expect(painReportCreateSchema.safeParse({ ...base, type }).success).toBe(true);
    }
  });

  it('accepts an intensity from zero to ten', () => {
    expect(
      painReportCreateSchema.safeParse({ ...base, intensityScore: 0, type: 'muscular' }).success,
    ).toBe(true);
    expect(
      painReportCreateSchema.safeParse({ ...base, intensityScore: 10, type: 'muscular' }).success,
    ).toBe(true);
    expect(
      painReportCreateSchema.safeParse({ ...base, intensityScore: 11, type: 'muscular' }).success,
    ).toBe(false);
  });

  it('records swelling and difficulty to walk or bear weight', () => {
    const parsed = painReportCreateSchema.parse({
      ...base,
      supportDifficulty: true,
      swelling: true,
      type: 'joint',
    });
    expect(parsed.supportDifficulty).toBe(true);
    expect(parsed.swelling).toBe(true);
  });

  it('stores an explicit "no discomfort" answer without any detail', () => {
    const parsed = sessionRecoverySchema.parse({ status: 'none' });
    expect(parsed.status).toBe('none');
    expect(parsed.reports).toEqual([]);
  });

  it('requires at least one report when discomfort was reported', () => {
    expect(sessionRecoverySchema.safeParse({ reports: [], status: 'reported' }).success).toBe(
      false,
    );
    expect(
      sessionRecoverySchema.safeParse({
        reports: [{ ...base, type: 'muscular' }],
        status: 'reported',
      }).success,
    ).toBe(true);
  });

  it('does not accept reports when the answer was "no"', () => {
    expect(
      sessionRecoverySchema.safeParse({
        reports: [{ ...base, type: 'muscular' }],
        status: 'none',
      }).success,
    ).toBe(false);
  });
});

describe('perceived exertion contract', () => {
  it('accepts an optional integer between zero and ten', () => {
    expect(workoutExecutionSchema.safeParse({ exercises: [], perceivedExertion: 7 }).success).toBe(
      true,
    );
    expect(
      workoutExecutionSchema.safeParse({ exercises: [], perceivedExertion: null }).success,
    ).toBe(true);
    expect(workoutExecutionSchema.safeParse({ exercises: [] }).success).toBe(true);
    expect(workoutExecutionSchema.safeParse({ exercises: [], perceivedExertion: 11 }).success).toBe(
      false,
    );
    expect(
      workoutExecutionSchema.safeParse({ exercises: [], perceivedExertion: 6.5 }).success,
    ).toBe(false);
  });

  it('defaults the recovery answer to "not answered"', () => {
    expect(workoutExecutionSchema.parse({ exercises: [] }).recoveryStatus).toBe('not_answered');
  });
});

describe('progress photo contract', () => {
  const base = {
    contentType: 'image/jpeg' as const,
    data: 'aW1hZ2Vt',
    localDate: '2026-07-24',
    pose: 'front' as const,
  };

  it('accepts the three poses', () => {
    for (const pose of ['front', 'side', 'back'] as const) {
      expect(progressPhotoUploadSchema.safeParse({ ...base, pose }).success).toBe(true);
    }
  });

  it('rejects unsupported content types', () => {
    expect(
      progressPhotoUploadSchema.safeParse({ ...base, contentType: 'application/pdf' }).success,
    ).toBe(false);
  });

  it('rejects payloads that are not base64', () => {
    expect(progressPhotoUploadSchema.safeParse({ ...base, data: 'não é base64!!' }).success).toBe(
      false,
    );
  });

  it('limits the stored size', () => {
    expect(MAX_PROGRESS_PHOTO_BYTES).toBeLessThanOrEqual(8 * 1024 * 1024);
    const oversized = 'A'.repeat(Math.ceil((MAX_PROGRESS_PHOTO_BYTES + 1024) / 3) * 4);
    expect(progressPhotoUploadSchema.safeParse({ ...base, data: oversized }).success).toBe(false);
  });
});
