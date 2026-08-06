ALTER TABLE "mcp_authorization_codes" ALTER COLUMN "code_challenge" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "mcp_authorization_codes" ALTER COLUMN "code_challenge_method" DROP NOT NULL;