import { eq, and, asc, sql } from "drizzle-orm";
import { z } from "zod";
import { DateTime } from "luxon";
import { TRPCError } from "@trpc/server";
import { db, tables } from "@spotz/db";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import {
  createAppointmentSchema,
  serviceCalendarSchema,
  slotDateSchema,
} from "../schemas/booking";
import { normalizeIsraeliPhone } from "../lib/phone";
import { getBookingOwnerName } from "../lib/booking-owner-name";
import { hasDatabaseErrorCode } from "../lib/database-errors";
import {
  loadBookingSchedule,
  slotsForDay,
} from "../services/booking-availability";

/** Loads public business fields (incl. booking window) by id, or throws NOT_FOUND. */
async function requireBusiness(businessId: string) {
  const [business] = await db
    .select({
      id: tables.businesses.id,
      timezone: tables.businesses.timezone,
      autoOpenCalendar: tables.businesses.autoOpenCalendar,
      autoOpenDays: tables.businesses.autoOpenDays,
      manualOpenUntil: tables.businesses.manualOpenUntil,
    })
    .from(tables.businesses)
    .where(eq(tables.businesses.id, businessId));

  if (!business) {
    throw new TRPCError({ code: "NOT_FOUND", message: "העסק לא נמצא." });
  }
  return business;
}

function bookingWindow(business: {
  timezone: string;
  autoOpenCalendar: boolean;
  autoOpenDays: number;
  manualOpenUntil: string | null;
}) {
  const today = DateTime.now().setZone(business.timezone).startOf("day");
  if (business.autoOpenCalendar)
    return { today, lastDay: today.plus({ days: business.autoOpenDays }) };
  const manual = DateTime.fromISO(business.manualOpenUntil ?? "", {
    zone: business.timezone,
  });
  return { today, lastDay: manual.isValid && manual > today ? manual : today };
}

async function findBookableService(businessId: string, serviceId: string) {
  const [service] = await db
    .select({
      id: tables.services.id,
      durationMinutes: tables.services.durationMinutes,
      priceCents: tables.services.priceCents,
      requiresApproval: tables.services.requiresApproval,
    })
    .from(tables.services)
    .where(
      and(
        eq(tables.services.id, serviceId),
        eq(tables.services.businessId, businessId),
        eq(tables.services.isActive, true),
      ),
    );
  return service;
}

async function isBookableStaff(
  businessId: string,
  staffMemberId: string | undefined,
  reader: Pick<typeof db, "select"> = db,
) {
  const [member] = await reader
    .select({ id: tables.staffMembers.id })
    .from(tables.staffMembers)
    .where(
      and(
        eq(tables.staffMembers.businessId, businessId),
        staffMemberId ? eq(tables.staffMembers.id, staffMemberId) : undefined,
      ),
    )
    .limit(1);
  return staffMemberId ? Boolean(member) : !member;
}

const staffChangedMessage = "רשימת הצוות השתנתה. רעננו את הדף ובחרו איש צוות.";

/**
 * Unauthenticated, read-only + booking endpoints for the public surface.
 * Returns only public-safe fields (no ownerId / internal bookkeeping).
 */
export const publicRouter = router({
  /** A business and its active services by public slug, or `null` if unknown. */
  getBusinessBySlug: publicProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(async ({ input }) => {
      const [business] = await db
        .select({
          id: tables.businesses.id,
          name: tables.businesses.name,
          ownerBookingName: tables.businesses.ownerBookingName,
          ownerFullName: tables.users.fullName,
          slug: tables.businesses.slug,
          description: tables.businesses.description,
          imageUrl: tables.businesses.imageUrl,
          phone: tables.businesses.phone,
          city: tables.businesses.city,
          address: tables.businesses.address,
          timezone: tables.businesses.timezone,
          autoOpenCalendar: tables.businesses.autoOpenCalendar,
          autoOpenDays: tables.businesses.autoOpenDays,
          manualOpenUntil: tables.businesses.manualOpenUntil,
        })
        .from(tables.businesses)
        .innerJoin(tables.users, eq(tables.businesses.ownerId, tables.users.id))
        .where(eq(tables.businesses.slug, input.slug));

      if (!business) return null;

      const { today, lastDay } = bookingWindow(business);
      const [services, staffMembers] = await Promise.all([
        db
          .select({
            id: tables.services.id,
            name: tables.services.name,
            description: tables.services.description,
            durationMinutes: tables.services.durationMinutes,
            priceCents: tables.services.priceCents,
            currency: tables.services.currency,
          })
          .from(tables.services)
          .where(
            and(
              eq(tables.services.businessId, business.id),
              eq(tables.services.isActive, true),
            ),
          )
          .orderBy(asc(tables.services.createdAt)),
        db
          .select({
            id: tables.staffMembers.id,
            name: tables.staffMembers.name,
          })
          .from(tables.staffMembers)
          .where(eq(tables.staffMembers.businessId, business.id))
          .orderBy(
            asc(tables.staffMembers.createdAt),
            asc(tables.staffMembers.id),
          ),
      ]);

      const {
        autoOpenCalendar: _a,
        autoOpenDays: _d,
        manualOpenUntil: _m,
        ownerBookingName: _ownerBookingName,
        ownerFullName,
        ...publicBusiness
      } = business;

      return {
        business: {
          ...publicBusiness,
          minBookingDate: today.toFormat("yyyy-MM-dd"),
          maxBookingDate: lastDay.toFormat("yyyy-MM-dd"),
        },
        services,
        staffMembers,
        ownerBookingName:
          staffMembers.length === 0
            ? getBookingOwnerName(business, ownerFullName)
            : null,
      };
    }),

  /** Days with at least one free slot in a calendar month. */
  getAvailableDates: publicProcedure
    .input(
      serviceCalendarSchema.extend({
        month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
      }),
    )
    .query(async ({ input }) => {
      const business = await requireBusiness(input.businessId);
      const [service, staffAllowed] = await Promise.all([
        findBookableService(business.id, input.serviceId),
        isBookableStaff(business.id, input.staffMemberId),
      ]);
      if (!service || !staffAllowed) return [];

      const now = DateTime.now().setZone(business.timezone);
      const month = DateTime.fromISO(input.month, {
        zone: business.timezone,
      }).startOf("month");
      const { today, lastDay } = bookingWindow(business);
      const start = DateTime.max(month, today);
      const end = DateTime.min(
        month.plus({ months: 1 }),
        lastDay.plus({ days: 1 }),
      );
      if (!start.isValid || !end.isValid || start >= end) return [];

      const schedule = await loadBookingSchedule(
        business.id,
        input.staffMemberId,
        start,
        end,
      );
      const dates: string[] = [];
      for (let day = start; day < end; day = day.plus({ days: 1 })) {
        if (
          slotsForDay(day, service.durationMinutes, schedule, now).length > 0
        ) {
          dates.push(day.toFormat("yyyy-MM-dd"));
        }
      }
      return dates;
    }),

  /** Open start times for a service on a date ("YYYY-MM-DD"), per its duration. */
  getAvailableSlots: publicProcedure
    .input(slotDateSchema)
    .query(async ({ input }) => {
      const business = await requireBusiness(input.businessId);
      const [service, staffAllowed] = await Promise.all([
        findBookableService(business.id, input.serviceId),
        isBookableStaff(business.id, input.staffMemberId),
      ]);
      if (!service || !staffAllowed) return [];

      const day = DateTime.fromISO(input.date, {
        zone: business.timezone,
      }).startOf("day");
      const { today, lastDay } = bookingWindow(business);
      if (!day.isValid || day < today || day > lastDay) return [];

      const schedule = await loadBookingSchedule(
        business.id,
        input.staffMemberId,
        day,
        day.plus({ days: 1 }),
      );
      return slotsForDay(
        day,
        service.durationMinutes,
        schedule,
        DateTime.now(),
      );
    }),

  /**
   * Books an appointment for the authenticated, onboarded client. Name + phone
   * come from the user's profile (not the request); guest bookings are disabled.
   */
  createAppointment: protectedProcedure
    .input(createAppointmentSchema)
    .mutation(async ({ ctx, input }) => {
      const business = await requireBusiness(input.businessId);

      // ctx.user is loaded once per request in createClerkContext — no re-query.
      const user = ctx.user;
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "המשתמש לא נמצא." });
      }
      // Onboarding is required before booking (name + phone on the profile).
      // Normalize the profile phone to the canonical E.164-without-plus form so
      // it's stored consistently as contact data on the (businessId, userId)
      // booking-contact row.
      // An unnormalizable legacy phone fails this gate → "complete your profile".
      const fullName = user.fullName?.trim();
      const phone = normalizeIsraeliPhone(user.phone);
      if (!fullName || !phone) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "יש להשלים את פרטי הפרופיל לפני קביעת תור.",
        });
      }
      const linkedUserId = user.id;

      const [service, staffAllowed] = await Promise.all([
        findBookableService(business.id, input.serviceId),
        isBookableStaff(business.id, input.staffMemberId),
      ]);
      if (!service) {
        throw new TRPCError({ code: "NOT_FOUND", message: "השירות לא נמצא." });
      }
      if (!staffAllowed) {
        throw new TRPCError({
          code: input.staffMemberId ? "NOT_FOUND" : "CONFLICT",
          message: input.staffMemberId
            ? "איש הצוות לא נמצא בעסק."
            : staffChangedMessage,
        });
      }

      const startAt = DateTime.fromISO(`${input.date}T${input.time}`, {
        zone: business.timezone,
      });
      if (!startAt.isValid) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "מועד לא תקין." });
      }
      const day = startAt.startOf("day");
      const { today, lastDay } = bookingWindow(business);
      if (day < today || day > lastDay) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "התאריך שנבחר מחוץ לטווח ההזמנות.",
        });
      }
      const endAt = startAt.plus({ minutes: service.durationMinutes });

      // Re-validate availability server-side (working hours + no overlap).
      const schedule = await loadBookingSchedule(
        business.id,
        input.staffMemberId,
        day,
        day.plus({ days: 1 }),
      );
      const openSlots = slotsForDay(
        day,
        service.durationMinutes,
        schedule,
        DateTime.now(),
      );
      if (!openSlots.includes(input.time)) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "המועד שנבחר אינו פנוי. נסו מועד אחר.",
        });
      }

      let appointment: {
        id: string;
        status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
      };
      try {
        appointment = await db.transaction(async (tx) => {
          if (!input.staffMemberId) {
            // The first staff insert takes a key-share lock on the same business
            // through its foreign key. Recheck after locking the business row.
            await tx
              .select({ id: tables.businesses.id })
              .from(tables.businesses)
              .where(eq(tables.businesses.id, business.id))
              .for("update");
            if (!(await isBookableStaff(business.id, undefined, tx))) {
              throw new TRPCError({
                code: "CONFLICT",
                message: staffChangedMessage,
              });
            }
          }

          // Keep one booking contact per (business, authenticated user). Phone is
          // mutable contact data and must never transfer appointment ownership.
          const [client] = await tx
            .insert(tables.clients)
            .values({
              businessId: business.id,
              userId: linkedUserId,
              fullName,
              phone,
            })
            .onConflictDoUpdate({
              target: [tables.clients.businessId, tables.clients.userId],
              targetWhere: sql`${tables.clients.userId} is not null`,
              set: { fullName, phone },
            })
            .returning();

          const [created] = await tx
            .insert(tables.appointments)
            .values({
              businessId: business.id,
              serviceId: service.id,
              clientId: client.id,
              staffMemberId: input.staffMemberId,
              startAt: startAt.toJSDate(),
              endAt: endAt.toJSDate(),
              // Auto-confirm unless the service requires manual owner approval.
              status: service.requiresApproval ? "PENDING" : "CONFIRMED",
              priceCentsSnapshot: service.priceCents,
            })
            .returning({
              id: tables.appointments.id,
              status: tables.appointments.status,
            });

          return created;
        });
      } catch (error) {
        // The exclusion constraint is the final concurrency-safe guard. Two
        // clients may both see a slot before either insert commits; only one wins.
        if (hasDatabaseErrorCode(error, "23P01")) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "המועד נתפס כרגע על ידי לקוח אחר. בחרו מועד חדש.",
          });
        }
        throw error;
      }

      return {
        id: appointment.id,
        date: input.date,
        time: input.time,
        status: appointment.status,
      };
    }),

  /** Appointment details for the confirmation page, guarded by its bearer token. */
  getAppointmentDetails: publicProcedure
    .input(
      z.object({
        appointmentId: z.string().uuid(),
        token: z.string().uuid(),
      }),
    )
    .query(async ({ input }) => {
      const [row] = await db
        .select({
          id: tables.appointments.id,
          startAt: tables.appointments.startAt,
          endAt: tables.appointments.endAt,
          status: tables.appointments.status,
          arrivalConfirmedAt: tables.appointments.arrivalConfirmedAt,
          priceCentsSnapshot: tables.appointments.priceCentsSnapshot,
          clientName: tables.clients.fullName,
          serviceName: tables.services.name,
          staffName: tables.staffMembers.name,
          businessName: tables.businesses.name,
          timezone: tables.businesses.timezone,
        })
        .from(tables.appointments)
        .innerJoin(
          tables.clients,
          eq(tables.appointments.clientId, tables.clients.id),
        )
        .innerJoin(
          tables.services,
          eq(tables.appointments.serviceId, tables.services.id),
        )
        .innerJoin(
          tables.businesses,
          eq(tables.appointments.businessId, tables.businesses.id),
        )
        .leftJoin(
          tables.staffMembers,
          eq(tables.appointments.staffMemberId, tables.staffMembers.id),
        )
        .where(
          and(
            eq(tables.appointments.id, input.appointmentId),
            eq(tables.appointments.confirmationToken, input.token),
          ),
        );

      if (!row) return null;

      const start = DateTime.fromJSDate(row.startAt)
        .setZone(row.timezone)
        .setLocale("he");
      const end = DateTime.fromJSDate(row.endAt).setZone(row.timezone);

      return {
        id: row.id,
        status: row.status,
        arrivalConfirmed: row.arrivalConfirmedAt !== null,
        clientName: row.clientName,
        serviceName: row.serviceName,
        staffName: row.staffName,
        businessName: row.businessName,
        priceCentsSnapshot: row.priceCentsSnapshot,
        date: start.toLocaleString({
          weekday: "long",
          day: "numeric",
          month: "long",
        }),
        startTime: start.toFormat("HH:mm"),
        endTime: end.toFormat("HH:mm"),
      };
    }),

  /**
   * Client-facing status update from the private confirmation link.
   */
  updateAppointmentStatusPublic: publicProcedure
    .input(
      z.object({
        appointmentId: z.string().uuid(),
        token: z.string().uuid(),
        status: z.enum(["CONFIRMED", "CANCELLED"]),
      }),
    )
    .mutation(async ({ input }) => {
      const [appointment] = await db
        .select({
          id: tables.appointments.id,
          status: tables.appointments.status,
        })
        .from(tables.appointments)
        .where(
          and(
            eq(tables.appointments.id, input.appointmentId),
            eq(tables.appointments.confirmationToken, input.token),
          ),
        );

      if (!appointment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "התור לא נמצא." });
      }
      // Terminal states can't be acted on. Both PENDING and CONFIRMED are
      // actionable so clients can confirm arrival even for auto-approved
      // services (which are born CONFIRMED).
      if (
        appointment.status === "CANCELLED" ||
        appointment.status === "COMPLETED"
      ) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "התור כבר טופל ולא ניתן לעדכן אותו.",
        });
      }

      // "אני מגיע" records the arrival confirmation timestamp while keeping the
      // appointment CONFIRMED; "ביטול תור" cancels it.
      const [updated] = await db
        .update(tables.appointments)
        .set(
          input.status === "CONFIRMED"
            ? { status: "CONFIRMED", arrivalConfirmedAt: new Date() }
            : { status: "CANCELLED" },
        )
        .where(
          and(
            eq(tables.appointments.id, input.appointmentId),
            eq(tables.appointments.confirmationToken, input.token),
          ),
        )
        .returning({
          id: tables.appointments.id,
          status: tables.appointments.status,
          arrivalConfirmedAt: tables.appointments.arrivalConfirmedAt,
        });
      return {
        id: updated.id,
        status: updated.status,
        arrivalConfirmed: updated.arrivalConfirmedAt !== null,
      };
    }),
});
