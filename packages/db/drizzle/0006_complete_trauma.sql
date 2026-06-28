ALTER TABLE "businesses" ADD COLUMN "auto_open_calendar" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "auto_open_days" integer DEFAULT 14 NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "manual_open_until" date;