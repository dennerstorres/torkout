CREATE TYPE "public"."joint_pain_status" AS ENUM('unknown', 'none', 'reported');--> statement-breakpoint
ALTER TABLE "walking_details" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD COLUMN "import_key" text;--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD COLUMN "joint_pain_status" "joint_pain_status" DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "workout_sessions_user_import_key_unique" ON "workout_sessions" USING btree ("user_id","import_key") WHERE "workout_sessions"."import_key" is not null and "workout_sessions"."deleted_at" is null;
