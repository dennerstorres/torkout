export interface UserFixture {
  email: string;
  id: string;
  name: string;
  timeZone: string;
}

export interface WorkoutSessionFixture {
  id: string;
  localDate: string;
  plannedTimeZone: string;
  userId: string;
}

const fixtureIds = {
  session: '10000000-0000-4000-8000-000000000002',
  user: '10000000-0000-4000-8000-000000000001',
} as const;

export function createUserFixture(overrides: Partial<UserFixture> = {}): UserFixture {
  return {
    email: 'pessoa.teste@example.invalid',
    id: fixtureIds.user,
    name: 'Pessoa de Teste',
    timeZone: 'America/Cuiaba',
    ...overrides,
  };
}

export function createWorkoutSessionFixture(
  overrides: Partial<WorkoutSessionFixture> = {},
): WorkoutSessionFixture {
  return {
    id: fixtureIds.session,
    localDate: '2026-07-14',
    plannedTimeZone: 'America/Cuiaba',
    userId: fixtureIds.user,
    ...overrides,
  };
}
