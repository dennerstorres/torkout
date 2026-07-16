ALTER TABLE "exercises" DROP CONSTRAINT "exercises_ownership_check";--> statement-breakpoint
DROP INDEX "exercises_system_name_unique";--> statement-breakpoint
DROP INDEX "exercises_user_name_unique";--> statement-breakpoint

INSERT INTO public.exercises
  (id, user_id, name, category, tracking_metric, is_system, instructions, active)
SELECT
  gen_random_uuid(),
  users.id,
  seed.name,
  seed.category,
  seed.tracking_metric::tracking_metric,
  false,
  seed.instructions,
  true
FROM public.users
CROSS JOIN (
  VALUES
    (
      'Flexão',
      'força',
      'repetitions',
      'Exercício de força com o peso corporal. Interrompa em caso de dor articular.'
    ),
    (
      'Agachamento livre',
      'força',
      'repetitions',
      'Agachamento sem carga externa. Interrompa em caso de dor articular.'
    ),
    (
      'Caminhada',
      'cardio',
      'distance',
      'Caminhada com distância e duração registradas manualmente.'
    )
) AS seed(name, category, tracking_metric, instructions)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.exercises existing
  WHERE existing.user_id = users.id
    AND lower(existing.name) = lower(seed.name)
    AND existing.deleted_at IS NULL
);--> statement-breakpoint

UPDATE public.workout_template_exercises reference
SET exercise_id = owned.id
FROM public.exercises global, public.exercises owned
WHERE reference.exercise_id = global.id
  AND global.is_system = true
  AND owned.user_id = reference.user_id
  AND lower(owned.name) = lower(global.name)
  AND owned.deleted_at IS NULL;--> statement-breakpoint

UPDATE public.session_exercises reference
SET exercise_id = owned.id
FROM public.exercises global, public.exercises owned
WHERE reference.exercise_id = global.id
  AND global.is_system = true
  AND owned.user_id = reference.user_id
  AND lower(owned.name) = lower(global.name)
  AND owned.deleted_at IS NULL;--> statement-breakpoint

UPDATE public.progression_evaluations reference
SET exercise_id = owned.id
FROM public.exercises global, public.exercises owned
WHERE reference.exercise_id = global.id
  AND global.is_system = true
  AND owned.user_id = reference.user_id
  AND lower(owned.name) = lower(global.name)
  AND owned.deleted_at IS NULL;--> statement-breakpoint

UPDATE public.pain_reports reference
SET exercise_id = owned.id
FROM public.exercises global, public.exercises owned
WHERE reference.exercise_id = global.id
  AND global.is_system = true
  AND owned.user_id = reference.user_id
  AND lower(owned.name) = lower(global.name)
  AND owned.deleted_at IS NULL;--> statement-breakpoint

INSERT INTO public.change_log
  (user_id, entity_type, entity_id, version, operation, deleted_at, payload)
SELECT
  exercise.user_id,
  'exercise',
  exercise.id,
  exercise.version,
  'create',
  exercise.deleted_at,
  jsonb_build_object(
    'active', exercise.active,
    'category', exercise.category,
    'deletedAt', exercise.deleted_at,
    'id', exercise.id,
    'instructions', exercise.instructions,
    'name', exercise.name,
    'trackingMetric', exercise.tracking_metric,
    'version', exercise.version
  )
FROM public.exercises exercise
WHERE exercise.user_id IS NOT NULL
  AND exercise.deleted_at IS NULL
  AND exercise.name IN ('Flexão', 'Agachamento livre', 'Caminhada');--> statement-breakpoint

DELETE FROM public.exercises WHERE is_system = true;--> statement-breakpoint
ALTER TABLE "exercises" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "exercises_user_name_unique" ON "exercises" USING btree ("user_id",lower("name")) WHERE "exercises"."deleted_at" is null;--> statement-breakpoint
ALTER TABLE "exercises" DROP COLUMN "is_system";--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.torkout_seed_initial_exercises()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  WITH seeded AS (
    INSERT INTO public.exercises
      (user_id, name, category, tracking_metric, instructions, active)
    VALUES
      (
        NEW.id,
        'Flexão',
        'força',
        'repetitions',
        'Exercício de força com o peso corporal. Interrompa em caso de dor articular.',
        true
      ),
      (
        NEW.id,
        'Agachamento livre',
        'força',
        'repetitions',
        'Agachamento sem carga externa. Interrompa em caso de dor articular.',
        true
      ),
      (
        NEW.id,
        'Caminhada',
        'cardio',
        'distance',
        'Caminhada com distância e duração registradas manualmente.',
        true
      )
    RETURNING *
  )
  INSERT INTO public.change_log
    (user_id, entity_type, entity_id, version, operation, deleted_at, payload)
  SELECT
    seeded.user_id,
    'exercise',
    seeded.id,
    seeded.version,
    'create',
    seeded.deleted_at,
    jsonb_build_object(
      'active', seeded.active,
      'category', seeded.category,
      'deletedAt', seeded.deleted_at,
      'id', seeded.id,
      'instructions', seeded.instructions,
      'name', seeded.name,
      'trackingMetric', seeded.tracking_metric,
      'version', seeded.version
    )
  FROM seeded;
  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER seed_initial_exercises
AFTER INSERT ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.torkout_seed_initial_exercises();
