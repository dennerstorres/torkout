ALTER TABLE "schedule_rules" DROP CONSTRAINT "schedule_rules_weekday_check";--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD COLUMN "schedule_rule_id" uuid;--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD COLUMN "template_name_snapshot" text;--> statement-breakpoint
UPDATE "workout_sessions" AS session
SET "template_name_snapshot" = coalesce(
  (SELECT template."name" FROM "workout_templates" AS template WHERE template."id" = session."template_id"),
  CASE WHEN session."source" = 'ad_hoc' THEN 'Sessão avulsa' ELSE 'Sessão planejada' END
);--> statement-breakpoint
ALTER TABLE "workout_sessions" ALTER COLUMN "template_name_snapshot" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_schedule_rule_id_schedule_rules_id_fk" FOREIGN KEY ("schedule_rule_id") REFERENCES "public"."schedule_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workout_sessions_rule_date_unique" ON "workout_sessions" USING btree ("schedule_rule_id","planned_local_date") WHERE "workout_sessions"."schedule_rule_id" is not null and "workout_sessions"."deleted_at" is null;--> statement-breakpoint
ALTER TABLE "schedule_rules" ADD CONSTRAINT "schedule_rules_weekday_check" CHECK ("schedule_rules"."weekday" between 1 and 7);
