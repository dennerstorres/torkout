CREATE TABLE "consumed_auth_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purpose" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "consumed_auth_tokens_hash_unique" ON "consumed_auth_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "consumed_auth_tokens_expires_at_idx" ON "consumed_auth_tokens" USING btree ("expires_at");--> statement-breakpoint
INSERT INTO "privacy_documents" ("type", "version", "content_hash", "effective_at") VALUES
  ('privacy_notice', '2026-07-14', '91be7fbfa82df8322c16c8b12411b000f4c6952f8452fbbf676478db51221b57', '2026-07-14T00:00:00Z'),
  ('terms', '2026-07-14', 'dcaacfcde40a7d9a29b80dbc69382e52f359d992a468cd392ae7dec48b7d86f8', '2026-07-14T00:00:00Z'),
  ('health_data_consent', '2026-07-14', 'efcaab8b11fbfe97872b3f314a513dc7b852575f2eec941b27d8def3d2c1948c', '2026-07-14T00:00:00Z')
ON CONFLICT ("type", "version") DO NOTHING;
