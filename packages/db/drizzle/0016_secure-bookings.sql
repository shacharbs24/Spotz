CREATE EXTENSION IF NOT EXISTS "btree_gist";--> statement-breakpoint
DROP INDEX "uq_client_business_phone";--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "confirmation_token" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_business_owner" ON "businesses" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_client_business_user" ON "clients" USING btree ("business_id","user_id") WHERE "clients"."user_id" is not null;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_confirmation_token_unique" UNIQUE("confirmation_token");--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_no_overlapping_active"
  EXCLUDE USING gist (
    "business_id" WITH =,
    tstzrange("start_at", "end_at", '[)') WITH &&
  ) WHERE ("status" <> 'CANCELLED');
