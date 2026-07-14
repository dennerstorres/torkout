ALTER TABLE "change_log" ADD COLUMN "payload" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "sync_operations" ADD COLUMN "response" jsonb DEFAULT '{}'::jsonb NOT NULL;