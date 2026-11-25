CREATE TABLE "staff_services" (
	"business_id" uuid NOT NULL,
	"staff_member_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	CONSTRAINT "staff_services_staff_member_id_service_id_pk" PRIMARY KEY("staff_member_id","service_id")
);
--> statement-breakpoint
ALTER TABLE "blocked_periods" ADD COLUMN "staff_member_id" uuid;--> statement-breakpoint
ALTER TABLE "staff_members" ADD COLUMN "weekly_hours" jsonb;--> statement-breakpoint
ALTER TABLE "staff_members" ADD COLUMN "uses_all_services" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_business_service_key" UNIQUE("business_id","id");--> statement-breakpoint
ALTER TABLE "staff_services" ADD CONSTRAINT "staff_services_business_member_fkey" FOREIGN KEY ("business_id","staff_member_id") REFERENCES "public"."staff_members"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_services" ADD CONSTRAINT "staff_services_business_service_fkey" FOREIGN KEY ("business_id","service_id") REFERENCES "public"."services"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_staff_services_service" ON "staff_services" USING btree ("business_id","service_id");--> statement-breakpoint
ALTER TABLE "blocked_periods" ADD CONSTRAINT "blocked_periods_business_staff_fkey" FOREIGN KEY ("business_id","staff_member_id") REFERENCES "public"."staff_members"("business_id","id") ON DELETE cascade ON UPDATE no action;
