import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDatabaseClient } from './client.js';
import { migrateDatabase } from './migrate.js';

const connectionString = process.env.TEST_DATABASE_URL;

if (!connectionString || !new URL(connectionString).pathname.endsWith('_test')) {
  throw new Error('TEST_DATABASE_URL must point to a dedicated database ending in _test.');
}

const { db, pool } = createDatabaseClient(connectionString);

async function createUser(email: string): Promise<string> {
  const result = await pool.query<{ id: string }>(
    'insert into users (name, email) values ($1, $2) returning id',
    ['Pessoa de Teste', email],
  );
  return result.rows[0]!.id;
}

describe('initial PostgreSQL schema', () => {
  beforeAll(async () => {
    await pool.query('drop schema if exists drizzle cascade');
    await pool.query('drop schema public cascade');
    await pool.query('create schema public');
    await migrateDatabase(db);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('migrates an empty database with every Phase 2 entity and the initial catalog', async () => {
    const expectedTables = [
      'accounts',
      'audit_events',
      'body_measurements',
      'change_log',
      'consumed_auth_tokens',
      'exercise_sets',
      'exercises',
      'habit_definitions',
      'habit_entries',
      'habit_options',
      'pain_reports',
      'privacy_acceptances',
      'privacy_documents',
      'progression_decisions',
      'progression_evaluations',
      'progression_rule_versions',
      'progression_suggestions',
      'registered_devices',
      'schedule_rules',
      'session_exercises',
      'sessions',
      'sync_operations',
      'training_plans',
      'user_profiles',
      'users',
      'verifications',
      'walking_details',
      'workout_sessions',
      'workout_template_exercises',
      'workout_template_sets',
      'workout_templates',
    ];
    const tables = await pool.query<{ table_name: string }>(
      `select table_name from information_schema.tables
       where table_schema = 'public' and table_type = 'BASE TABLE'
       order by table_name`,
    );
    expect(tables.rows.map(({ table_name }) => table_name)).toEqual(expectedTables);

    const catalog = await pool.query<{ name: string }>(
      'select name from exercises where is_system = true order by name',
    );
    expect(catalog.rows.map(({ name }) => name)).toEqual(['Agachamento livre', 'Flexão']);
  });

  it('keeps both current and rollback legal versions active for the release window', async () => {
    const documents = await pool.query<{
      content_hash: string;
      retired_at: Date | null;
      type: string;
      version: string;
    }>(
      `select type, version, content_hash, retired_at
       from privacy_documents
       order by type, version`,
    );

    expect(documents.rows.map(({ type, version }) => `${type}:${version}`)).toEqual([
      'privacy_notice:2026-07-14',
      'privacy_notice:2026-07-15',
      'terms:2026-07-14',
      'terms:2026-07-15',
      'health_data_consent:2026-07-14',
      'health_data_consent:2026-07-15',
    ]);
    expect(documents.rows.every(({ retired_at }) => retired_at === null)).toBe(true);
    expect(
      documents.rows
        .filter(({ version }) => version === '2026-07-15')
        .map(({ content_hash }) => content_hash),
    ).toEqual([
      '10b5e573bc4d49a1a7c0c0aa0e143d7acad995effaba08b7a985ac618e0bdb18',
      'b79d96d66f87f86782188d4e9a2ed0849959d3c14b4a0e1d92bb2ce09466482d',
      '751dc1147e43ce1caf6a1eaf1077918bb2c28dd009ea948951c52758976a5269',
    ]);
  });

  it('rejects invalid measurements and habit entries at database level', async () => {
    const userId = await createUser('constraints@example.invalid');

    await expect(
      pool.query(
        `insert into body_measurements (user_id, local_date, measured_at)
         values ($1, '2026-07-14', '2026-07-14T11:00:00Z')`,
        [userId],
      ),
    ).rejects.toMatchObject({ constraint: 'body_measurements_value_presence_check' });

    const habit = await pool.query<{ id: string }>(
      `insert into habit_definitions (user_id, name, type)
       values ($1, 'Café sem açúcar', 'boolean') returning id`,
      [userId],
    );
    await expect(
      pool.query(
        `insert into habit_entries
           (user_id, habit_definition_id, local_date, boolean_value, numeric_value)
         values ($1, $2, '2026-07-14', true, 1)`,
        [userId, habit.rows[0]!.id],
      ),
    ).rejects.toMatchObject({ constraint: 'habit_entries_exactly_one_value_check' });
  });

  it('stores explicit joint-pain confirmation and an idempotent authenticated history import', async () => {
    const columns = await pool.query<{ column_name: string }>(
      `select column_name from information_schema.columns
       where table_schema = 'public' and table_name = 'workout_sessions'
         and column_name in ('joint_pain_status', 'import_key')
       order by column_name`,
    );
    expect(columns.rows.map((row) => row.column_name)).toEqual(['import_key', 'joint_pain_status']);

    const userId = await createUser('phase-6-schema@example.invalid');
    await pool.query(
      `insert into workout_sessions
         (user_id, template_name_snapshot, planned_local_date, time_zone, type, source, import_key)
       values ($1, 'Histórico', '2026-07-13', 'America/Cuiaba', 'strength', 'ad_hoc', 'history-2026-07-13')`,
      [userId],
    );
    await expect(
      pool.query(
        `insert into workout_sessions
           (user_id, template_name_snapshot, planned_local_date, time_zone, type, source, import_key)
         values ($1, 'Duplicado', '2026-07-13', 'America/Cuiaba', 'strength', 'ad_hoc', 'history-2026-07-13')`,
        [userId],
      ),
    ).rejects.toMatchObject({ constraint: 'workout_sessions_user_import_key_unique' });
  });

  it('increments versions and retains tombstones for syncable records', async () => {
    const userId = await createUser('sync@example.invalid');
    const inserted = await pool.query<{ id: string; version: number }>(
      `insert into exercises (user_id, name, category, tracking_metric)
       values ($1, 'Remada de teste', 'força', 'repetitions') returning id, version`,
      [userId],
    );
    expect(inserted.rows[0]!.version).toBe(1);

    const deleted = await pool.query<{ deleted_at: Date; version: number }>(
      `update exercises set deleted_at = now() where id = $1 returning deleted_at, version`,
      [inserted.rows[0]!.id],
    );
    expect(deleted.rows[0]!.deleted_at).toBeInstanceOf(Date);
    expect(deleted.rows[0]!.version).toBe(2);
  });

  it('preserves execution snapshots after catalog and plan changes', async () => {
    const userId = await createUser('history@example.invalid');
    const exercise = await pool.query<{ id: string }>(
      `insert into exercises (user_id, name, category, tracking_metric)
       values ($1, 'Flexão inclinada', 'força', 'repetitions') returning id`,
      [userId],
    );
    const plan = await pool.query<{ id: string }>(
      `insert into training_plans (user_id, name, valid_from, status)
       values ($1, 'Plano inicial', '2026-07-14', 'active') returning id`,
      [userId],
    );
    const template = await pool.query<{ id: string }>(
      `insert into workout_templates (user_id, plan_id, name, type)
       values ($1, $2, 'Treino A', 'strength') returning id`,
      [userId, plan.rows[0]!.id],
    );
    const session = await pool.query<{ id: string }>(
      `insert into workout_sessions
         (user_id, template_id, template_name_snapshot, planned_local_date, time_zone, type, source)
       values ($1, $2, 'Treino A', '2026-07-14', 'America/Cuiaba', 'strength', 'scheduled') returning id`,
      [userId, template.rows[0]!.id],
    );
    await pool.query(
      `insert into session_exercises
         (user_id, session_id, exercise_id, exercise_name_snapshot,
          tracking_metric_snapshot, sort_order)
       values ($1, $2, $3, 'Flexão inclinada', 'repetitions', 0)`,
      [userId, session.rows[0]!.id, exercise.rows[0]!.id],
    );

    await pool.query("update exercises set name = 'Flexão alterada' where id = $1", [
      exercise.rows[0]!.id,
    ]);
    const snapshot = await pool.query<{ exercise_name_snapshot: string }>(
      'select exercise_name_snapshot from session_exercises where session_id = $1',
      [session.rows[0]!.id],
    );
    expect(snapshot.rows[0]!.exercise_name_snapshot).toBe('Flexão inclinada');
  });

  it('does not rewrite historical local dates when the profile time zone changes', async () => {
    const userId = await createUser('timezone@example.invalid');
    await pool.query('insert into user_profiles (user_id, time_zone) values ($1, $2)', [
      userId,
      'America/Cuiaba',
    ]);
    const session = await pool.query<{ id: string }>(
      `insert into workout_sessions
         (user_id, template_name_snapshot, planned_local_date, suggested_local_time, time_zone, type, source)
       values ($1, 'Sessão avulsa', '2026-07-13', '23:30', 'America/Cuiaba', 'strength', 'ad_hoc') returning id`,
      [userId],
    );

    await pool.query("update user_profiles set time_zone = 'Europe/Lisbon' where user_id = $1", [
      userId,
    ]);
    const historical = await pool.query<{
      planned_local_date: string;
      time_zone: string;
    }>('select planned_local_date::text, time_zone from workout_sessions where id = $1', [
      session.rows[0]!.id,
    ]);
    expect(historical.rows[0]).toMatchObject({
      planned_local_date: '2026-07-13',
      time_zone: 'America/Cuiaba',
    });
  });
});
