UPDATE "privacy_documents"
SET "retired_at" = NULL,
    "updated_at" = now()
WHERE "version" = '2026-07-14'
  AND "type" IN ('privacy_notice', 'terms', 'health_data_consent');
