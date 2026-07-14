CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."privacy_document_type" AS ENUM('privacy_notice', 'terms', 'health_data_consent');--> statement-breakpoint
CREATE TYPE "public"."unit_system" AS ENUM('metric');--> statement-breakpoint
CREATE TYPE "public"."progression_decision" AS ENUM('accepted', 'ignored', 'snoozed');--> statement-breakpoint
CREATE TYPE "public"."progression_outcome" AS ENUM('eligible', 'blocked', 'no_change');--> statement-breakpoint
CREATE TYPE "public"."progression_suggestion_status" AS ENUM('pending', 'accepted', 'ignored', 'snoozed', 'invalidated', 'expired');--> statement-breakpoint
CREATE TYPE "public"."progression_suggestion_type" AS ENUM('increase', 'maintain', 'reduce', 'stop');--> statement-breakpoint
CREATE TYPE "public"."audit_actor_type" AS ENUM('user', 'admin', 'system');--> statement-breakpoint
CREATE TYPE "public"."sync_operation_result" AS ENUM('applied', 'duplicate', 'rejected', 'unauthorized', 'conflict');--> statement-breakpoint
CREATE TYPE "public"."sync_operation_type" AS ENUM('create', 'update', 'delete', 'resolve');--> statement-breakpoint
CREATE TYPE "public"."body_region" AS ENUM('neck', 'shoulder', 'arm', 'elbow', 'wrist', 'hand', 'chest', 'back', 'abdomen', 'hip', 'thigh', 'knee', 'leg', 'ankle', 'foot', 'other');--> statement-breakpoint
CREATE TYPE "public"."habit_type" AS ENUM('boolean', 'quantity', 'scale', 'choice');--> statement-breakpoint
CREATE TYPE "public"."pain_intensity" AS ENUM('not_informed', 'light', 'moderate', 'strong');--> statement-breakpoint
CREATE TYPE "public"."pain_moment" AS ENUM('before', 'during', 'after', 'next_day');--> statement-breakpoint
CREATE TYPE "public"."pain_type" AS ENUM('muscular', 'joint');--> statement-breakpoint
CREATE TYPE "public"."activity_type" AS ENUM('strength', 'walk', 'rest', 'other');--> statement-breakpoint
CREATE TYPE "public"."distance_source" AS ENUM('manual', 'gps', 'import');--> statement-breakpoint
CREATE TYPE "public"."plan_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."session_exercise_status" AS ENUM('planned', 'completed', 'skipped', 'stopped');--> statement-breakpoint
CREATE TYPE "public"."session_source" AS ENUM('scheduled', 'ad_hoc', 'progression');--> statement-breakpoint
CREATE TYPE "public"."tracking_metric" AS ENUM('repetitions', 'duration', 'distance');--> statement-breakpoint
CREATE TYPE "public"."workout_status" AS ENUM('planned', 'in_progress', 'completed', 'partial', 'missed', 'cancelled');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"id_token" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"banned" boolean DEFAULT false NOT NULL,
	"ban_reason" text,
	"ban_expires" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "privacy_acceptances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address_hash" text,
	"user_agent_family" text
);
--> statement-breakpoint
CREATE TABLE "privacy_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "privacy_document_type" NOT NULL,
	"version" text NOT NULL,
	"content_hash" text NOT NULL,
	"effective_at" timestamp with time zone NOT NULL,
	"retired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"height_cm" numeric(5, 2),
	"time_zone" text DEFAULT 'America/Cuiaba' NOT NULL,
	"locale" text DEFAULT 'pt-BR' NOT NULL,
	"week_starts_on" integer DEFAULT 1 NOT NULL,
	"preferred_workout_time" time,
	"unit_system" "unit_system" DEFAULT 'metric' NOT NULL,
	CONSTRAINT "user_profiles_height_cm_check" CHECK ("user_profiles"."height_cm" is null or ("user_profiles"."height_cm" > 0 and "user_profiles"."height_cm" <= 300)),
	CONSTRAINT "user_profiles_week_starts_on_check" CHECK ("user_profiles"."week_starts_on" between 0 and 6)
);
--> statement-breakpoint
CREATE TABLE "progression_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"suggestion_id" uuid NOT NULL,
	"decision" "progression_decision" NOT NULL,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	"effect_plan_id" uuid,
	"effect_entity_id" uuid,
	CONSTRAINT "progression_decisions_effect_check" CHECK ("progression_decisions"."decision" <> 'accepted' or "progression_decisions"."effect_entity_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "progression_evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"rule_version_id" uuid NOT NULL,
	"exercise_id" uuid,
	"evidence" jsonb NOT NULL,
	"evidence_hash" text NOT NULL,
	"outcome" "progression_outcome" NOT NULL,
	"evaluated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "progression_rule_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"version" text NOT NULL,
	"parameters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"effective_at" timestamp with time zone NOT NULL,
	"retired_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "progression_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"evaluation_id" uuid NOT NULL,
	"type" "progression_suggestion_type" NOT NULL,
	"proposal" jsonb NOT NULL,
	"explanation" text NOT NULL,
	"status" "progression_suggestion_status" DEFAULT 'pending' NOT NULL,
	"valid_until" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"actor_type" "audit_actor_type" NOT NULL,
	"event_type" text NOT NULL,
	"subject_type" text,
	"subject_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "change_log" (
	"sequence" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"operation" "sync_operation_type" NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "change_log_version_check" CHECK ("change_log"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "registered_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"device_key_hash" text NOT NULL,
	"display_name" text,
	"platform" text,
	"last_synced_at" timestamp with time zone,
	"offline_authorized_until" timestamp with time zone NOT NULL,
	CONSTRAINT "registered_devices_offline_window_check" CHECK ("registered_devices"."offline_authorized_until" <= "registered_devices"."created_at" + interval '30 days')
);
--> statement-breakpoint
CREATE TABLE "sync_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"operation_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"operation" "sync_operation_type" NOT NULL,
	"base_version" integer,
	"result" "sync_operation_result" NOT NULL,
	"error_code" text,
	"client_occurred_at" timestamp with time zone NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sync_operations_base_version_check" CHECK ("sync_operations"."base_version" is null or "sync_operations"."base_version" > 0)
);
--> statement-breakpoint
CREATE TABLE "body_measurements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"measured_at" timestamp with time zone NOT NULL,
	"weight_kg" numeric(6, 2),
	"waist_cm" numeric(6, 2),
	"notes" text,
	CONSTRAINT "body_measurements_value_presence_check" CHECK ("body_measurements"."weight_kg" is not null or "body_measurements"."waist_cm" is not null),
	CONSTRAINT "body_measurements_plausibility_check" CHECK (("body_measurements"."weight_kg" is null or ("body_measurements"."weight_kg" > 0 and "body_measurements"."weight_kg" <= 500)) and ("body_measurements"."waist_cm" is null or ("body_measurements"."waist_cm" > 0 and "body_measurements"."waist_cm" <= 500)))
);
--> statement-breakpoint
CREATE TABLE "habit_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" "habit_type" NOT NULL,
	"unit" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "habit_definitions_sort_order_check" CHECK ("habit_definitions"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "habit_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"habit_definition_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"boolean_value" boolean,
	"numeric_value" numeric(12, 3),
	"text_value" text,
	"selected_option_id" uuid,
	"notes" text,
	CONSTRAINT "habit_entries_exactly_one_value_check" CHECK (num_nonnulls("habit_entries"."boolean_value", "habit_entries"."numeric_value", "habit_entries"."text_value", "habit_entries"."selected_option_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "habit_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"habit_definition_id" uuid NOT NULL,
	"label" text NOT NULL,
	"stable_value" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "habit_options_sort_order_check" CHECK ("habit_options"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "pain_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"type" "pain_type" NOT NULL,
	"intensity" "pain_intensity" DEFAULT 'not_informed' NOT NULL,
	"moment" "pain_moment" NOT NULL,
	"body_region" "body_region" NOT NULL,
	"custom_body_region" text,
	"session_id" uuid,
	"exercise_id" uuid,
	"exercise_set_id" uuid,
	"exercise_stopped" boolean DEFAULT false NOT NULL,
	"occurred_at" timestamp with time zone,
	"notes" text,
	CONSTRAINT "pain_reports_custom_region_check" CHECK (("pain_reports"."body_region" = 'other' and nullif(trim("pain_reports"."custom_body_region"), '') is not null) or ("pain_reports"."body_region" <> 'other' and "pain_reports"."custom_body_region" is null))
);
--> statement-breakpoint
CREATE TABLE "exercise_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"session_exercise_id" uuid NOT NULL,
	"set_number" integer NOT NULL,
	"planned_repetitions" integer,
	"actual_repetitions" integer,
	"planned_duration_seconds" integer,
	"actual_duration_seconds" integer,
	"planned_distance_meters" numeric(10, 2),
	"actual_distance_meters" numeric(10, 2),
	"completed" boolean DEFAULT false NOT NULL,
	CONSTRAINT "exercise_sets_number_check" CHECK ("exercise_sets"."set_number" > 0),
	CONSTRAINT "exercise_sets_values_check" CHECK (coalesce("exercise_sets"."planned_repetitions", 0) >= 0 and coalesce("exercise_sets"."actual_repetitions", 0) >= 0 and coalesce("exercise_sets"."planned_duration_seconds", 0) >= 0 and coalesce("exercise_sets"."actual_duration_seconds", 0) >= 0 and coalesce("exercise_sets"."planned_distance_meters", 0) >= 0 and coalesce("exercise_sets"."actual_distance_meters", 0) >= 0)
);
--> statement-breakpoint
CREATE TABLE "exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" uuid,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"tracking_metric" "tracking_metric" NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"instructions" text,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "exercises_ownership_check" CHECK (("exercises"."is_system" = true and "exercises"."user_id" is null) or ("exercises"."is_system" = false and "exercises"."user_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "schedule_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"weekday" integer NOT NULL,
	"local_time" time NOT NULL,
	"time_zone" text NOT NULL,
	"valid_from" date NOT NULL,
	"valid_until" date,
	CONSTRAINT "schedule_rules_weekday_check" CHECK ("schedule_rules"."weekday" between 0 and 6),
	CONSTRAINT "schedule_rules_validity_check" CHECK ("schedule_rules"."valid_until" is null or "schedule_rules"."valid_until" >= "schedule_rules"."valid_from")
);
--> statement-breakpoint
CREATE TABLE "session_exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"exercise_id" uuid,
	"source_template_exercise_id" uuid,
	"exercise_name_snapshot" text NOT NULL,
	"tracking_metric_snapshot" "tracking_metric" NOT NULL,
	"sort_order" integer NOT NULL,
	"status" "session_exercise_status" DEFAULT 'planned' NOT NULL,
	"notes" text,
	CONSTRAINT "session_exercises_order_check" CHECK ("session_exercises"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "training_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"valid_from" date NOT NULL,
	"valid_until" date,
	"status" "plan_status" DEFAULT 'draft' NOT NULL,
	CONSTRAINT "training_plans_validity_check" CHECK ("training_plans"."valid_until" is null or "training_plans"."valid_until" >= "training_plans"."valid_from")
);
--> statement-breakpoint
CREATE TABLE "walking_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"planned_distance_meters" numeric(10, 2),
	"actual_distance_meters" numeric(10, 2),
	"duration_seconds" integer,
	"distance_source" "distance_source" DEFAULT 'manual' NOT NULL,
	CONSTRAINT "walking_details_values_check" CHECK (coalesce("walking_details"."planned_distance_meters", 0) >= 0 and coalesce("walking_details"."actual_distance_meters", 0) >= 0 and coalesce("walking_details"."duration_seconds", 0) >= 0)
);
--> statement-breakpoint
CREATE TABLE "workout_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"template_id" uuid,
	"planned_local_date" date NOT NULL,
	"suggested_local_time" time,
	"time_zone" text NOT NULL,
	"type" "activity_type" NOT NULL,
	"status" "workout_status" DEFAULT 'planned' NOT NULL,
	"source" "session_source" NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"notes" text,
	CONSTRAINT "workout_sessions_chronology_check" CHECK ("workout_sessions"."completed_at" is null or "workout_sessions"."started_at" is null or "workout_sessions"."completed_at" >= "workout_sessions"."started_at")
);
--> statement-breakpoint
CREATE TABLE "workout_template_exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"sort_order" integer NOT NULL,
	"notes" text,
	CONSTRAINT "workout_template_exercises_order_check" CHECK ("workout_template_exercises"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "workout_template_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"template_exercise_id" uuid NOT NULL,
	"set_number" integer NOT NULL,
	"target_repetitions" integer,
	"target_duration_seconds" integer,
	"target_distance_meters" numeric(10, 2),
	CONSTRAINT "workout_template_sets_number_check" CHECK ("workout_template_sets"."set_number" > 0),
	CONSTRAINT "workout_template_sets_target_check" CHECK (num_nonnulls("workout_template_sets"."target_repetitions", "workout_template_sets"."target_duration_seconds", "workout_template_sets"."target_distance_meters") = 1),
	CONSTRAINT "workout_template_sets_positive_check" CHECK (coalesce("workout_template_sets"."target_repetitions", 1) > 0 and coalesce("workout_template_sets"."target_duration_seconds", 1) > 0 and coalesce("workout_template_sets"."target_distance_meters", 1) > 0)
);
--> statement-breakpoint
CREATE TABLE "workout_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" "activity_type" NOT NULL,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "privacy_acceptances" ADD CONSTRAINT "privacy_acceptances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "privacy_acceptances" ADD CONSTRAINT "privacy_acceptances_document_id_privacy_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."privacy_documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progression_decisions" ADD CONSTRAINT "progression_decisions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progression_decisions" ADD CONSTRAINT "progression_decisions_suggestion_id_progression_suggestions_id_fk" FOREIGN KEY ("suggestion_id") REFERENCES "public"."progression_suggestions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progression_decisions" ADD CONSTRAINT "progression_decisions_effect_plan_id_training_plans_id_fk" FOREIGN KEY ("effect_plan_id") REFERENCES "public"."training_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progression_evaluations" ADD CONSTRAINT "progression_evaluations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progression_evaluations" ADD CONSTRAINT "progression_evaluations_rule_version_id_progression_rule_versions_id_fk" FOREIGN KEY ("rule_version_id") REFERENCES "public"."progression_rule_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progression_evaluations" ADD CONSTRAINT "progression_evaluations_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progression_suggestions" ADD CONSTRAINT "progression_suggestions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progression_suggestions" ADD CONSTRAINT "progression_suggestions_evaluation_id_progression_evaluations_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."progression_evaluations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_log" ADD CONSTRAINT "change_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registered_devices" ADD CONSTRAINT "registered_devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_operations" ADD CONSTRAINT "sync_operations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_operations" ADD CONSTRAINT "sync_operations_device_id_registered_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."registered_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "body_measurements" ADD CONSTRAINT "body_measurements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_definitions" ADD CONSTRAINT "habit_definitions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_entries" ADD CONSTRAINT "habit_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_entries" ADD CONSTRAINT "habit_entries_habit_definition_id_habit_definitions_id_fk" FOREIGN KEY ("habit_definition_id") REFERENCES "public"."habit_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_entries" ADD CONSTRAINT "habit_entries_selected_option_id_habit_options_id_fk" FOREIGN KEY ("selected_option_id") REFERENCES "public"."habit_options"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_options" ADD CONSTRAINT "habit_options_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_options" ADD CONSTRAINT "habit_options_habit_definition_id_habit_definitions_id_fk" FOREIGN KEY ("habit_definition_id") REFERENCES "public"."habit_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pain_reports" ADD CONSTRAINT "pain_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pain_reports" ADD CONSTRAINT "pain_reports_session_id_workout_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."workout_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pain_reports" ADD CONSTRAINT "pain_reports_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pain_reports" ADD CONSTRAINT "pain_reports_exercise_set_id_exercise_sets_id_fk" FOREIGN KEY ("exercise_set_id") REFERENCES "public"."exercise_sets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_sets" ADD CONSTRAINT "exercise_sets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_sets" ADD CONSTRAINT "exercise_sets_session_exercise_id_session_exercises_id_fk" FOREIGN KEY ("session_exercise_id") REFERENCES "public"."session_exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_rules" ADD CONSTRAINT "schedule_rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_rules" ADD CONSTRAINT "schedule_rules_template_id_workout_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."workout_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_exercises" ADD CONSTRAINT "session_exercises_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_exercises" ADD CONSTRAINT "session_exercises_session_id_workout_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."workout_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_exercises" ADD CONSTRAINT "session_exercises_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_exercises" ADD CONSTRAINT "session_exercises_source_template_exercise_id_workout_template_exercises_id_fk" FOREIGN KEY ("source_template_exercise_id") REFERENCES "public"."workout_template_exercises"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_plans" ADD CONSTRAINT "training_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "walking_details" ADD CONSTRAINT "walking_details_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "walking_details" ADD CONSTRAINT "walking_details_session_id_workout_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."workout_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_template_id_workout_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."workout_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_template_exercises" ADD CONSTRAINT "workout_template_exercises_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_template_exercises" ADD CONSTRAINT "workout_template_exercises_template_id_workout_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."workout_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_template_exercises" ADD CONSTRAINT "workout_template_exercises_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_template_sets" ADD CONSTRAINT "workout_template_sets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_template_sets" ADD CONSTRAINT "workout_template_sets_template_exercise_id_workout_template_exercises_id_fk" FOREIGN KEY ("template_exercise_id") REFERENCES "public"."workout_template_exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_templates" ADD CONSTRAINT "workout_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_templates" ADD CONSTRAINT "workout_templates_plan_id_training_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."training_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_provider_account_unique" ON "accounts" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_unique" ON "sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_unique" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "privacy_acceptances_user_document_unique" ON "privacy_acceptances" USING btree ("user_id","document_id");--> statement-breakpoint
CREATE INDEX "privacy_acceptances_user_id_idx" ON "privacy_acceptances" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "privacy_documents_type_version_unique" ON "privacy_documents" USING btree ("type","version");--> statement-breakpoint
CREATE UNIQUE INDEX "user_profiles_user_id_unique" ON "user_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "progression_decisions_suggestion_unique" ON "progression_decisions" USING btree ("suggestion_id");--> statement-breakpoint
CREATE UNIQUE INDEX "progression_evaluations_evidence_unique" ON "progression_evaluations" USING btree ("user_id","rule_version_id","evidence_hash");--> statement-breakpoint
CREATE INDEX "progression_evaluations_user_id_idx" ON "progression_evaluations" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "progression_rule_versions_code_version_unique" ON "progression_rule_versions" USING btree ("code","version");--> statement-breakpoint
CREATE UNIQUE INDEX "progression_suggestions_evaluation_unique" ON "progression_suggestions" USING btree ("evaluation_id");--> statement-breakpoint
CREATE INDEX "progression_suggestions_user_status_idx" ON "progression_suggestions" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "audit_events_user_created_idx" ON "audit_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "change_log_user_sequence_idx" ON "change_log" USING btree ("user_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "registered_devices_user_key_unique" ON "registered_devices" USING btree ("user_id","device_key_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "sync_operations_user_operation_unique" ON "sync_operations" USING btree ("user_id","operation_id");--> statement-breakpoint
CREATE INDEX "sync_operations_device_idx" ON "sync_operations" USING btree ("device_id","processed_at");--> statement-breakpoint
CREATE INDEX "body_measurements_user_date_idx" ON "body_measurements" USING btree ("user_id","local_date");--> statement-breakpoint
CREATE UNIQUE INDEX "habit_definitions_user_name_unique" ON "habit_definitions" USING btree ("user_id",lower("name")) WHERE "habit_definitions"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "habit_entries_definition_date_unique" ON "habit_entries" USING btree ("user_id","habit_definition_id","local_date");--> statement-breakpoint
CREATE UNIQUE INDEX "habit_options_value_unique" ON "habit_options" USING btree ("habit_definition_id","stable_value");--> statement-breakpoint
CREATE INDEX "pain_reports_user_date_idx" ON "pain_reports" USING btree ("user_id","local_date");--> statement-breakpoint
CREATE UNIQUE INDEX "exercise_sets_number_unique" ON "exercise_sets" USING btree ("session_exercise_id","set_number");--> statement-breakpoint
CREATE INDEX "exercises_user_id_idx" ON "exercises" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "exercises_user_name_unique" ON "exercises" USING btree ("user_id",lower("name")) WHERE "exercises"."user_id" is not null and "exercises"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "exercises_system_name_unique" ON "exercises" USING btree (lower("name")) WHERE "exercises"."is_system" = true and "exercises"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "schedule_rules_user_id_idx" ON "schedule_rules" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "session_exercises_order_unique" ON "session_exercises" USING btree ("session_id","sort_order");--> statement-breakpoint
CREATE INDEX "training_plans_user_id_idx" ON "training_plans" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "walking_details_session_unique" ON "walking_details" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "workout_sessions_user_date_idx" ON "workout_sessions" USING btree ("user_id","planned_local_date");--> statement-breakpoint
CREATE UNIQUE INDEX "workout_template_exercises_order_unique" ON "workout_template_exercises" USING btree ("template_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "workout_template_sets_number_unique" ON "workout_template_sets" USING btree ("template_exercise_id","set_number");--> statement-breakpoint
CREATE INDEX "workout_templates_plan_id_idx" ON "workout_templates" USING btree ("plan_id");