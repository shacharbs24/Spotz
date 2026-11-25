CREATE TABLE "staff_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_business_member_key" UNIQUE("business_id","id")
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "staff_member_id" uuid;--> statement-breakpoint
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_staff_business_name" ON "staff_members" USING btree ("business_id",lower("name"));--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_business_staff_fkey" FOREIGN KEY ("business_id","staff_member_id") REFERENCES "public"."staff_members"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_appt_calendar_time" ON "appointments" USING btree ("business_id","staff_member_id","start_at");--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_no_overlap_business_calendar"
  EXCLUDE USING gist ("business_id" WITH =, tstzrange("start_at", "end_at", '[)') WITH &&)
  WHERE ("status" <> 'CANCELLED' AND "staff_member_id" IS NULL);--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_no_overlap_staff_calendar"
  EXCLUDE USING gist ("staff_member_id" WITH =, tstzrange("start_at", "end_at", '[)') WITH &&)
  WHERE ("status" <> 'CANCELLED' AND "staff_member_id" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_no_overlapping_active";
