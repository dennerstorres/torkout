CREATE TYPE "public"."coffee_status" AS ENUM('not_consumed', 'without_sugar', 'with_sugar');--> statement-breakpoint
CREATE TYPE "public"."progress_photo_pose" AS ENUM('front', 'side', 'back');--> statement-breakpoint
CREATE TYPE "public"."whey_mix_base" AS ENUM('water', 'whole_milk', 'semi_skimmed_milk', 'skimmed_milk', 'other');--> statement-breakpoint
CREATE TYPE "public"."whey_moment" AS ENUM('morning', 'pre_workout', 'post_workout', 'night', 'other');--> statement-breakpoint
CREATE TYPE "public"."whey_tolerance" AS ENUM('none', 'gas', 'bloating', 'cramp', 'diarrhea', 'nausea', 'other');--> statement-breakpoint
CREATE TYPE "public"."recovery_status" AS ENUM('not_answered', 'none', 'reported');--> statement-breakpoint
ALTER TYPE "public"."pain_type" ADD VALUE 'other';--> statement-breakpoint
CREATE TABLE "coffee_intakes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"status" "coffee_status" NOT NULL,
	"recorded_at" timestamp with time zone,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "progress_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"captured_at" timestamp with time zone,
	"pose" "progress_photo_pose" NOT NULL,
	"storage_key" text NOT NULL,
	"content_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"width_px" integer,
	"height_px" integer,
	"measurement_id" uuid,
	"notes" text,
	CONSTRAINT "progress_photos_byte_size_check" CHECK ("progress_photos"."byte_size" > 0),
	CONSTRAINT "progress_photos_dimension_check" CHECK (("progress_photos"."width_px" is null or "progress_photos"."width_px" > 0) and ("progress_photos"."height_px" is null or "progress_photos"."height_px" > 0))
);
--> statement-breakpoint
CREATE TABLE "whey_intakes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"local_time" time,
	"consumed" boolean NOT NULL,
	"powder_grams" numeric(7, 2),
	"servings" numeric(5, 2),
	"protein_per_serving_grams" numeric(6, 2),
	"mixed_with" "whey_mix_base",
	"custom_mixed_with" text,
	"liquid_ml" numeric(8, 2),
	"brand" text,
	"product" text,
	"moment" "whey_moment",
	"tolerance" "whey_tolerance"[] DEFAULT '{}' NOT NULL,
	"notes" text,
	CONSTRAINT "whey_intakes_custom_mix_check" CHECK (("whey_intakes"."mixed_with" = 'other' and nullif(trim("whey_intakes"."custom_mixed_with"), '') is not null) or ("whey_intakes"."mixed_with" is distinct from 'other' and "whey_intakes"."custom_mixed_with" is null)),
	CONSTRAINT "whey_intakes_not_consumed_check" CHECK ("whey_intakes"."consumed" or num_nonnulls("whey_intakes"."powder_grams", "whey_intakes"."servings", "whey_intakes"."protein_per_serving_grams", "whey_intakes"."mixed_with", "whey_intakes"."liquid_ml", "whey_intakes"."moment") = 0),
	CONSTRAINT "whey_intakes_tolerance_check" CHECK (not ('none' = any("whey_intakes"."tolerance")) or cardinality("whey_intakes"."tolerance") = 1),
	CONSTRAINT "whey_intakes_values_check" CHECK (coalesce("whey_intakes"."powder_grams", 0) >= 0 and coalesce("whey_intakes"."servings", 0) >= 0 and coalesce("whey_intakes"."protein_per_serving_grams", 0) >= 0 and coalesce("whey_intakes"."liquid_ml", 0) >= 0)
);
--> statement-breakpoint
ALTER TABLE "body_measurements" DROP CONSTRAINT "body_measurements_value_presence_check";--> statement-breakpoint
ALTER TABLE "body_measurements" DROP CONSTRAINT "body_measurements_plausibility_check";--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "goal" text;--> statement-breakpoint
ALTER TABLE "body_measurements" ADD COLUMN "abdomen_cm" numeric(6, 2);--> statement-breakpoint
ALTER TABLE "body_measurements" ADD COLUMN "fasting" boolean;--> statement-breakpoint
ALTER TABLE "pain_reports" ADD COLUMN "intensity_score" integer;--> statement-breakpoint
ALTER TABLE "pain_reports" ADD COLUMN "swelling" boolean;--> statement-breakpoint
ALTER TABLE "pain_reports" ADD COLUMN "support_difficulty" boolean;--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD COLUMN "recovery_status" "recovery_status" DEFAULT 'not_answered' NOT NULL;--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD COLUMN "perceived_exertion" integer;--> statement-breakpoint
ALTER TABLE "coffee_intakes" ADD CONSTRAINT "coffee_intakes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_photos" ADD CONSTRAINT "progress_photos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_photos" ADD CONSTRAINT "progress_photos_measurement_id_body_measurements_id_fk" FOREIGN KEY ("measurement_id") REFERENCES "public"."body_measurements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whey_intakes" ADD CONSTRAINT "whey_intakes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "coffee_intakes_user_date_unique" ON "coffee_intakes" USING btree ("user_id","local_date") WHERE "coffee_intakes"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "progress_photos_user_date_idx" ON "progress_photos" USING btree ("user_id","local_date");--> statement-breakpoint
CREATE UNIQUE INDEX "progress_photos_storage_key_unique" ON "progress_photos" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "whey_intakes_user_date_idx" ON "whey_intakes" USING btree ("user_id","local_date");--> statement-breakpoint
ALTER TABLE "body_measurements" ADD CONSTRAINT "body_measurements_value_presence_check" CHECK ("body_measurements"."weight_kg" is not null or "body_measurements"."waist_cm" is not null or "body_measurements"."abdomen_cm" is not null or jsonb_array_length("body_measurements"."additional_measurements") > 0);--> statement-breakpoint
ALTER TABLE "body_measurements" ADD CONSTRAINT "body_measurements_plausibility_check" CHECK (("body_measurements"."weight_kg" is null or ("body_measurements"."weight_kg" > 0 and "body_measurements"."weight_kg" <= 500)) and ("body_measurements"."waist_cm" is null or ("body_measurements"."waist_cm" > 0 and "body_measurements"."waist_cm" <= 500)) and ("body_measurements"."abdomen_cm" is null or ("body_measurements"."abdomen_cm" > 0 and "body_measurements"."abdomen_cm" <= 500)));--> statement-breakpoint
ALTER TABLE "pain_reports" ADD CONSTRAINT "pain_reports_intensity_score_check" CHECK ("pain_reports"."intensity_score" is null or ("pain_reports"."intensity_score" between 0 and 10));--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_perceived_exertion_check" CHECK ("workout_sessions"."perceived_exertion" is null or ("workout_sessions"."perceived_exertion" between 0 and 10));