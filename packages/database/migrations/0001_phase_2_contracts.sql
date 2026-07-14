CREATE OR REPLACE FUNCTION public.torkout_set_sync_metadata()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.version := OLD.version + 1;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DO $$
DECLARE
  sync_table record;
BEGIN
  FOR sync_table IN
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name IN ('version', 'updated_at', 'deleted_at')
    GROUP BY table_name
    HAVING count(DISTINCT column_name) = 3
  LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.torkout_set_sync_metadata()',
      'set_sync_metadata',
      sync_table.table_name
    );
  END LOOP;
END;
$$;
--> statement-breakpoint
INSERT INTO public.exercises
  (id, name, category, tracking_metric, is_system, instructions)
VALUES
  (
    '00000000-0000-4000-8000-000000000001',
    'Flexão',
    'força',
    'repetitions',
    true,
    'Exercício de força com o peso corporal. Interrompa em caso de dor articular.'
  ),
  (
    '00000000-0000-4000-8000-000000000002',
    'Agachamento livre',
    'força',
    'repetitions',
    true,
    'Agachamento sem carga externa. Interrompa em caso de dor articular.'
  );
--> statement-breakpoint
INSERT INTO public.progression_rule_versions
  (id, code, version, parameters, effective_at)
VALUES
  (
    '00000000-0000-4000-8000-000000000101',
    'initial-training-progression',
    '1.0.0',
    '{"minimumPainFreeSessions":2,"jointPainBlocksIncrease":true,"missedWorkoutDoublesNext":false}'::jsonb,
    '2026-07-14T00:00:00Z'
  );
