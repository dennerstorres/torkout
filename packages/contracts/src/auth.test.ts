import { describe, expect, it } from 'vitest';

import {
  accountDeletionSchema,
  adminAccountBlockSchema,
  privacyAcceptanceSchema,
  profileUpdateSchema,
} from './auth.js';

describe('Phase 3 account contracts', () => {
  it('validates onboarding without requiring optional health measurements', () => {
    expect(
      profileUpdateSchema.parse({
        displayName: 'Pessoa de Teste',
        heightCm: 170,
        locale: 'pt-BR',
        nonMedicalDisclaimerAccepted: true,
        preferredWorkoutTime: '07:30',
        timeZone: 'America/Cuiaba',
        unitSystem: 'metric',
      }),
    ).toMatchObject({ timeZone: 'America/Cuiaba', unitSystem: 'metric' });
  });

  it('rejects invalid profile and consent input', () => {
    expect(() =>
      profileUpdateSchema.parse({
        displayName: '',
        heightCm: -1,
        locale: 'pt-BR',
        nonMedicalDisclaimerAccepted: false,
        timeZone: 'Not/AZone',
        unitSystem: 'imperial',
      }),
    ).toThrow();
    expect(() => privacyAcceptanceSchema.parse({ documentVersions: {} })).toThrow();
  });

  it('requires explicit confirmation and reauthentication for deletion', () => {
    expect(() => accountDeletionSchema.parse({ confirmation: 'talvez' })).toThrow();
    expect(
      accountDeletionSchema.parse({
        confirmation: 'EXCLUIR MINHA CONTA',
        password: 'long-password',
      }),
    ).toMatchObject({ confirmation: 'EXCLUIR MINHA CONTA' });
  });

  it('limits administrative blocking to a reason and optional expiry', () => {
    expect(adminAccountBlockSchema.parse({ reason: 'abuse', expiresAt: null })).toEqual({
      reason: 'abuse',
      expiresAt: null,
    });
    expect(() => adminAccountBlockSchema.parse({ reason: '' })).toThrow();
    expect(() => adminAccountBlockSchema.parse({ reason: 'Peso e dor da pessoa' })).toThrow();
  });
});
