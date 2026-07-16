ALTER TABLE "body_measurements" DROP CONSTRAINT "body_measurements_value_presence_check";--> statement-breakpoint
ALTER TABLE "body_measurements" ADD COLUMN "additional_measurements" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "body_measurements" ADD CONSTRAINT "body_measurements_value_presence_check" CHECK ("body_measurements"."weight_kg" is not null or "body_measurements"."waist_cm" is not null or jsonb_array_length("body_measurements"."additional_measurements") > 0);--> statement-breakpoint
INSERT INTO public.exercises
  (id, name, category, tracking_metric, is_system, instructions)
VALUES
  (
    '00000000-0000-4000-8000-000000000003',
    'Caminhada',
    'cardio',
    'distance',
    true,
    'Caminhada com distância e duração registradas manualmente.'
  )
ON CONFLICT (id) DO NOTHING;
