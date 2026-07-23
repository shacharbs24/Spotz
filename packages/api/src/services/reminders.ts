import { eq, and, or, gte, lt, asc } from "drizzle-orm";
import { DateTime } from "luxon";
import { db, tables } from "@spotz/db";
import { normalizeIsraeliPhone } from "../lib/phone";
import { sendWhatsAppReminder, WhatsAppApiError } from "./whatsapp";

/**
 * 24h WhatsApp reminders for appointments happening "tomorrow" in each
 * business's own timezone. Deduplicated via `appointment_messages`
 * (unique appointmentId+type). Server-only; called by the cron route.
 */

export type ReminderOutcome =
  | "SENT"
  | "FAILED"
  | "SKIPPED"
  | "ALREADY_HANDLED"
  | "WOULD_SEND"
  | "WOULD_SKIP";

export interface ReminderResult {
  appointmentId: string;
  clientName: string;
  businessName: string;
  serviceName: string;
  date: string;
  time: string;
  phone: string | null; // normalized recipient, null when invalid
  confirmUrl: string; // ${APP_BASE_URL}/b/confirm/${appointmentId} — sent in the template
  outcome: ReminderOutcome;
  reason?: string;
}

export interface ReminderRunSummary {
  dryRun: boolean;
  ranAt: string;
  considered: number;
  sent: number;
  failed: number;
  skipped: number;
  duplicates: number;
  results: ReminderResult[];
}

const REMINDER_TYPE = "REMINDER_24H" as const;

export async function sendDueAppointmentReminders(
  opts: { dryRun?: boolean } = {},
): Promise<ReminderRunSummary> {
  const dryRun = opts.dryRun ?? false;
  const appBaseUrl = process.env.APP_BASE_URL ?? "";

  // Broad UTC window guaranteed to contain "tomorrow" in any timezone; we then
  // filter precisely per-business below. Past appointments are excluded.
  const now = new Date();
  const windowEnd = DateTime.now().plus({ days: 3 }).toJSDate();

  const rows = await db
    .select({
      appointmentId: tables.appointments.id,
      businessId: tables.appointments.businessId,
      clientId: tables.appointments.clientId,
      startAt: tables.appointments.startAt,
      status: tables.appointments.status,
      timezone: tables.businesses.timezone,
      businessName: tables.businesses.name,
      serviceName: tables.services.name,
      clientName: tables.clients.fullName,
      clientPhone: tables.clients.phone,
    })
    .from(tables.appointments)
    .innerJoin(
      tables.businesses,
      eq(tables.appointments.businessId, tables.businesses.id),
    )
    .innerJoin(
      tables.services,
      eq(tables.appointments.serviceId, tables.services.id),
    )
    .innerJoin(
      tables.clients,
      eq(tables.appointments.clientId, tables.clients.id),
    )
    .where(
      and(
        or(
          eq(tables.appointments.status, "PENDING"),
          eq(tables.appointments.status, "CONFIRMED"),
        ),
        gte(tables.appointments.startAt, now),
        lt(tables.appointments.startAt, windowEnd),
      ),
    )
    .orderBy(asc(tables.appointments.startAt));

  const summary: ReminderRunSummary = {
    dryRun,
    ranAt: DateTime.fromJSDate(now).toISO() ?? now.toISOString(),
    considered: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    duplicates: 0,
    results: [],
  };

  for (const row of rows) {
    const tz = row.timezone;
    const apptLocal = DateTime.fromJSDate(row.startAt).setZone(tz);
    const tomorrow = DateTime.now().setZone(tz).plus({ days: 1 });
    // Only appointments whose local calendar day is tomorrow.
    if (!apptLocal.hasSame(tomorrow, "day")) continue;

    summary.considered += 1;

    const localized = apptLocal.setLocale("he");
    const date = localized.toLocaleString({
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    const time = localized.toFormat("HH:mm");
    const phone = normalizeIsraeliPhone(row.clientPhone);
    // Distinguish "no number on file" from "number we couldn't normalize" so the
    // recorded skip reason is actionable.
    const skipReason = row.clientPhone?.trim()
      ? "invalid phone format"
      : "missing phone";
    const confirmUrl = `${appBaseUrl}/b/confirm/${row.appointmentId}`;

    const base = {
      appointmentId: row.appointmentId,
      clientName: row.clientName,
      businessName: row.businessName,
      serviceName: row.serviceName,
      date,
      time,
      phone,
      confirmUrl,
    };

    // --- Dry run: report intent, touch nothing. ---
    if (dryRun) {
      if (!phone) {
        summary.skipped += 1;
        summary.results.push({
          ...base,
          outcome: "WOULD_SKIP",
          reason: skipReason,
        });
      } else {
        summary.results.push({ ...base, outcome: "WOULD_SEND" });
      }
      continue;
    }

    // --- Dedup: claim the (appointment, type) slot. ---
    const [claimed] = await db
      .insert(tables.appointmentMessages)
      .values({
        appointmentId: row.appointmentId,
        businessId: row.businessId,
        clientId: row.clientId,
        channel: "WHATSAPP",
        type: REMINDER_TYPE,
        status: "PENDING",
        scheduledFor: apptLocal.minus({ hours: 24 }).toJSDate(),
      })
      .onConflictDoNothing({
        target: [
          tables.appointmentMessages.appointmentId,
          tables.appointmentMessages.type,
        ],
      })
      .returning({ id: tables.appointmentMessages.id });

    if (!claimed) {
      summary.duplicates += 1;
      summary.results.push({ ...base, outcome: "ALREADY_HANDLED" });
      continue;
    }

    // --- Invalid phone → SKIPPED. ---
    if (!phone) {
      await db
        .update(tables.appointmentMessages)
        .set({
          status: "SKIPPED",
          errorMessage: skipReason,
          updatedAt: new Date(),
        })
        .where(eq(tables.appointmentMessages.id, claimed.id));
      summary.skipped += 1;
      summary.results.push({
        ...base,
        outcome: "SKIPPED",
        reason: skipReason,
      });
      continue;
    }

    // --- Send. ---
    try {
      const { messageId } = await sendWhatsAppReminder({
        to: phone,
        clientName: row.clientName,
        businessName: row.businessName,
        serviceName: row.serviceName,
        date,
        time,
        confirmUrl,
      });
      await db
        .update(tables.appointmentMessages)
        .set({
          status: "SENT",
          sentAt: new Date(),
          providerMessageId: messageId,
          updatedAt: new Date(),
        })
        .where(eq(tables.appointmentMessages.id, claimed.id));
      summary.sent += 1;
      summary.results.push({ ...base, outcome: "SENT" });
    } catch (error) {
      // Capture the Meta error code alongside the message, not just HTTP status.
      const code = error instanceof WhatsAppApiError ? error.code : null;
      const rawMessage = error instanceof Error ? error.message : "send failed";
      const reason = code !== null ? `Meta ${code}: ${rawMessage}` : rawMessage;
      await db
        .update(tables.appointmentMessages)
        .set({
          status: "FAILED",
          errorMessage: reason,
          updatedAt: new Date(),
        })
        .where(eq(tables.appointmentMessages.id, claimed.id));
      summary.failed += 1;
      summary.results.push({ ...base, outcome: "FAILED", reason });
    }
  }

  return summary;
}
