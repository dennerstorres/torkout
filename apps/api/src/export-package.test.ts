import { describe, expect, it } from 'vitest';

import { buildCsvZip, csvCell, listZipEntries } from './export-package.js';

describe('portable CSV ZIP package', () => {
  it('writes normalized UTF-8 CSV files with BOM and documentation', () => {
    const archive = buildCsvZip(
      {
        account: {
          createdAt: '2026-07-14T10:00:00.000Z',
          email: 'person@example.invalid',
          emailVerified: true,
          id: '60000000-0000-4000-8000-000000000001',
          name: 'João',
          updatedAt: '2026-07-14T10:00:00.000Z',
        },
        entities: {
          bodyMeasurements: [{ id: 'measure-1', notes: 'Cintura, manhã', weightKg: '70.00' }],
          coffeeIntakes: [],
          exercises: [],
          exerciseSets: [],
          habitDefinitions: [],
          habitEntries: [],
          habitOptions: [],
          painReports: [],
          privacyAcceptances: [],
          progressPhotos: [],
          progressionDecisions: [],
          progressionEvaluations: [],
          progressionRuleVersions: [],
          progressionSuggestions: [],
          scheduleRules: [],
          sessionExercises: [],
          trainingPlans: [],
          userProfiles: [],
          walkingDetails: [],
          wheyIntakes: [],
          workoutSessions: [],
          workoutTemplateExercises: [],
          workoutTemplates: [],
          workoutTemplateSets: [],
        },
        exportedAt: '2026-07-14T16:00:00.000Z',
        formatVersion: '1.0.0',
        pendingChanges: [],
        timeZone: 'America/Cuiaba',
        units: {
          distance: 'meter',
          height: 'centimeter',
          waist: 'centimeter',
          weight: 'kilogram',
        },
      },
      new Date('2026-07-14T16:00:00.000Z'),
    );
    const entries = listZipEntries(archive);

    expect([...entries.keys()]).toEqual(
      expect.arrayContaining([
        'README.txt',
        'account.csv',
        'body_measurements.csv',
        'pending_changes.csv',
      ]),
    );
    expect(entries.get('body_measurements.csv')?.subarray(0, 3)).toEqual(
      Buffer.from([0xef, 0xbb, 0xbf]),
    );
    expect(entries.get('body_measurements.csv')?.toString('utf8')).toContain('"Cintura, manhã"');
    expect(entries.get('README.txt')?.toString('utf8')).toMatch(/UTC|America\/Cuiaba|kilogram/);
  });

  it('escapes spreadsheet formulas as data', () => {
    expect(csvCell('=HYPERLINK("https://example.invalid")')).toBe(
      '"\'=HYPERLINK(""https://example.invalid"")"',
    );
  });
});
