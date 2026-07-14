ALTER TABLE "progression_suggestions" ADD COLUMN "safety_notice" text;--> statement-breakpoint
ALTER TABLE "progression_suggestions" ADD COLUMN "safety_notice_version" text;--> statement-breakpoint
UPDATE "progression_suggestions"
SET "safety_notice" = 'Esta sugestão não substitui a orientação de profissional de saúde ou educação física. Em caso de dor forte ou articular, interrompa o exercício e procure avaliação profissional.',
    "safety_notice_version" = '1.0.0'
WHERE "safety_notice" IS NULL;--> statement-breakpoint
ALTER TABLE "progression_suggestions" ALTER COLUMN "safety_notice" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "progression_suggestions" ALTER COLUMN "safety_notice_version" SET NOT NULL;--> statement-breakpoint

UPDATE "progression_rule_versions"
SET "parameters" = "parameters" || '{"minimumRepetitions":1,"maximumRepetitions":30}'::jsonb
WHERE "code" = 'initial-training-progression' AND "version" = '1.0.0';
