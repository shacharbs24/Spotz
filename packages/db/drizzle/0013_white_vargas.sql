ALTER TABLE "services" ALTER COLUMN "requires_approval" SET DEFAULT true;--> statement-breakpoint
-- Backfill: existing services (defaulted to false by migration 0012) revert to
-- manual approval, preserving the pre-feature booking behavior.
UPDATE "services" SET "requires_approval" = true;
