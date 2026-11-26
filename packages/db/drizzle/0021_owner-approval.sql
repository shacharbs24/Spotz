CREATE TABLE "owner_approval_settings" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"contact_phone" text NOT NULL,
	CONSTRAINT "owner_approval_settings_singleton" CHECK ("owner_approval_settings"."id" = 1)
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "owner_access_granted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "owner_approved_at" timestamp with time zone;--> statement-breakpoint
UPDATE "users"
SET "owner_access_granted" = true
WHERE "role" = 'OWNER'
  AND EXISTS (SELECT 1 FROM "businesses" WHERE "businesses"."owner_id" = "users"."id");
