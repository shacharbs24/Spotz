import { eq, and, or, gt, lt, lte, isNull, asc, sql } from "drizzle-orm";
import { DateTime } from "luxon";
import { db, tables } from "@spotz/db";
import { normalizeIsraeliPhone } from "../lib/phone";
import { sendWhatsAppReminder, WhatsAppApiError } from "./whatsapp";
import {
  MAX_SEND_ATTEMPTS,
  buildConfirmationUrl,
  getNextReminderRetryAt,
  getReminderWindowEnd,
  isReminderRetryEligible,
  normalizeAppBaseUrl,
} from "./reminder-policy";

/**
 * WhatsApp reminders for appointments entering the next-24-hours window.
 * Deduplicated via `appointment_messages` (unique appointmentId+type), with a
 * bounded, atomic retry policy for provider failures. Server-only.
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
  confirmUrl: string; // appointment path + private token — sent in the template
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
  retried: number;
  results: ReminderResult[];
}

const REMINDER_TYPE = "REMINDER_24H" as const;

export async function sendDueAppointmentReminders(
  opts: { dryRun?: boolean } = {},
): Promise<ReminderRunSummary> {
  const dryRun = opts.dryRun ?? false;
  const appBaseUrl = normalizeAppBaseUrl(process.env.APP_BASE_URL);

  // Every appointment enters the due window exactly once at startAt - 24h.
  // Hourly runs and the unique message row make catch-up safe after a missed run.
  const now = new Date();
  const windowEnd = getReminderWindowEnd(now);

  const rows = await db
    .select({
      appointmentId: tables.appointments.id,
      confirmationToken: tables.appointments.confirmationToken,
      businessId: tables.appointments.businessId,
      clientId: tables.appointments.clientId,
      startAt: tables.appointments.startAt,
      status: tables.appointments.status,
      timezone: tables.businesses.timezone,
      businessName: tables.businesses.name,
      serviceName: tables.services.name,
      clientName: tables.clients.fullName,
      clientPhone: tables.clients.phone,
      messageStatus: tables.appointmentMessages.status,
      messageAttemptCount: tables.appointmentMessages.attemptCount,
      messageNextAttemptAt: tables.appointmentMessages.nextAttemptAt,
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
    .leftJoin(
      tables.appointmentMessages,
      and(
        eq(tables.appointmentMessages.appointmentId, tables.appointments.id),
        eq(tables.appointmentMessages.type, REMINDER_TYPE),
      ),
    )
    .where(
      and(
        or(
          eq(tables.appointments.status, "PENDING"),
          eq(tables.appointments.status, "CONFIRMED"),
        ),
        gt(tables.appointments.startAt, now),
        lte(tables.appointments.startAt, windowEnd),
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
    retried: 0,
    results: [],
  };

  for (const row of rows) {
    const tz = row.timezone;
    const apptLocal = DateTime.fromJSDate(row.startAt).setZone(tz);
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
    const confirmUrl = buildConfirmationUrl(
      appBaseUrl,
      row.appointmentId,
      row.confirmationToken,
    );

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

    const existingRetryEligible = isReminderRetryEligible(
      {
        status: row.messageStatus,
        attemptCount: row.messageAttemptCount,
        nextAttemptAt: row.messageNextAttemptAt,
      },
      now,
    );

    // --- Dry run: report intent accurately, touch nothing. ---
    if (dryRun) {
      if (row.messageStatus && !existingRetryEligible) {
        summary.duplicates += 1;
        summary.results.push({
          ...base,
          outcome: "ALREADY_HANDLED",
          reason: `message status: ${row.messageStatus}`,
        });
        continue;
      }
      if (existingRetryEligible) summary.retried += 1;

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
    const [inserted] = await db
      .insert(tables.appointmentMessages)
      .values({
        appointmentId: row.appointmentId,
        businessId: row.businessId,
        clientId: row.clientId,
        channel: "WHATSAPP",
        type: REMINDER_TYPE,
        status: "PENDING",
        attemptCount: 1,
        scheduledFor: apptLocal.minus({ hours: 24 }).toJSDate(),
      })
      .onConflictDoNothing({
        target: [
          tables.appointmentMessages.appointmentId,
          tables.appointmentMessages.type,
        ],
      })
      .returning({
        id: tables.appointmentMessages.id,
        attemptCount: tables.appointmentMessages.attemptCount,
      });

    let claimed = inserted;
    if (!claimed) {
      // A previous FAILED attempt can be reclaimed atomically when its retry is
      // due. Concurrent cron runs race on status=FAILED; only one flips it back
      // to PENDING and receives the row.
      const [retryClaim] = await db
        .update(tables.appointmentMessages)
        .set({
          status: "PENDING",
          attemptCount: sql`${tables.appointmentMessages.attemptCount} + 1`,
          nextAttemptAt: null,
          errorMessage: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(tables.appointmentMessages.appointmentId, row.appointmentId),
            eq(tables.appointmentMessages.type, REMINDER_TYPE),
            eq(tables.appointmentMessages.status, "FAILED"),
            lt(tables.appointmentMessages.attemptCount, MAX_SEND_ATTEMPTS),
            or(
              isNull(tables.appointmentMessages.nextAttemptAt),
              lte(tables.appointmentMessages.nextAttemptAt, now),
            ),
          ),
        )
        .returning({
          id: tables.appointmentMessages.id,
          attemptCount: tables.appointmentMessages.attemptCount,
        });
      claimed = retryClaim;
      if (claimed) summary.retried += 1;
    }

    if (!claimed) {
      summary.duplicates += 1;
      summary.results.push({
        ...base,
        outcome: "ALREADY_HANDLED",
        reason: row.messageStatus
          ? `message status: ${row.messageStatus}`
          : "message already claimed",
      });
      continue;
    }

    // --- Invalid phone → SKIPPED. ---
    if (!phone) {
      await db
        .update(tables.appointmentMessages)
        .set({
          status: "SKIPPED",
          nextAttemptAt: null,
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
          nextAttemptAt: null,
          errorMessage: null,
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
      const nextAttemptAt = getNextReminderRetryAt(now, claimed.attemptCount);
      await db
        .update(tables.appointmentMessages)
        .set({
          status: "FAILED",
          errorMessage: reason,
          nextAttemptAt,
          updatedAt: new Date(),
        })
        .where(eq(tables.appointmentMessages.id, claimed.id));
      summary.failed += 1;
      summary.results.push({
        ...base,
        outcome: "FAILED",
        reason: nextAttemptAt
          ? `${reason}; retry scheduled`
          : `${reason}; retry limit reached`,
      });
    }
  }

  return summary;
}
