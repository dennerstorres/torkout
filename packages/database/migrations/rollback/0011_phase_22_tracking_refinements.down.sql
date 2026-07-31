-- Reversão da migração 0011_phase_22_tracking_refinements.
--
-- Execute manualmente, em transação única, apenas quando for necessário voltar ao schema anterior.
-- Nenhum registro anterior à migração é afetado: todas as colunas adicionadas são nulas por padrão
-- e as tabelas novas não existiam antes. Ao reverter, os dados de café, whey e fotos são perdidos,
-- portanto exporte antes com `POST /api/v1/exports`.
--
-- O valor 'other' do enum "pain_type" não pode ser removido sem recriar o tipo; a reversão abaixo
-- recria o tipo apenas se nenhum relato estiver usando 'other'.

begin;

drop table if exists "progress_photos";
drop table if exists "whey_intakes";
drop table if exists "coffee_intakes";

drop type if exists "public"."progress_photo_pose";
drop type if exists "public"."whey_tolerance";
drop type if exists "public"."whey_moment";
drop type if exists "public"."whey_mix_base";
drop type if exists "public"."coffee_status";

alter table "workout_sessions" drop constraint if exists "workout_sessions_perceived_exertion_check";
alter table "workout_sessions" drop column if exists "perceived_exertion";
alter table "workout_sessions" drop column if exists "recovery_status";
drop type if exists "public"."recovery_status";

alter table "user_profiles" drop column if exists "goal";

alter table "pain_reports" drop constraint if exists "pain_reports_intensity_score_check";
alter table "pain_reports" drop column if exists "support_difficulty";
alter table "pain_reports" drop column if exists "swelling";
alter table "pain_reports" drop column if exists "intensity_score";

alter table "body_measurements" drop constraint if exists "body_measurements_value_presence_check";
alter table "body_measurements" drop constraint if exists "body_measurements_plausibility_check";
alter table "body_measurements" drop column if exists "fasting";
alter table "body_measurements" drop column if exists "abdomen_cm";
alter table "body_measurements" add constraint "body_measurements_value_presence_check" check ("body_measurements"."weight_kg" is not null or "body_measurements"."waist_cm" is not null or jsonb_array_length("body_measurements"."additional_measurements") > 0);
alter table "body_measurements" add constraint "body_measurements_plausibility_check" check (("body_measurements"."weight_kg" is null or ("body_measurements"."weight_kg" > 0 and "body_measurements"."weight_kg" <= 500)) and ("body_measurements"."waist_cm" is null or ("body_measurements"."waist_cm" > 0 and "body_measurements"."waist_cm" <= 500)));

do $$
begin
  if exists (select 1 from "pain_reports" where "type" = 'other') then
    raise exception 'Existem relatos com tipo "other"; reclassifique-os antes de reverter o enum.';
  end if;
  alter type "public"."pain_type" rename to "pain_type_old";
  create type "public"."pain_type" as enum ('muscular', 'joint');
  alter table "pain_reports"
    alter column "type" type "public"."pain_type" using "type"::text::"public"."pain_type";
  drop type "public"."pain_type_old";
end
$$;

commit;
