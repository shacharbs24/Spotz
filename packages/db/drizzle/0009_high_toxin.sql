CREATE TYPE "public"."message_channel" AS ENUM('WHATSAPP');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('PENDING', 'SENT', 'FAILED', 'SKIPPED');--> statement-breakpoint
CREATE TYPE "public"."message_type" AS ENUM('REMINDER_24H');--> statement-breakpoint
CREATE TABLE "appointment_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"appointment_id" uuid NOT NULL,
	"business_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"channel" "message_channel" DEFAULT 'WHATSAPP' NOT NULL,
	"type" "message_type" DEFAULT 'REMINDER_24H' NOT NULL,
	"status" "message_status" DEFAULT 'PENDING' NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"provider_message_id" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointment_messages" ADD CONSTRAINT "appointment_messages_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_messages" ADD CONSTRAINT "appointment_messages_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_messages" ADD CONSTRAINT "appointment_messages_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_appt_message_type" ON "appointment_messages" USING btree ("appointment_id","type");--> statement-breakpoint
CREATE INDEX "idx_message_status_scheduled" ON "appointment_messages" USING btree ("status","scheduled_for");