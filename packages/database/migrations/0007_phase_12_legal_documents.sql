UPDATE "privacy_documents"
SET "retired_at" = '2026-07-15T00:00:00Z'
WHERE "retired_at" IS NULL;
--> statement-breakpoint
INSERT INTO "privacy_documents" ("type", "version", "content_hash", "effective_at") VALUES
  ('privacy_notice', '2026-07-15', '10b5e573bc4d49a1a7c0c0aa0e143d7acad995effaba08b7a985ac618e0bdb18', '2026-07-15T00:00:00Z'),
  ('terms', '2026-07-15', 'b79d96d66f87f86782188d4e9a2ed0849959d3c14b4a0e1d92bb2ce09466482d', '2026-07-15T00:00:00Z'),
  ('health_data_consent', '2026-07-15', '751dc1147e43ce1caf6a1eaf1077918bb2c28dd009ea948951c52758976a5269', '2026-07-15T00:00:00Z');
